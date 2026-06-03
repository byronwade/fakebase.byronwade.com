"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Heading } from "@/lib/docs";

export function DocsToc({ headings }: { headings: Heading[] }) {
  const [active, setActive] = React.useState<string>("");

  React.useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "0px 0px -75% 0px", threshold: 1 },
    );
    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav className="hidden xl:block">
      <div className="sticky top-20">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          On this page
        </div>
        <ul className="mt-3 space-y-1.5 border-l border-border text-sm">
          {headings.map((h) => (
            <li key={h.id} style={{ paddingLeft: h.depth === 3 ? 20 : 12 }}>
              <a
                href={`#${h.id}`}
                className={cn(
                  "-ml-px block border-l border-transparent py-0.5 transition-colors",
                  active === h.id
                    ? "border-brand font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
