"use client";

import * as React from "react";
import { ChevronsLeftRight, GripHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { useChromeMorph } from "@/lib/use-chrome-morph";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

const EASE = "cubic-bezier(.22,1,.36,1)";

/**
 * A single navigable item in the dock. Mirrors a route/tab but stays generic —
 * the dock never knows about routing; the consumer wires `onSelect`/`href` and
 * the active/badge state.
 */
export interface MorphDockItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect?: () => void;
  href?: string;
  /** Current page → `aria-current="page"` + active fill. */
  active?: boolean;
  /** Always visible, even compact (the few primary destinations). */
  core?: boolean;
  /** Always visible AND pinned to the trailing end (e.g. Settings). */
  pinned?: boolean;
  /** Unread/count → a small brand dot (>0) when set. */
  badge?: number;
}

export type MorphDockPlacement = "top" | "bottom" | "left" | "right";

export interface MorphDockProps {
  items: MorphDockItem[];
  /** Allow compact ↔ full toggling. Default true. */
  expandable?: boolean;
  /** Custom trailing slot (count + badge, env tag, search button…). */
  cluster?: React.ReactNode;
  /** A contextual action pill — blooms the panel when `children` exist, else runs onSelect. */
  action?: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onSelect?: () => void;
  };
  /** Dark dock pill (default) or light surface. */
  tone?: "dock" | "surface";
  navLabel?: string;
  className?: string;

  /** Controlled morph — when open, the dock blooms into `children`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The panel the dock morphs into (a search, form, flow…). */
  children?: React.ReactNode;
  /** Open-panel width in px. Default 360. */
  panelWidth?: number;
  /** Open-panel height in px. Omit to size to content (bloom-down). */
  panelHeight?: number;
  /** Bloom width + height (default) or width-only. */
  growHeight?: boolean;
  /** Which way the panel blooms from the bar. Default "bottom". */
  placement?: MorphDockPlacement;
  /** Drag the open panel free of the dock by its handle. */
  draggable?: boolean;
  /** Show a corner grip to resize the open panel. */
  resizable?: boolean;
}

/** dragWrap + panel anchor per placement — sets the bloom direction. */
const ANCHOR: Record<MorphDockPlacement, string> = {
  bottom: "left-0 top-0",
  top: "left-0 bottom-0",
  right: "left-0 top-0",
  left: "right-0 top-0",
};

function isVisible(item: MorphDockItem, expanded: boolean): boolean {
  return expanded || !!item.core || !!item.pinned || !!item.active;
}

const PILL =
  "relative flex size-8 shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/30";
const PILL_IDLE = "text-dock-foreground hover:bg-dock-active hover:text-dock-active-foreground";
const PILL_ACTIVE = "bg-dock-active text-dock-active-foreground";

function DockItem({ item, collapsed }: { item: MorphDockItem; collapsed: boolean }) {
  const Icon = item.icon;
  const hasBadge = typeof item.badge === "number" && item.badge > 0;

  const inner = (
    <>
      <Icon className="size-4 shrink-0" />
      <span className="sr-only">{item.label}</span>
      {hasBadge ? (
        <span
          aria-hidden
          className="absolute right-1 top-1 size-2 rounded-full bg-brand ring-2 ring-dock"
        />
      ) : null}
    </>
  );

  const className = cn(PILL, item.active ? PILL_ACTIVE : PILL_IDLE);
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    item.onSelect?.();
  };

  const content =
    item.href !== undefined ? (
      <a
        href={item.href}
        title={item.label}
        aria-label={item.label}
        aria-current={item.active ? "page" : undefined}
        onClick={onClick}
        className={className}
      >
        {inner}
      </a>
    ) : (
      <button
        type="button"
        title={item.label}
        aria-label={item.label}
        aria-current={item.active ? "page" : undefined}
        onClick={onClick}
        className={className}
      >
        {inner}
      </button>
    );

  return (
    <div
      className={cn(
        "flex shrink-0 items-center overflow-hidden",
        "transition-[width,opacity,transform] duration-300 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none",
        collapsed ? "w-0 scale-50 opacity-0" : "w-8 scale-100 opacity-100",
      )}
      aria-hidden={collapsed}
    >
      {content}
    </div>
  );
}

