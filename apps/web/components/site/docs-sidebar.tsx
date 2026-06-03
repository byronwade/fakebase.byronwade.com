"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { DocMeta } from "@/lib/docs";

export function DocsSidebar({ docs }: { docs: DocMeta[] }) {
  const pathname = usePathname();

  return (
    <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Documentation
      </div>
      <nav className="mt-3 flex flex-col gap-0.5">
        <Link
          href="/docs"
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm transition-colors",
            pathname === "/docs"
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          Overview
        </Link>
        {docs.map((doc) => {
          const href = `/docs/${doc.slug}`;
          const active = pathname === href;
          return (
            <Link
              key={doc.slug}
              href={href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {doc.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
