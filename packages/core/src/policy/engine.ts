/**
 * Row-Level Security (RLS) policy engine.
 *
 * Evaluates the USING / WITH CHECK expressions from `PolicyIR` records against
 * live row data and an authenticated role context. Complex Postgres expressions
 * that cannot be represented as simple JS are logged and defaulted to ALLOW in
 * dev mode — production-style enforcement requires the real Postgres engine.
 */

import type { SchemaRegistry } from "../schema/registry.js";
import type { PolicyIR } from "../schema/ir.js";

/** The authenticated context for a request. */
export interface RoleContext {
  role: "anon" | "authenticated" | "service_role";
  userId?: string;
  claims?: Record<string, unknown>;
}

/** Resolve `auth.uid()` in an expression to the actual user ID string. */
function resolveAuthUid(ctx: RoleContext): string | null {
  return ctx.userId ?? null;
}

/** Resolve `auth.role()` in an expression to the role string. */
function resolveAuthRole(ctx: RoleContext): string {
  return ctx.role;
}

/**
 * Attempt to evaluate a simplified subset of Postgres policy expressions.
 *
 * Supported patterns:
 * - `auth.uid() = column_name`
 * - `auth.role() = 'role_name'`
 * - `true` / `false`
 * - `(expr) AND (expr)` / `(expr) OR (expr)`
 *
 * For unsupported patterns, defaults to `true` (ALLOW) with a console warning.
 */
function evalExpression(
  expr: string,
  row: Record<string, unknown>,
  ctx: RoleContext,
): boolean {
  const normalized = expr.trim().toLowerCase();

  if (normalized === "true") return true;
  if (normalized === "false") return false;

  // auth.uid() = <column>
  const uidColMatch = normalized.match(/^auth\.uid\(\)\s*=\s*([a-z_][a-z0-9_.]*)\s*$/);
  if (uidColMatch) {
    const col = uidColMatch[1];
    return resolveAuthUid(ctx) === row[col ?? ""];
  }

  // <column> = auth.uid()
  const colUidMatch = normalized.match(/^([a-z_][a-z0-9_.]*)\s*=\s*auth\.uid\(\)\s*$/);
  if (colUidMatch) {
    const col = colUidMatch[1];
    return resolveAuthUid(ctx) === row[col ?? ""];
  }

  // auth.role() = '<literal>'
  const roleMatch = normalized.match(/^auth\.role\(\)\s*=\s*'([a-z_][a-z0-9_]*)'\s*$/);
  if (roleMatch) {
    return resolveAuthRole(ctx) === roleMatch[1];
  }

  // Simple AND: (expr) and (expr)
  const andMatch = normalized.match(/^\((.+)\)\s*and\s*\((.+)\)$/s);
  if (andMatch) {
    return (
      evalExpression(andMatch[1] ?? "", row, ctx) &&
      evalExpression(andMatch[2] ?? "", row, ctx)
    );
  }

  // Simple OR: (expr) or (expr)
  const orMatch = normalized.match(/^\((.+)\)\s*or\s*\((.+)\)$/s);
  if (orMatch) {
    return (
      evalExpression(orMatch[1] ?? "", row, ctx) ||
      evalExpression(orMatch[2] ?? "", row, ctx)
    );
  }

  // Unsupported — default ALLOW with a warning so developers notice
  // NOTE: This is intentional dev-mode behaviour. Real enforcement requires Postgres.
  console.warn(
    `[fakebase/policy] Cannot evaluate expression: "${expr}". Defaulting to ALLOW. ` +
      "Use simple auth.uid() / auth.role() patterns for Fakebase policy evaluation.",
  );
  return true;
}

/** True when a policy applies to the given role and command. */
function policyApplies(
  policy: PolicyIR,
  role: string,
  op: "SELECT" | "INSERT" | "UPDATE" | "DELETE",
): boolean {
  const commandMatch = policy.command === "ALL" || policy.command === op;
  if (!commandMatch) return false;
  return (
    policy.roles.length === 0 ||
    policy.roles.includes(role) ||
    policy.roles.includes("public")
  );
}

export class PolicyEngine {
  constructor(private readonly registry: SchemaRegistry) {}

  /** True when RLS is enabled for the given table. */
  isRlsEnabled(table: string, schema: string): boolean {
    const t = this.registry.getTable(schema, table);
    return t?.rlsEnabled ?? false;
  }

  /**
   * Evaluate whether a row is visible to the role (SELECT / USING check).
   * Returns true when the row passes at least one applicable permissive policy
   * (and no restrictive policy denies it).
   */
  evaluateRead(
    table: string,
    schema: string,
    row: Record<string, unknown>,
    ctx: RoleContext,
  ): boolean {
    if (ctx.role === "service_role") return true;

    const tableIR = this.registry.getTable(schema, table);
    if (!tableIR || !tableIR.rlsEnabled) return true;

    const applicable = tableIR.policies.filter((p) =>
      policyApplies(p, ctx.role, "SELECT"),
    );
    if (applicable.length === 0) return false; // default deny

    const permissive = applicable.filter((p) => p.permissive);
    const restrictive = applicable.filter((p) => !p.permissive);

    const allowedByPermissive =
      permissive.length === 0
        ? false
        : permissive.some((p) => (p.using ? evalExpression(p.using, row, ctx) : true));

    if (!allowedByPermissive) return false;

    const deniedByRestrictive = restrictive.some(
      (p) => p.using && !evalExpression(p.using, row, ctx),
    );
    return !deniedByRestrictive;
  }

  /**
   * Evaluate whether a write operation is allowed for the role.
   * INSERT / UPDATE use the WITH CHECK expression; DELETE uses USING.
   */
  evaluateWrite(
    table: string,
    schema: string,
    row: Record<string, unknown>,
    ctx: RoleContext,
    op: "INSERT" | "UPDATE" | "DELETE",
  ): boolean {
    if (ctx.role === "service_role") return true;

    const tableIR = this.registry.getTable(schema, table);
    if (!tableIR || !tableIR.rlsEnabled) return true;

    const applicable = tableIR.policies.filter((p) => policyApplies(p, ctx.role, op));
    if (applicable.length === 0) return false; // default deny

    const permissive = applicable.filter((p) => p.permissive);
    const restrictive = applicable.filter((p) => !p.permissive);

    const checkExpr = (p: PolicyIR): boolean => {
      if (op === "DELETE") {
        return p.using ? evalExpression(p.using, row, ctx) : true;
      }
      // INSERT / UPDATE: prefer withCheck, fall back to using
      const expr = p.withCheck ?? p.using;
      return expr ? evalExpression(expr, row, ctx) : true;
    };

    const allowedByPermissive =
      permissive.length === 0 ? false : permissive.some(checkExpr);

    if (!allowedByPermissive) return false;

    const deniedByRestrictive = restrictive.some((p) => !checkExpr(p));
    return !deniedByRestrictive;
  }
}
