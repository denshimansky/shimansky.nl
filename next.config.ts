import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [{ source: "/collection", destination: "/collection/index.html" }];
  },
};

export default nextConfig;
