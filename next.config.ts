import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output lets the Dockerfile ship a minimal production server.
  output: "standalone",
  // These packages use runtime `require()` / dynamic imports and are best
  // left unbundled and externalized to node_modules in the standalone build.
  serverExternalPackages: ["simple-git", "octokit"],
};

export default nextConfig;
