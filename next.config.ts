import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@libsql/client"],
  images: {
    // News/publisher images come from many hosts; they are rendered with
    // plain <img> + lazy loading instead of next/image remote optimisation,
    // so no remotePatterns are required here.
  },
};

export default nextConfig;
