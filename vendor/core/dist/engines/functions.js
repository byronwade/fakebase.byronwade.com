/**
 * Functions engine contract + the default in-process registry.
 *
 * Handles both Edge-Function-style invocation (`functions.invoke`) and database
 * RPC calls (`rpc`). The richer Deno-style runtime conventions live in
 * `@fakebase/functions`; this registry is the minimal local executor.
 */
import { FakebaseError, FakebaseErrorCode } from "../errors.js";
/** Default in-process functions registry. */
export class LocalFunctionsRegistry {
    handlers = new Map();
    register(name, handler) {
        this.handlers.set(name, handler);
    }
    unregister(name) {
        this.handlers.delete(name);
    }
    list() {
        return [...this.handlers.keys()].sort();
    }
    async invoke(name, options = {}) {
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
            return { data: data, error: null };
        }
        catch (err) {
            return {
                data: null,
                error: {
                    name: "FunctionsHttpError",
                    message: err instanceof Error ? err.message : String(err),
                },
            };
        }
    }
    async callRpc(fn, args = {}, _opts) {
        const handler = this.handlers.get(fn);
        if (!handler) {
            const err = new FakebaseError(FakebaseErrorCode.FUNCTION_ERROR, `RPC function '${fn}' is not registered.`);
            return {
                data: null,
                error: { message: err.message, code: err.code },
                count: null,
            };
        }
        try {
            const data = await handler({ name: fn, body: args, headers: {}, method: "POST" });
            return { data, error: null, count: null };
        }
        catch (err) {
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
//# sourceMappingURL=functions.js.map