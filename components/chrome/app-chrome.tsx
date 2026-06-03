"use client";

import { AppLauncher } from "./app-launcher";
import { AppBreadcrumb } from "./app-breadcrumb";
import { DockToolbar } from "./dock-toolbar";
import { NavDock } from "./nav-dock";

/**
 * The global floating shell. The top-left **header group** pins to the window
 * corner and holds two matched-sibling overlays — the identity launcher and the
 * breadcrumb pill. The contextual toolbar pins top-right; the primary nav dock
 * floats centered (top on sm+, bottom on phones). `pointer-events-none` on the
 * group keeps the gap from blocking content; each pill re-enables its own events.
 */
export function AppChrome() {
  return (
    <>
      <div className="pointer-events-none fixed top-3 left-3 z-50 flex items-start gap-2 print:hidden">
        <AppLauncher />
        <AppBreadcrumb />
      </div>
      <DockToolbar />
      <NavDock />
    </>
  );
}