/**
 * Config-driven morphing navigation dock. The item row morphs compact ↔ full,
 * and the whole pill blooms in place — via the shared `useChromeMorph` hook —
 * into a consumer `children` panel, then shrinks cleanly back. The panel can
 * bloom in any direction (`placement`), detach + drag free (`draggable`), and
 * resize from a corner grip (`resizable`). Pure `--dock` tokens; reduced-motion,
 * Esc, and click-away handled. A SLOT reserves the collapsed footprint so the
 * bloom overlays neighbours instead of shoving them.
 */
export function MorphDock({
  items,
  expandable = true,
  cluster,
  action,
  tone = "dock",
  navLabel = "Primary",
  className,
  open: openProp,
  onOpenChange,
  children,
  panelWidth = 360,
  panelHeight,
  growHeight = true,
  placement = "bottom",
  draggable = false,
  resizable = false,
}: MorphDockProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [openUncontrolled, setOpenUncontrolled] = React.useState(false);
  const open = openProp ?? openUncontrolled;
  const setOpen = React.useCallback(
    (v: boolean) => {
      setOpenUncontrolled(v);
      onOpenChange?.(v);
    },
    [onOpenChange],
  );

  // Resized panel box (null → use the panelWidth / panelHeight defaults).
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const dragWrapRef = React.useRef<HTMLDivElement>(null);
  const morphRef = React.useRef<HTMLDivElement>(null);
  const barRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef({ x: 0, y: 0 });

  const hasPanel = children != null;
  const morphOpen = open && hasPanel;

  const panelW = size?.w ?? panelWidth;
  const panelH = size?.h ?? panelHeight;

  // Slot: reserve the collapsed pill footprint so the absolute bloom overlays
  // neighbours rather than reflowing the row.
  const [slot, setSlot] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useIsoLayoutEffect(() => {
    const bar = barRef.current;
    const morph = morphRef.current;
    if (!bar || !morph) return;
    const sync = () => {
      if (morph.style.width) return; // morphed open — leave the slot
      setSlot({ w: morph.offsetWidth, h: morph.offsetHeight });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  useChromeMorph({
    morphRef,
    restRef: barRef,
    panelRef,
    open: morphOpen,
    growHeight,
    width: () => panelW,
    height: panelH != null ? () => panelH : undefined,
    deps: [open, hasPanel, panelW, panelH],
  });

  // The hook fades the bar OUT + panel IN on open but leaves the inline opacity
  // (and we leave the drag transform) on close. Clear them whenever not morphed
  // open so the bar returns, the panel hides, and a dragged panel flies home.
  useIsoLayoutEffect(() => {
    if (morphOpen) return;
    if (barRef.current) barRef.current.style.opacity = "";
    if (panelRef.current) panelRef.current.style.opacity = "";
    const wrap = dragWrapRef.current;
    if (wrap && (dragRef.current.x !== 0 || dragRef.current.y !== 0)) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      wrap.style.transition = reduce ? "none" : `transform 240ms ${EASE}`;
      wrap.style.transform = "";
      dragRef.current = { x: 0, y: 0 };
    }
  });

  // Drop any resize when fully closed so the next open starts at the default box.
  React.useEffect(() => {
    if (!open) setSize(null);
  }, [open]);

  // Esc + click-away close the morphed panel.
  React.useEffect(() => {
    if (!open || !hasPanel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, hasPanel, setOpen]);

  // Free drag — transform lives on the wrapper (not the morph) so the size morph
  // and the drag never fight. Written imperatively: dragging never re-renders.
  const onDragStart = (e: React.PointerEvent) => {
    if (!draggable) return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const orig = { ...dragRef.current };
    const wrap = dragWrapRef.current;
    if (wrap) wrap.style.transition = "none";
    const move = (ev: PointerEvent) => {
      dragRef.current = { x: orig.x + (ev.clientX - sx), y: orig.y + (ev.clientY - sy) };
      if (wrap) wrap.style.transform = `translate(${dragRef.current.x}px, ${dragRef.current.y}px)`;
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  // Corner resize — adjusts the panel box; the hook follows via `size` in deps.
  const onResizeStart = (e: React.PointerEvent) => {
    if (!resizable) return;
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    const sw = panelW;
    const sh = panelRef.current?.offsetHeight ?? panelHeight ?? 240;
    const move = (ev: PointerEvent) => {
      setSize({
        w: Math.max(240, Math.round(sw + (ev.clientX - sx))),
        h: Math.max(140, Math.round(sh + (ev.clientY - sy))),
      });
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  const mainItems = items.filter((i) => !i.pinned);
  const pinnedItems = items.filter((i) => i.pinned);
  const hasCollapsible = items.some((i) => !i.core && !i.pinned);
  const showToggle = expandable && hasCollapsible;
  const ActionIcon = action?.icon;

  return (
    <div
      ref={rootRef}
      style={{ width: slot.w || undefined, height: slot.h || undefined }}
      className={cn("relative inline-block", className)}
    >
      <div ref={dragWrapRef} className={cn("absolute", ANCHOR[placement])}>
        <div
          ref={morphRef}
          className={cn(
            "transform-gpu overflow-hidden p-[3px] [will-change:width,height]",
            open ? "rounded-2xl" : "rounded-full",
            tone === "dock"
              ? "bg-dock text-dock-foreground shadow-float"
              : "border border-border bg-card text-foreground shadow-card",
          )}
        >
          {/* BAR — the resting item row (fades out as the panel blooms in). */}
          <div
            ref={barRef}
            className={cn(
              "flex items-center gap-1 transition-opacity duration-150",
              morphOpen && "pointer-events-none",
            )}
          >
            <nav aria-label={navLabel} className="flex items-center gap-1">
              {mainItems.map((item) => (
                <DockItem key={item.id} item={item} collapsed={!isVisible(item, expanded)} />
              ))}

              {showToggle ? (
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={expanded ? "Show fewer" : "Show all"}
                  title={expanded ? "Show fewer" : "Show all"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded((v) => !v);
                  }}
                  className={cn(PILL, expanded ? PILL_ACTIVE : PILL_IDLE)}
                >
                  <ChevronsLeftRight className="size-4 shrink-0" />
                  <span className="sr-only">{expanded ? "Show fewer" : "Show all"}</span>
                </button>
              ) : null}

              {pinnedItems.map((item) => (
                <DockItem key={item.id} item={item} collapsed={!isVisible(item, expanded)} />
              ))}
            </nav>

            {cluster ? <div className="flex shrink-0 items-center">{cluster}</div> : null}

            {action && ActionIcon ? (
              <button
                type="button"
                aria-haspopup={hasPanel ? "dialog" : undefined}
                aria-expanded={hasPanel ? open : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasPanel) setOpen(true);
                  action.onSelect?.();
                }}
                className={cn(
                  "ml-1 flex h-8 shrink-0 items-center gap-2 rounded-full px-3 text-[13px] font-semibold",
                  "bg-dock-active text-dock-active-foreground outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-white/30",
                )}
              >
                <ActionIcon className="size-4 shrink-0" />
                {action.label}
              </button>
            ) : null}
          </div>

          {/* PANEL — the morph target (consumer content). */}
          {hasPanel ? (
            <div
              ref={panelRef}
              role="dialog"
              aria-label={action?.label ?? "Panel"}
              aria-hidden={!open}
              style={{ width: panelW, height: panelH }}
              className={cn(
                "absolute opacity-0 transition-opacity duration-150 outline-none",
                ANCHOR[placement],
                panelH != null && "overflow-auto",
                open ? "pointer-events-auto" : "pointer-events-none",
              )}
            >
              {draggable ? (
                <button
                  type="button"
                  aria-label="Drag panel"
                  onPointerDown={onDragStart}
                  className="flex w-full cursor-grab touch-none items-center justify-center py-1 text-dock-foreground/50 outline-none transition-colors hover:text-dock-foreground/80 active:cursor-grabbing"
                >
                  <GripHorizontal className="size-4" />
                </button>
              ) : null}

              {children}

              {resizable ? (
                <span
                  role="presentation"
                  onPointerDown={onResizeStart}
                  className="absolute bottom-0 right-0 size-4 cursor-se-resize touch-none"
                >
                  <span className="absolute bottom-1 right-1 size-2 rounded-[2px] border-b-2 border-r-2 border-dock-foreground/40" />
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default MorphDock;
