import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DuckDB loads a platform-specific native binary at runtime.
  // Keep it out of Turbopack's server bundle so Node resolves that binary.
  serverExternalPackages: ["@mastra/duckdb"],
};

export default nextConfig;
