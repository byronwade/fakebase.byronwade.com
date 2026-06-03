/**
 * Row-Level Security (RLS) policy engine.
 *
 * Evaluates the USING / WITH CHECK expressions from `PolicyIR` records against
 * live row data and an authenticated role context. Complex Postgres expressions
 * that cannot be represented as simple JS are logged and defaulted to ALLOW in
 * dev mode — production-style enforcement requires the real Postgres engine.
 */
import type { SchemaRegistry } from "../schema/registry.js";
/** The authenticated context for a request. */
export interface RoleContext {
    role: "anon" | "authenticated" | "service_role";
    userId?: string;
    claims?: Record<string, unknown>;
}
export declare class PolicyEngine {
    private readonly registry;
    constructor(registry: SchemaRegistry);
    /** True when RLS is enabled for the given table. */
    isRlsEnabled(table: string, schema: string): boolean;
    /**
     * Evaluate whether a row is visible to the role (SELECT / USING check).
     * Returns true when the row passes at least one applicable permissive policy
     * (and no restrictive policy denies it).
     */
    evaluateRead(table: string, schema: string, row: Record<string, unknown>, ctx: RoleContext): boolean;
    /**
     * Evaluate whether a write operation is allowed for the role.
     * INSERT / UPDATE use the WITH CHECK expression; DELETE uses USING.
     */
    evaluateWrite(table: string, schema: string, row: Record<string, unknown>, ctx: RoleContext, op: "INSERT" | "UPDATE" | "DELETE"): boolean;
}
//# sourceMappingURL=engine.d.ts.map