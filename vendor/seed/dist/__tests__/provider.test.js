import { describe, expect, it } from "vitest";
import { createBuiltinProvider } from "../provider.js";
describe("builtin provider — forType", () => {
    it("generates booleans for bool columns", () => {
        const p = createBuiltinProvider();
        p.seed(1);
        const gen = p.forType("bool");
        expect(typeof gen()).toBe("boolean");
    });
    it("generates integers for int4 columns", () => {
        const p = createBuiltinProvider();
        p.seed(1);
        const v = p.forType("int4")();
        expect(typeof v).toBe("number");
        expect(Number.isInteger(v)).toBe(true);
    });
    it("generates uuid-shaped strings for uuid columns", () => {
        const p = createBuiltinProvider();
        p.seed(1);
        const v = p.forType("uuid")();
        expect(v).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
    it("generates ISO date strings for timestamptz columns", () => {
        const p = createBuiltinProvider();
        p.seed(1);
        const v = p.forType("timestamptz")();
        expect(new Date(v).toString()).not.toBe("Invalid Date");
    });
});
describe("builtin provider — forName (semantic inference)", () => {
    it("maps email columns to address-shaped values", () => {
        const p = createBuiltinProvider();
        p.seed(1);
        const gen = p.forName("email", "text");
        expect(gen).not.toBeNull();
        expect(String(gen())).toContain("@");
    });
    it("maps first_name columns to a non-empty name", () => {
        const p = createBuiltinProvider();
        p.seed(1);
        const gen = p.forName("first_name", "text");
        expect(gen).not.toBeNull();
        expect(String(gen()).length).toBeGreaterThan(0);
    });
    it("returns null when the column name has no semantic match", () => {
        const p = createBuiltinProvider();
        p.seed(1);
        expect(p.forName("xyzzy_unmatched_column", "text")).toBeNull();
    });
    it("does not match a keyword embedded in a larger word (total ≠ totally)", () => {
        const p = createBuiltinProvider();
        p.seed(1);
        expect(p.forName("totally_unknown", "text")).toBeNull();
        // but a real price-ish segment still matches
        expect(p.forName("order_total", "int4")).not.toBeNull();
    });
});
describe("builtin provider — determinism", () => {
    it("produces identical output after reseeding with the same value", () => {
        const p = createBuiltinProvider();
        p.seed(42);
        const first = [p.forType("int4")(), p.forName("email", "text")()];
        p.seed(42);
        const second = [p.forType("int4")(), p.forName("email", "text")()];
        expect(second).toEqual(first);
    });
});
//# sourceMappingURL=provider.test.js.map