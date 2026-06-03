/**
 * Functions client facade — wraps `kernel.functions` to expose
 * `supabase.functions.invoke(name, options)`.
 */

import type {
  FakebaseKernel,
  FunctionInvokeOptions,
  FunctionInvokeResult,
} from "@byronwade/core";

/**
 * The `supabase.functions` facade. Mirrors Supabase's functions client, which
 * exposes only `invoke` (registration happens via `kernel.functions.register`).
 */
export interface FunctionsClientFacade {
  invoke<T = unknown>(
    name: string,
    options?: FunctionInvokeOptions,
  ): Promise<FunctionInvokeResult<T>>;
}

/**
 * Build the `supabase.functions` facade object.
 *
 * @param kernel - The kernel whose functions engine to wrap.
 */
export function createFunctionsClient(kernel: FakebaseKernel): FunctionsClientFacade {
  const fn = kernel.functions;

  return {
    invoke: <T = unknown>(name: string, options?: FunctionInvokeOptions) =>
      fn.invoke<T>(name, options),
  };
}
