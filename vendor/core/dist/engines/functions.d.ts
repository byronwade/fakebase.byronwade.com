/**
 * Functions engine contract + the default in-process registry.
 *
 * Handles both Edge-Function-style invocation (`functions.invoke`) and database
 * RPC calls (`rpc`). The richer Deno-style runtime conventions live in
 * `@fakebase/functions`; this registry is the minimal local executor.
 */
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
    error: {
        message: string;
        name?: string;
    } | null;
}
/** Result envelope returned by `callRpc` (mirrors a PostgREST RPC response). */
export interface RpcResult {
    data: unknown;
    error: {
        message: string;
        code?: string;
    } | null;
    count: number | null;
}
/** The functions engine contract consumed by the kernel and client facade. */
export interface FunctionsEngine {
    register(name: string, handler: FunctionHandler): void;
    unregister(name: string): void;
    list(): string[];
    invoke<T = unknown>(name: string, options?: FunctionInvokeOptions): Promise<FunctionInvokeResult<T>>;
    callRpc(fn: string, args?: Record<string, unknown>, opts?: {
        head?: boolean;
        count?: "exact" | "planned" | "estimated";
    }): Promise<RpcResult>;
}
/** Default in-process functions registry. */
export declare class LocalFunctionsRegistry implements FunctionsEngine {
    private readonly handlers;
    register(name: string, handler: FunctionHandler): void;
    unregister(name: string): void;
    list(): string[];
    invoke<T = unknown>(name: string, options?: FunctionInvokeOptions): Promise<FunctionInvokeResult<T>>;
    callRpc(fn: string, args?: Record<string, unknown>, _opts?: {
        head?: boolean;
        count?: "exact" | "planned" | "estimated";
    }): Promise<RpcResult>;
}
//# sourceMappingURL=functions.d.ts.map