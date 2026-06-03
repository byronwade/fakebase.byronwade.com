import fs from "node:fs";
import path from "node:path";
import GithubSlugger from "github-slugger";

/** docs/ lives at the repo root (this app is the repo root) and is the single
 *  source of truth for documentation content. Every docs route is statically
 *  generated (SSG, `dynamicParams = false`), so these reads run only at build
 *  time and the rendered HTML is baked into the output — the server bundle never
 *  touches the filesystem at runtime. */
const DOCS_DIR = path.resolve(process.cwd(), "docs");

/** Curated order + friendly titles for the sidebar. */
const ORDER: { slug: string; title: string }[] = [
  { slug: "getting-started", title: "Getting Started" },
  { slug: "architecture", title: "Architecture" },
  { slug: "compatibility-matrix", title: "Compatibility Matrix" },
  { slug: "migration-guide", title: "Migration Guide" },
  { slug: "seeding", title: "Fake Data Generation" },
  { slug: "cli", title: "CLI Reference" },
  { slug: "security", title: "Security" },
  { slug: "ai-rules", title: "AI Rules & Prompts" },
  { slug: "admin-ui", title: "Admin UI" },
];

const SLUG_RE = /^[a-z0-9-]+$/;

export type DocMeta = { slug: string; title: string };
export type Heading = { id: string; text: string; depth: 2 | 3 };

function fileFor(slug: string): string | null {
  if (!SLUG_RE.test(slug)) return null; // guard against path traversal
  const file = path.join(DOCS_DIR, `${slug}.md`);
  // Confirm the resolved path stays inside DOCS_DIR.
  if (!file.startsWith(DOCS_DIR + path.sep)) return null;
  return fs.existsSync(file) ? file : null;
}

/** First H1 in the markdown, used as the doc title fallback. */
function firstH1(md: string): string | null {
  const m = md.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}

export function listDocs(): DocMeta[] {
  const present = new Set<string>();
  const docs: DocMeta[] = [];

  for (const entry of ORDER) {
    if (fileFor(entry.slug)) {
      docs.push(entry);
      present.add(entry.slug);
    }
  }

  // Append any markdown not covered by ORDER, alphabetically.
  if (fs.existsSync(DOCS_DIR)) {
    const extra = fs
      .readdirSync(DOCS_DIR)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""))
      .filter((slug) => SLUG_RE.test(slug) && !present.has(slug))
      .sort();
    for (const slug of extra) {
      const file = fileFor(slug);
      if (!file) continue;
      docs.push({ slug, title: firstH1(fs.readFileSync(file, "utf8")) ?? slug });
    }
  }

  return docs;
}

/** Extract H2/H3 headings with ids matching rehype-slug (github-slugger). */
function extractHeadings(md: string): Heading[] {
  const slugger = new GithubSlugger();
  const headings: Heading[] = [];
  // Ignore headings inside fenced code blocks.
  let inFence = false;
  for (const line of md.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{1,3})\s+(.+?)\s*$/);
    if (!m) continue;
    const depth = m[1].length;
    const text = m[2].replace(/[#*`_]/g, "").trim();
    const id = slugger.slug(text);
    if (depth === 2 || depth === 3) headings.push({ id, text, depth });
    // depth 1 still consumes a slug so duplicates downstream match rehype-slug.
  }
  return headings;
}

export function getDoc(
  slug: string,
): { slug: string; title: string; content: string; headings: Heading[] } | null {
  const file = fileFor(slug);
  if (!file) return null;
  const content = fs.readFileSync(file, "utf8");
  const known = ORDER.find((d) => d.slug === slug);
  const title = known?.title ?? firstH1(content) ?? slug;
  return { slug, title, content, headings: extractHeadings(content) };
}
