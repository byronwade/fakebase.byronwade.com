import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@fakebase/adapter-sqlite"],
};

export default nextConfig;
