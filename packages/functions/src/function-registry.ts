import { CapabilityError } from "@fakebase/core";
import type {
  FunctionDefinition,
  FunctionInvokeOptions,
  FunctionRequest,
} from "./types.js";

export class FunctionRegistry {
  private readonly functions = new Map<string, FunctionDefinition>();

  register(fn: FunctionDefinition): void {
    this.functions.set(fn.name, fn);
  }

  get(name: string): FunctionDefinition | undefined {
    return this.functions.get(name);
  }

  list(): string[] {
    return [...this.functions.keys()].sort();
  }

  async invoke(
    name: string,
    options: FunctionInvokeOptions,
  ): Promise<{ data: unknown; error: Error | null }> {
    const fn = this.functions.get(name);
    if (!fn) {
      return {
        data: null,
        error: CapabilityError.notImplemented(`functions/${name}`),
      };
    }

    const req: FunctionRequest = {
      body: options.body ?? null,
      headers: options.headers ?? {},
      method: options.method ?? "POST",
      url: `/functions/v1/${name}`,
    };

    try {
      const response = await fn.handler(req);
      return { data: response.body, error: null };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }

  async invokeRpc(fnName: string, args: Record<string, unknown>): Promise<unknown> {
    const result = await this.invoke(fnName, { body: args, method: "POST" });
    if (result.error) throw result.error;
    return result.data;
  }
}
