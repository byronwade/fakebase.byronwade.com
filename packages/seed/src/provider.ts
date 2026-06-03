/**
 * The data-provider boundary.
 *
 * A `DataProvider` supplies only *leaf value vocabulary* — single column values
 * keyed by type or by column name. Everything that makes generated data
 * *correct* (FK integrity, enums, unique/nullable handling, insert ordering)
 * lives in the engine, not here. This is what lets `@faker-js/faker` drop in as
 * an alternative provider without re-implementing the engine.
 */

import type { ColumnType } from "@fakebase/core";
import { createRng } from "./rng.js";

/** A generator produces one column value per call. */
export type ValueGenerator = () => unknown;

export interface DataProvider {
  /** Reseed the provider's RNG so output is deterministic. */
  seed(n: number): void;
  /** A generator for a raw column type (the type fallback). */
  forType(type: ColumnType): ValueGenerator;
  /** A generator inferred from a column name, or `null` if no semantic match. */
  forName(name: string, type: ColumnType): ValueGenerator | null;
}

// --- Built-in vocabulary (small, curated, zero-dependency) -------------------

const FIRST_NAMES = [
  "Ava", "Liam", "Maya", "Noah", "Zoe", "Kai", "Ivy", "Leo", "Mila", "Eli",
  "Nora", "Owen", "Aria", "Finn", "Luna", "Jude", "Ruby", "Cole", "Iris", "Reed",
];
const LAST_NAMES = [
  "Wade", "Chen", "Patel", "Nguyen", "Kim", "Lopez", "Singh", "Hall", "Reyes",
  "Ito", "Mwangi", "Costa", "Novak", "Okafor", "Diaz", "Park", "Roy", "Cruz",
];
const WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "tempor", "labore", "magna", "aliqua", "veniam", "nostrud", "ullamco",
  "nisi", "aliquip", "commodo", "aute", "irure", "voluptate", "cillum", "fugiat",
];
const DOMAINS = ["example.com", "test.dev", "mail.app", "demo.io", "inbox.co"];
const CITIES = [
  "Austin", "Lisbon", "Osaka", "Nairobi", "Bogotá", "Berlin", "Toronto",
  "Manila", "Oslo", "Cairo", "Lima", "Seoul",
];
const COUNTRIES = [
  "United States", "Portugal", "Japan", "Kenya", "Colombia", "Germany",
  "Canada", "Philippines", "Norway", "Egypt",
];
const COLORS = ["red", "blue", "green", "amber", "violet", "teal", "rose", "slate"];

const HEX = "0123456789abcdef";

/**
 * Create the default, dependency-free data provider.
 */
export function createBuiltinProvider(): DataProvider {
  let rng = createRng(0);

  const float = (): number => rng();
  const int = (min: number, max: number): number =>
    min + Math.floor(rng() * (max - min + 1));
  const pick = <T>(arr: readonly T[]): T => arr[int(0, arr.length - 1)]!;
  const words = (n: number): string =>
    Array.from({ length: n }, () => pick(WORDS)).join(" ");
  const slug = (n: number): string =>
    Array.from({ length: n }, () => pick(WORDS)).join("-");
  const titleCase = (s: string): string =>
    s.replace(/\b\w/g, (c) => c.toUpperCase());

  const uuid = (): string => {
    let out = "";
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
      else if (i === 14) out += "4";
      else if (i === 19) out += HEX[(int(0, 15) & 0x3) | 0x8];
      else out += HEX[int(0, 15)];
    }
    return out;
  };

  const pastDate = (): string => {
    // Up to ~2 years in the past, relative to a fixed epoch for determinism.
    const epoch = Date.parse("2026-01-01T00:00:00.000Z");
    const offset = int(0, 730) * 86_400_000 + int(0, 86_399) * 1000;
    return new Date(epoch - offset).toISOString();
  };

  const email = (): string =>
    `${pick(FIRST_NAMES).toLowerCase()}.${pick(LAST_NAMES).toLowerCase()}${int(1, 99)}@${pick(DOMAINS)}`;

  function forType(type: ColumnType): ValueGenerator {
    switch (type) {
      case "bool":
        return () => float() < 0.5;
      case "int4":
        return () => int(0, 1000);
      case "int8":
        return () => int(0, 1_000_000);
      case "float4":
      case "float8":
        return () => Math.round(float() * 10000) / 100;
      case "numeric":
        return () => Math.round(float() * 10000) / 100;
      case "uuid":
        return () => uuid();
      case "timestamptz":
      case "timestamp":
        return () => pastDate();
      case "date":
        return () => pastDate().slice(0, 10);
      case "jsonb":
      case "json":
        return () => ({ note: words(3) });
      case "bytea":
        return () => `\\x${HEX[int(0, 15)]}${HEX[int(0, 15)]}`;
      case "text":
      case "varchar":
      default:
        return () => words(int(2, 6));
    }
  }

  /**
   * Semantic dictionary: ordered list of [name matcher, generator]. The first
   * matching entry wins; falls through to `null` so the engine uses `forType`.
   */
  function forName(name: string, type: ColumnType): ValueGenerator | null {
    const n = name.toLowerCase();
    const numericType =
      type === "numeric" || type === "float4" || type === "float8";

    if (/(^|_)email$/.test(n) || n === "email") return () => email();
    if (/(first_?name|given_?name)/.test(n)) return () => pick(FIRST_NAMES);
    if (/(last_?name|surname|family_?name)/.test(n)) return () => pick(LAST_NAMES);
    if (/user_?name|handle|login/.test(n))
      return () => `${pick(FIRST_NAMES).toLowerCase()}${int(1, 999)}`;
    if (/full_?name|display_?name|(^|_)name$/.test(n))
      return () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    if (/avatar|profile_?image|photo|picture|image_?url|thumbnail/.test(n))
      return () => `https://i.pravatar.cc/150?u=${uuid()}`;
    if (/(url|website|homepage|link|href)$/.test(n) || /(^|_)url$/.test(n))
      return () => `https://${pick(DOMAINS)}/${slug(2)}`;
    if (/slug/.test(n)) return () => slug(int(2, 4));
    if (/title|headline|subject/.test(n)) return () => titleCase(words(int(2, 5)));
    if (/description|summary|bio|about|content|body|excerpt|caption/.test(n))
      return () => titleCase(words(int(8, 20)));
    if (/phone|mobile|tel/.test(n))
      return () => `+1${int(200, 999)}${int(200, 999)}${int(1000, 9999)}`;
    if (/(^|_)city$/.test(n)) return () => pick(CITIES);
    if (/(^|_)country$/.test(n)) return () => pick(COUNTRIES);
    if (/(^|_)color$/.test(n) || /(^|_)colour$/.test(n)) return () => pick(COLORS);
    if (/(^|_)(price|amount|cost|total|balance|salary|fee)(_|$)/.test(n))
      return numericType
        ? () => Math.round(float() * 100000) / 100
        : () => int(1, 100000);
    if (/(^|_)age$/.test(n)) return () => int(18, 80);
    if (/quantity|count|qty|stock/.test(n)) return () => int(0, 500);
    if (/_at$|(^|_)date$/.test(n))
      return type === "date" ? () => pastDate().slice(0, 10) : () => pastDate();

    return null;
  }

  return {
    seed(seedValue: number) {
      rng = createRng(seedValue);
    },
    forType,
    forName,
  };
}
