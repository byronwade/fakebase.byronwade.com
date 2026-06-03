import { describe, expect, it, vi } from "vitest";
import { createFakerProvider, type FakerLike } from "../index.js";

function stubFaker(): FakerLike {
  return {
    seed: vi.fn(),
    string: { uuid: () => "uuid-value" },
    number: {
      int: () => 7,
      float: () => 1.5,
    },
    datatype: { boolean: () => true },
    date: { past: () => new Date("2020-01-01T00:00:00.000Z") },
    lorem: {
      words: () => "lorem words",
      sentence: () => "Lorem sentence.",
      slug: () => "lorem-slug",
    },
    internet: {
      email: () => "a@b.com",
      url: () => "https://x.dev",
      username: () => "user1",
    },
    image: { avatar: () => "https://avatar" },
    person: {
      firstName: () => "Ada",
      lastName: () => "Lovelace",
      fullName: () => "Ada Lovelace",
    },
    location: { city: () => "Lisbon", country: () => "Portugal" },
    phone: { number: () => "+15551234567" },
    commerce: { price: () => "9.99" },
  };
}

describe("createFakerProvider", () => {
  it("routes uuid type to faker.string.uuid", () => {
    const p = createFakerProvider(stubFaker());
    expect(p.forType("uuid")()).toBe("uuid-value");
  });

  it("routes bool type to faker.datatype.boolean", () => {
    const p = createFakerProvider(stubFaker());
    expect(p.forType("bool")()).toBe(true);
  });

  it("routes email columns by name to faker.internet.email", () => {
    const p = createFakerProvider(stubFaker());
    const gen = p.forName("email", "text");
    expect(gen).not.toBeNull();
    expect(gen!()).toBe("a@b.com");
  });

  it("returns null for an unrecognized column name", () => {
    const p = createFakerProvider(stubFaker());
    expect(p.forName("totally_unknown", "text")).toBeNull();
  });

  it("forwards seed() to faker.seed()", () => {
    const faker = stubFaker();
    const p = createFakerProvider(faker);
    p.seed(99);
    expect(faker.seed).toHaveBeenCalledWith(99);
  });
});
