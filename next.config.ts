import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Hide the "N" dev badge; compile and runtime errors still show.
  devIndicators: false,
  // Rule files are read from disk at runtime (lib/rules/load.ts), so ship them.
  outputFileTracingIncludes: {
    "/*": ["./content/rules/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
