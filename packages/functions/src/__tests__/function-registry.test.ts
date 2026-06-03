import { describe, it, expect, beforeEach } from "vitest";
import { CapabilityError } from "@fakebase/core";
import { FunctionRegistry } from "../function-registry.js";
import type { FunctionRequest } from "../types.js";

describe("FunctionRegistry — register & invoke", () => {
  let registry: FunctionRegistry;

  beforeEach(() => {
    registry = new FunctionRegistry();
  });

  it("registers and invokes a function, returning its body as data", async () => {
    registry.register({
      name: "greet",
      handler: (req: FunctionRequest) => ({
        status: 200,
        body: { message: `Hello, ${(req.body as { name: string }).name}` },
      }),
    });

    const result = await registry.invoke("greet", { body: { name: "World" } });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ message: "Hello, World" });
  });

  it("returns CapabilityError for a non-existent function", async () => {
    const result = await registry.invoke("unknown", {});
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(CapabilityError);
    expect((result.error as CapabilityError).capability).toBe("functions/unknown");
  });

  it("catches handler errors and returns them as { data: null, error }", async () => {
    registry.register({
      name: "boom",
      handler: () => {
        throw new Error("something went wrong");
      },
    });

    const result = await registry.invoke("boom", {});
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe("something went wrong");
  });

  it("list() returns sorted function names", () => {
    registry.register({ name: "z-fn", handler: async () => ({ body: null }) });
    registry.register({ name: "a-fn", handler: async () => ({ body: null }) });
    expect(registry.list()).toEqual(["a-fn", "z-fn"]);
  });

  it("get() returns the registered definition", () => {
    const handler = async () => ({ body: "ok" });
    registry.register({ name: "myFn", handler });
    expect(registry.get("myFn")?.name).toBe("myFn");
    expect(registry.get("missing")).toBeUndefined();
  });

  it("invokeRpc() passes args as body and returns data directly", async () => {
    registry.register({
      name: "add",
      handler: (req: FunctionRequest) => {
        const { a, b } = req.body as { a: number; b: number };
        return { body: { result: a + b } };
      },
    });

    const data = await registry.invokeRpc("add", { a: 3, b: 4 });
    expect(data).toEqual({ result: 7 });
  });

  it("invokeRpc() throws when function is not found", async () => {
    await expect(registry.invokeRpc("nope", {})).rejects.toBeInstanceOf(
      CapabilityError,
    );
  });

  it("async handlers are awaited correctly", async () => {
    registry.register({
      name: "async-fn",
      handler: async () => {
        await new Promise((r) => setTimeout(r, 1));
        return { body: { done: true } };
      },
    });

    const result = await registry.invoke("async-fn", {});
    expect(result.data).toEqual({ done: true });
    expect(result.error).toBeNull();
  });
});
