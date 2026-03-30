import type { NextConfig } from "next";

// Server-side API URL for Next route handlers and rewrites.
// Default to the colocated API process in production containers.
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  // Only expose the public API URL when it is explicitly configured.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "",
  },

  async rewrites() {
    return [
      {
        source: "/socket.io/:path*",
        destination: `${API_URL}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
