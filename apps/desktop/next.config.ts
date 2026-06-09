import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@sast-shop/api", "@sast-shop/domain"],
}

export default nextConfig
