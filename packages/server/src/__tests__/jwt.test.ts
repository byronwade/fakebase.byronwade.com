import { describe, it, expect } from "vitest";
import { signJwt, verifyJwt } from "../auth/jwt.js";

const SECRET = "test-secret";

describe("jwt", () => {
  it("signs and verifies a round-trip, returning the claims", () => {
    const token = signJwt({ sub: "u1", role: "authenticated", email: "a@b.com" }, SECRET);
    expect(token.split(".")).toHaveLength(3);
    const claims = verifyJwt(token, SECRET);
    expect(claims).toMatchObject({ sub: "u1", role: "authenticated", email: "a@b.com" });
  });

  it("stamps iat and exp from expiresIn", () => {
    const token = signJwt({ sub: "u1", role: "authenticated" }, SECRET, { expiresIn: 3600 });
    const claims = verifyJwt(token, SECRET)!;
    expect(typeof claims.iat).toBe("number");
    expect(claims.exp).toBe((claims.iat as number) + 3600);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signJwt({ sub: "u1", role: "authenticated" }, SECRET);
    expect(verifyJwt(token, "other-secret")).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = signJwt({ sub: "u1", role: "authenticated" }, SECRET);
    const [h, , s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "admin", role: "service_role" })).toString(
      "base64url",
    );
    expect(verifyJwt(`${h}.${forged}.${s}`, SECRET)).toBeNull();
  });

  it("rejects an expired token", () => {
    // iat far in the past, exp before now
    const token = signJwt({ sub: "u1", role: "authenticated" }, SECRET, {
      expiresIn: -10,
      now: 1000,
    });
    expect(verifyJwt(token, SECRET, { now: 2000 })).toBeNull();
  });
});
