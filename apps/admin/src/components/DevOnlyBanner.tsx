"use client";

import { AlertTriangle } from "lucide-react";

export function DevOnlyBanner() {
  return (
    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-4 py-2 text-xs font-mono">
      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
      <span className="font-semibold">FAKEBASE LOCAL/DEV-ONLY</span>
      <span className="text-yellow-500/70 hidden sm:inline">
        — Not for production use. Auth and RLS are approximations.
      </span>
    </div>
  );
}
