import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@chat-adapter/discord", "discord.js", "zlib-sync"],
};

export default nextConfig;
