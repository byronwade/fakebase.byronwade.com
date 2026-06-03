import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { DevOnlyBanner } from "@/components/DevOnlyBanner";

export const metadata: Metadata = {
  title: "Fakebase Admin",
  description: "Local dev-only admin UI for Fakebase",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full bg-gray-950 text-white antialiased">
        <div className="flex flex-col h-full">
          {/* Top header bar */}
          <header className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-950 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">F</span>
                </div>
                <span className="font-semibold text-white tracking-tight">
                  Fakebase Admin
                </span>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 animate-pulse-slow">
                ⚠ DEV-ONLY
              </span>
            </div>
            <DevOnlyBanner />
          </header>

          {/* Main layout: sidebar + content */}
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto bg-gray-950">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
