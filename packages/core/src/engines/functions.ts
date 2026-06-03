/**
 * Functions engine contract + the default in-process registry.
 *
 * Handles both Edge-Function-style invocation (`functions.invoke`) and database
 * RPC calls (`rpc`). The richer Deno-style runtime conventions live in
 * `@fakebase/functions`; this registry is the minimal local executor.
 */

import { FakebaseError, FakebaseErrorCode } from "../errors.js";

/** The request object passed to a registered function handler. */
export interface FunctionRequest {
  name: string;
  body: unknown;
  headers: Record<string, string>;
  method: string;
}

/** A function handler. May return a value directly or a Promise of one. */
export type FunctionHandler = (req: FunctionRequest) => unknown | Promise<unknown>;

/** Options accepted by `invoke`. */
export interface FunctionInvokeOptions {
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
}

/** Result envelope returned by `invoke`. */
export interface FunctionInvokeResult<T = unknown> {
  data: T | null;
  error: { message: string; name?: string } | null;
}

/** Result envelope returned by `callRpc` (mirrors a PostgREST RPC response). */
export interface RpcResult {
  data: unknown;
  error: { message: string; code?: string } | null;
  count: number | null;
}

/** The functions engine contract consumed by the kernel and client facade. */
export interface FunctionsEngine {
  register(name: string, handler: FunctionHandler): void;
  unregister(name: string): void;
  list(): string[];
  invoke<T = unknown>(
    name: string,
    options?: FunctionInvokeOptions,
  ): Promise<FunctionInvokeResult<T>>;
  callRpc(
    fn: string,
    args?: Record<string, unknown>,
    opts?: { head?: boolean; count?: "exact" | "planned" | "estimated" },
  ): Promise<RpcResult>;
}

/** Default in-process functions registry. */
export class LocalFunctionsRegistry implements FunctionsEngine {
  private readonly handlers = new Map<string, FunctionHandler>();

  register(name: string, handler: FunctionHandler): void {
    this.handlers.set(name, handler);
  }

  unregister(name: string): void {
    this.handlers.delete(name);
  }

  list(): string[] {
    return [...this.handlers.keys()].sort();
  }

  async invoke<T = unknown>(
    name: string,
    options: FunctionInvokeOptions = {},
  ): Promise<FunctionInvokeResult<T>> {
    const handler = this.handlers.get(name);
    if (!handler) {
      return {
        data: null,
        error: {
          name: "FunctionsFetchError",
          message: `Function '${name}' is not registered. Register it with kernel.functions.register('${name}', handler).`,
        },
      };
    }

    try {
      const data = await handler({
        name,
        body: options.body ?? null,
        headers: options.headers ?? {},
        method: options.method ?? "POST",
      });
      return { data: data as T, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          name: "FunctionsHttpError",
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }

  async callRpc(
    fn: string,
    args: Record<string, unknown> = {},
    _opts?: { head?: boolean; count?: "exact" | "planned" | "estimated" },
  ): Promise<RpcResult> {
    const handler = this.handlers.get(fn);
    if (!handler) {
      const err = new FakebaseError(
        FakebaseErrorCode.FUNCTION_ERROR,
        `RPC function '${fn}' is not registered.`,
      );
      return {
        data: null,
        error: { message: err.message, code: err.code },
        count: null,
      };
    }

    try {
      const data = await handler({ name: fn, body: args, headers: {}, method: "POST" });
      return { data, error: null, count: null };
    } catch (err) {
      return {
        data: null,
        error: {
          message: err instanceof Error ? err.message : String(err),
          code: FakebaseErrorCode.FUNCTION_ERROR,
        },
        count: null,
      };
    }
  }
}
