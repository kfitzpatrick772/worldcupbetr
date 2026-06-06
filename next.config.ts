import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray package-lock.json in the home dir otherwise
  // makes Next infer the wrong root. This file's dir is the project root.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
