import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { NAV_LINKS, REPO_URL } from "@/lib/site-data";
import { Logo } from "@/components/site/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/30">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm space-y-3">
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold tracking-tight"
            >
              <Logo className="size-5 text-brand" />
              Fakebase
            </Link>
            <p className="text-sm text-muted-foreground">
              An open-source, Supabase-shaped, local/dev-only development platform that
              runs anywhere @supabase/supabase-js does. Build at zero-setup speed, then
              export real Supabase artifacts when you ship.
            </p>
          </div>

          <nav className="flex flex-col gap-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Explore
            </span>
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              GitHub
            </a>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5">
            <TriangleAlert className="size-3.5 text-warning" />
            Dev-only — not production auth, authorization, or infrastructure. Always run{" "}
            <code className="font-mono text-foreground">fakebase verify supabase</code>.
          </p>
          <p>MIT © Byron Wade</p>
        </div>
      </div>
    </footer>
  );
}
