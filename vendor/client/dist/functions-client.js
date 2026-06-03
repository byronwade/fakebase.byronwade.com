/**
 * Functions client facade — wraps `kernel.functions` to expose
 * `supabase.functions.invoke(name, options)`.
 */
/**
 * Build the `supabase.functions` facade object.
 *
 * @param kernel - The kernel whose functions engine to wrap.
 */
export function createFunctionsClient(kernel) {
    const fn = kernel.functions;
    return {
        invoke: (name, options) => fn.invoke(name, options),
    };
}
//# sourceMappingURL=functions-client.js.map