import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["https-proxy-agent", "ws"],
};

export default nextConfig;
