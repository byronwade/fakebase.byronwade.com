/**
 * @fakebase/seed-faker — a {@link DataProvider} backed by `@faker-js/faker`.
 *
 * This package has no hard dependency on Faker. You pass your own faker
 * instance in, so the version and locale are entirely yours:
 *
 * ```ts
 * import { faker } from "@faker-js/faker";
 * import { createFakerProvider } from "@fakebase/seed-faker";
 * await seedClient(client, schema, { provider: createFakerProvider(faker) });
 * ```
 */

import type { ColumnType } from "@fakebase/core";
import type { DataProvider, ValueGenerator } from "@fakebase/seed";

/**
 * The minimal slice of the `@faker-js/faker` API this provider uses. Declared
 * structurally so the package builds without Faker installed (Faker is a peer
 * dependency supplied by the caller).
 */
export interface FakerLike {
  seed(n: number): void;
  string: { uuid(): string };
  number: {
    int(opts?: { min?: number; max?: number }): number;
    float(opts?: { min?: number; max?: number; fractionDigits?: number }): number;
  };
  datatype: { boolean(): boolean };
  date: { past(opts?: { years?: number; refDate?: string | Date }): Date };
  lorem: {
    words(n?: number): string;
    sentence(): string;
    slug(n?: number): string;
  };
  internet: {
    email(): string;
    url(): string;
    username(): string;
  };
  image: { avatar(): string };
  person: {
    firstName(): string;
    lastName(): string;
    fullName(): string;
  };
  location: { city(): string; country(): string };
  phone: { number(): string };
  commerce: { price(): string };
}

/** Build a Fakebase data provider from a Faker instance. */
export function createFakerProvider(faker: FakerLike): DataProvider {
  // Fixed reference date so generated dates are deterministic — faker.date.past()
  // otherwise defaults its reference to the current time.
  const FIXED_REF = "2026-01-01T00:00:00.000Z";

  function forType(type: ColumnType): ValueGenerator {
    switch (type) {
      case "bool":
        return () => faker.datatype.boolean();
      case "int4":
        return () => faker.number.int({ min: 0, max: 1000 });
      case "int8":
        return () => faker.number.int({ min: 0, max: 1_000_000 });
      case "float4":
      case "float8":
      case "numeric":
        return () => faker.number.float({ min: 0, max: 1000, fractionDigits: 2 });
      case "uuid":
        return () => faker.string.uuid();
      case "timestamptz":
      case "timestamp":
        return () => faker.date.past({ refDate: FIXED_REF }).toISOString();
      case "date":
        return () => faker.date.past({ refDate: FIXED_REF }).toISOString().slice(0, 10);
      case "jsonb":
      case "json":
        return () => ({ note: faker.lorem.words(3) });
      case "text":
      case "varchar":
      default:
        return () => faker.lorem.words(4);
    }
  }

  function forName(name: string, type: ColumnType): ValueGenerator | null {
    const n = name.toLowerCase();
    const numericType =
      type === "numeric" || type === "float4" || type === "float8";

    if (/(^|_)email$/.test(n)) return () => faker.internet.email();
    if (/(first_?name|given_?name)/.test(n)) return () => faker.person.firstName();
    if (/(last_?name|surname|family_?name)/.test(n))
      return () => faker.person.lastName();
    if (/user_?name|handle|login/.test(n)) return () => faker.internet.username();
    if (/full_?name|display_?name|(^|_)name$/.test(n))
      return () => faker.person.fullName();
    if (/avatar|profile_?image|photo|picture|image_?url|thumbnail/.test(n))
      return () => faker.image.avatar();
    if (/(url|website|homepage|link|href)$/.test(n) || /(^|_)url$/.test(n))
      return () => faker.internet.url();
    if (/slug/.test(n)) return () => faker.lorem.slug();
    if (/title|headline|subject/.test(n)) return () => faker.lorem.sentence();
    if (/description|summary|bio|about|content|body|excerpt|caption/.test(n))
      return () => faker.lorem.sentence();
    if (/phone|mobile|tel/.test(n)) return () => faker.phone.number();
    if (/(^|_)city$/.test(n)) return () => faker.location.city();
    if (/(^|_)country$/.test(n)) return () => faker.location.country();
    if (/(^|_)(price|amount|cost|total|balance|salary|fee)(_|$)/.test(n))
      return numericType
        ? () => Number(faker.commerce.price())
        : () => faker.number.int({ min: 1, max: 100000 });
    if (/(^|_)age$/.test(n)) return () => faker.number.int({ min: 18, max: 80 });
    if (/quantity|count|qty|stock/.test(n))
      return () => faker.number.int({ min: 0, max: 500 });
    if (/_at$|(^|_)date$/.test(n))
      return type === "date"
        ? () => faker.date.past({ refDate: FIXED_REF }).toISOString().slice(0, 10)
        : () => faker.date.past({ refDate: FIXED_REF }).toISOString();

    return null;
  }

  return {
    seed: (n) => faker.seed(n),
    forType,
    forName,
  };
}

/**
 * Dynamically import the caller's installed `@faker-js/faker` and wrap it.
 * Rejects (so callers can show an actionable message) when Faker isn't
 * installed. The specifier is held in a variable so the build does not require
 * Faker to be present.
 */
export async function loadFakerProvider(): Promise<DataProvider> {
  const spec = "@faker-js/faker";
  const mod = (await import(spec)) as { faker: FakerLike };
  return createFakerProvider(mod.faker);
}
