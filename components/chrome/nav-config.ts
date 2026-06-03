import {
  Home,
  Workflow,
  FlaskConical,
  BookOpen,
  LayoutTemplate,
  type LucideIcon,
} from "lucide-react";

/**
 * Primary destinations surfaced in the floating nav dock — the always-visible
 * primary nav. The full site is reachable via the breadcrumb and the ⌘K command
 * palette; this list stays deliberately small.
 */
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Custom active matcher; defaults to exact / prefix match on `href`. */
  match?: (pathname: string) => boolean;
}

export const navItems: NavItem[] = [
  { label: "Home", href: "/", icon: Home, match: (p) => p === "/" },
  {
    label: "How it works",
    href: "/how-it-works",
    icon: Workflow,
    match: (p) => p.startsWith("/how-it-works"),
  },
  {
    label: "Playground",
    href: "/playground",
    icon: FlaskConical,
    match: (p) => p.startsWith("/playground"),
  },
  {
    label: "Docs",
    href: "/docs",
    icon: BookOpen,
    match: (p) => p.startsWith("/docs"),
  },
  {
    label: "Examples",
    href: "/examples",
    icon: LayoutTemplate,
    match: (p) => p.startsWith("/examples"),
  },
];

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(item.href + "/");
}
