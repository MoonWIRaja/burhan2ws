import type { NextConfig } from "next";

// API URL configuration - read from environment at build time
// This ensures Socket.io connects to the correct server
const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "https://api-dev.owlscottage.com";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  // Inject API URL as runtime config so it's available in client code
  env: {
    NEXT_PUBLIC_API_URL: API_URL,
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
