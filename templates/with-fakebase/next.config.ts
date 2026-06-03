import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Fakebase kernel is server-only (Node fs/path/crypto). Keep it out of
  // client bundles by only importing `lib/fakebase` from server code, and let
  // Next treat the native sqlite adapter (if used) as an external package.
  serverExternalPackages: ["@fakebase/adapter-sqlite"],
};

export default nextConfig;
