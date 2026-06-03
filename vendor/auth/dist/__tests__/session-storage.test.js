import { describe, it, expect, beforeEach } from "vitest";
import { MemorySessionStorage } from "../session-storage.js";
describe("MemorySessionStorage", () => {
    let storage;
    beforeEach(() => {
        storage = new MemorySessionStorage();
    });
    it("returns null for unknown key", async () => {
        const value = await storage.getItem("missing");
        expect(value).toBeNull();
    });
    it("stores and retrieves a value", async () => {
        await storage.setItem("key1", "value1");
        const result = await storage.getItem("key1");
        expect(result).toBe("value1");
    });
    it("overwrites existing value", async () => {
        await storage.setItem("key1", "first");
        await storage.setItem("key1", "second");
        const result = await storage.getItem("key1");
        expect(result).toBe("second");
    });
    it("removes a value", async () => {
        await storage.setItem("key1", "value1");
        await storage.removeItem("key1");
        const result = await storage.getItem("key1");
        expect(result).toBeNull();
    });
    it("silently handles removeItem on missing key", async () => {
        await expect(storage.removeItem("nonexistent")).resolves.toBeUndefined();
    });
    it("stores multiple independent keys", async () => {
        await storage.setItem("a", "alpha");
        await storage.setItem("b", "beta");
        await storage.setItem("c", "gamma");
        expect(await storage.getItem("a")).toBe("alpha");
        expect(await storage.getItem("b")).toBe("beta");
        expect(await storage.getItem("c")).toBe("gamma");
    });
    it("stores JSON values correctly", async () => {
        const obj = { token: "abc123", userId: "xyz" };
        await storage.setItem("session", JSON.stringify(obj));
        const raw = await storage.getItem("session");
        expect(JSON.parse(raw)).toEqual(obj);
    });
});
//# sourceMappingURL=session-storage.test.js.map