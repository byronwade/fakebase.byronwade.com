"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { resolveTrail, type Crumb } from "./breadcrumb-trail";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/** Room reserved around the centered nav dock so the breadcrumb never crowds it.
 *  The dock shows text labels only at ≥xl (1280) and is a narrow icon row below
 *  that, so the reserve tracks the breakpoint — generous when labels widen the
 *  pill, tight when it's just icons (giving the breadcrumb its room back). */
function navReserve(viewportWidth: number): number {
  return viewportWidth >= 1280 ? 920 : 380;
}
const GAP = 12;

/**
 * The breadcrumb — a matched-sibling overlay in the top-left header group, sharing
 * the corner-pill material with the launcher (40px, dark `--dock`, `rounded-3xl`).
 * The collapse budget is computed from STABLE inputs only (viewport width, its
 * pinned left edge, the nav reserve). Renders the full trail responsively —
 * collapsing to `root / … / current` on desktop and `‹ Current` on mobile.
 */
export function AppBreadcrumb() {
  const pathname = usePathname();
  const crumbs = resolveTrail(pathname);
  const trailKey = crumbs.map((c) => `${c.href}|${c.label}`).join(">");

  const rootRef = React.useRef<HTMLOListElement>(null);
  const twinRef = React.useRef<HTMLOListElement>(null);
  const [{ collapsed, maxW }, setFit] = React.useState<{
    collapsed: boolean;
    maxW: number;
  }>({ collapsed: false, maxW: Number.POSITIVE_INFINITY });

  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    const twin = twinRef.current;
    if (!root || !twin) return;
    const compute = () => {
      const W = window.innerWidth;
      const left = root.getBoundingClientRect().left;
      const budget = Math.max(0, W / 2 - navReserve(W) / 2 - GAP - left);
      const full = twin.scrollWidth;
      setFit({ collapsed: full > budget && crumbs.length >= 3, maxW: budget });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(twin);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [trailKey, crumbs.length]);

  if (crumbs.length <= 1) return null;

  const last = crumbs[crumbs.length - 1];
  const parent = crumbs[crumbs.length - 2];
  const middle = crumbs.slice(1, -1);

  return (
    <nav
      aria-label="Breadcrumb"
      className="pointer-events-auto relative z-0 flex h-[40px] items-center overflow-hidden rounded-3xl border border-white/5 bg-dock px-4 text-[13px] shadow-float"
    >
      {/* DESKTOP — full trail, collapsing to root / … / current. */}
      <ol
        ref={rootRef}
        style={maxW === Number.POSITIVE_INFINITY ? undefined : { maxWidth: maxW }}
        className="hidden min-w-0 items-center gap-1.5 xl:flex"
      >
        {collapsed ? (
          <>
            <CrumbLink crumb={crumbs[0]} />
            <Sep />
            <li className="flex shrink-0 items-center">
              <Popover>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Show hidden breadcrumb levels"
                      className="flex size-6 items-center justify-center rounded-md text-dock-foreground outline-none transition-colors hover:bg-dock-active hover:text-dock-active-foreground focus-visible:ring-2 focus-visible:ring-white/30"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  }
                />
                <PopoverContent
                  align="start"
                  sideOffset={8}
                  className="flex w-auto min-w-44 flex-col gap-0.5 rounded-xl border border-white/5 bg-dock p-1.5 text-dock-foreground ring-0"
                >
                  {middle.map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      className="truncate rounded-lg px-2.5 py-1.5 text-[13px] text-dock-active-foreground/85 transition-colors hover:bg-dock-active hover:text-dock-active-foreground"
                    >
                      {c.label}
                    </Link>
                  ))}
                </PopoverContent>
              </Popover>
            </li>
            <Sep />
            <CrumbLink crumb={last} current />
          </>
        ) : (
          crumbs.map((c, i) => (
            <React.Fragment key={c.href}>
              {i > 0 && <Sep />}
              <CrumbLink crumb={c} current={i === crumbs.length - 1} />
            </React.Fragment>
          ))
        )}
      </ol>

      {/* COMPACT (below xl) — current only, with a back-chevron to the parent. */}
      <ol className="flex min-w-0 items-center gap-1 xl:hidden">
        {parent && (
          <li className="flex shrink-0 items-center">
            <Link
              href={parent.href}
              aria-label={`Back to ${parent.label}`}
              className="-ml-1 flex size-6 items-center justify-center rounded-md text-dock-foreground transition-colors hover:bg-dock-active hover:text-dock-active-foreground"
            >
              <ChevronLeft className="size-4" strokeWidth={2.5} />
            </Link>
          </li>
        )}
        <li className="min-w-0">
          <span className="truncate font-semibold text-dock-active-foreground">
            {last.label}
          </span>
        </li>
      </ol>

      {/* Hidden measuring twin — always the full desktop row. */}
      <ol
        ref={twinRef}
        aria-hidden
        className="pointer-events-none invisible absolute flex items-center gap-1.5"
      >
        {crumbs.map((c, i) => (
          <React.Fragment key={c.href}>
            {i > 0 && <Sep />}
            <span className={cn("shrink-0", i === crumbs.length - 1 ? "font-semibold" : "")}>
              {c.label}
            </span>
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
}

function CrumbLink({ crumb, current }: { crumb: Crumb; current?: boolean }) {
  return (
    <li className={cn("flex items-center", current ? "min-w-0" : "shrink-0")}>
      <Link
        href={crumb.href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "truncate rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/30",
          current
            ? "font-semibold text-dock-active-foreground"
            : "text-dock-foreground hover:text-dock-active-foreground",
        )}
      >
        {crumb.label}
      </Link>
    </li>
  );
}

function Sep() {
  return (
    <li aria-hidden className="shrink-0 text-dock-foreground/50">
      /
    </li>
  );
}
