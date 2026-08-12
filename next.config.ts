import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: isGitHubPages ? "/Dent-memo-app" : "",
  assetPrefix: isGitHubPages ? "/Dent-memo-app/" : "",
};

export default nextConfig;
