"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Check, Terminal } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const INSTALL_COMMAND = "npm install @byronwade/fakebase";

/**
 * The contextual toolbar, pinned top-right (the inverse corner of the launcher).
 * A docs/marketing site's one always-useful page action is "copy the install
 * command". Kept to a single compact icon button — the corner is contested with
 * the centered nav dock at narrow widths, so it never carries wide text. Hidden
 * on the home page (which has its own prominent install CTA) and on `/playground`
 * (which renders its own app toolbar), mirroring the source's empty-state return.
 */
export function DockToolbar() {
  const pathname = usePathname();
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);

  const hidden = pathname === "/" || pathname.startsWith("/playground");
  if (hidden) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  return (
    <TooltipProvider delay={350}>
      <div className="pointer-events-none fixed top-3 right-3 z-50 print:hidden">
        <div className="pointer-events-auto inline-flex transform-gpu items-center rounded-3xl border border-white/5 bg-dock p-[3px] text-dock-foreground shadow-float">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={copy}
                  aria-label={copied ? "Copied install command" : "Copy install command"}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/30",
                    copied
                      ? "bg-dock-active text-dock-active-foreground"
                      : "text-dock-foreground hover:bg-dock-active hover:text-dock-active-foreground",
                  )}
                />
              }
            >
              {copied ? (
                <Check className="size-4 shrink-0" strokeWidth={2.5} />
              ) : (
                <Terminal className="size-4 shrink-0" strokeWidth={2} />
              )}
            </TooltipTrigger>
            <TooltipContent sideOffset={10}>
              <span className="font-mono text-[12px]">
                {copied ? "Copied!" : INSTALL_COMMAND}
              </span>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
