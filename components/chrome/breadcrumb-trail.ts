import { searchIndex } from "@/lib/search-index";

export type Crumb = { label: string; href: string };

function titleCase(seg: string) {
  return seg.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Friendly label for a route, from the search index when known. */
function labelFor(href: string, fallbackSeg: string): string {
  return searchIndex.find((e) => e.href === href)?.label ?? titleCase(fallbackSeg);
}

/**
 * Breadcrumb trail derived purely from the pathname so it's stable from SSR
 * (no hydration pop). A root crumb plus each path segment, with friendly labels
 * pulled from the search index. De-duplicated by href.
 */
export function resolveTrail(pathname: string): Crumb[] {
  const root: Crumb = { label: "Fakebase", href: "/" };
  if (pathname === "/") return [root];

  const parts = pathname.split("/").filter(Boolean);
  const trail: Crumb[] = [root];
  let acc = "";
  for (const seg of parts) {
    acc += `/${seg}`;
    trail.push({ label: labelFor(acc, seg), href: acc });
  }
  return dedupe(trail);
}

function dedupe(crumbs: Crumb[]): Crumb[] {
  const seen = new Set<string>();
  return crumbs.filter((c) => {
    if (seen.has(c.href)) return false;
    seen.add(c.href);
    return true;
  });
}
