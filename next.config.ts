import type { NextConfig } from "next";
import os from "os";
import path from "path";

const localDevOrigins = Object.values(os.networkInterfaces())
  .flatMap((networkInterface) => networkInterface ?? [])
  .filter((address) => address.family === "IPv4" && !address.internal)
  .map((address) => address.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: localDevOrigins,
  experimental: {
    preloadEntriesOnStart: false,
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
