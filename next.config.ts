import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/books", destination: "/books/index.html" },
      { source: "/collection", destination: "/collection/index.html" },
    ];
  },
};

export default nextConfig;
