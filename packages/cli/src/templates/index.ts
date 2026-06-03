import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "templates");

export async function readTemplate(name: string): Promise<string> {
  const filePath = join(TEMPLATES_DIR, name);
  return readFile(filePath, "utf8");
}

export const SEED_TEMPLATE = `import type { FakebaseConfig } from "@fakebase/cli";

// Seed data inserted when running \`fakebase seed run\`
export default async function seed(_client: unknown) {
  // Example:
  // await _client.from('profiles').insert([
  //   { username: 'alice', full_name: 'Alice Example' },
  // ]);
}
`;

export const GITIGNORE_ENTRY = `
# Fakebase local data (dev-only)
.fakebase/
`;
