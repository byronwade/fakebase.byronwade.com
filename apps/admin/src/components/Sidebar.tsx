"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Database,
  Users,
  HardDrive,
  Radio,
  Shield,
  GitBranch,
  Code2,
  Zap,
  Sparkles,
} from "lucide-react";

const navItems = [
  {
    href: "/data",
    label: "Data",
    icon: Database,
    description: "Browse and edit table data",
  },
  {
    href: "/auth",
    label: "Auth",
    icon: Users,
    description: "Manage users and sessions",
  },
  {
    href: "/storage",
    label: "Storage",
    icon: HardDrive,
    description: "Manage buckets and files",
  },
  {
    href: "/realtime",
    label: "Realtime",
    icon: Radio,
    description: "Inspect channels and events",
  },
  {
    href: "/policies",
    label: "Policies",
    icon: Shield,
    description: "View RLS policies",
  },
  {
    href: "/migrations",
    label: "Migrations",
    icon: GitBranch,
    description: "Manage schema migrations",
  },
  {
    href: "/types",
    label: "Types",
    icon: Code2,
    description: "Generated TypeScript types",
  },
  {
    href: "/functions",
    label: "Functions",
    icon: Zap,
    description: "Run registered functions",
  },
  {
    href: "/ai",
    label: "AI",
    icon: Sparkles,
    description: "AI tools and prompt generation",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 flex-shrink-0 border-r border-gray-800 bg-gray-950 flex flex-col">
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.description}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  isActive
                    ? "bg-blue-600/15 text-blue-400 border border-blue-600/20"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <Icon
                  className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-blue-400" : "text-gray-500 group-hover:text-gray-300"}`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="px-4 py-4 border-t border-gray-800">
        <div className="text-xs text-gray-600 font-mono">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>localhost:54323</span>
          </div>
          <div className="text-gray-700">fakebase v0.1.0</div>
        </div>
      </div>
    </aside>
  );
}
