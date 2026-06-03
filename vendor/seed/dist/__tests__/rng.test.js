import { describe, expect, it } from "vitest";
import { createRng } from "../rng.js";
describe("createRng", () => {
    it("produces a deterministic sequence for a given seed", () => {
        const a = createRng(12345);
        const b = createRng(12345);
        const seqA = [a(), a(), a(), a()];
        const seqB = [b(), b(), b(), b()];
        expect(seqA).toEqual(seqB);
    });
    it("produces a different sequence for a different seed", () => {
        const a = createRng(1);
        const b = createRng(2);
        expect(a()).not.toEqual(b());
    });
    it("returns floats in the [0, 1) range", () => {
        const rng = createRng(99);
        for (let i = 0; i < 1000; i++) {
            const v = rng();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });
});
//# sourceMappingURL=rng.test.js.map