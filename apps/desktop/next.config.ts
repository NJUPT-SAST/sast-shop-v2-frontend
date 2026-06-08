import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: [
    "@workspace/ui",
    "@sast-shop/api",
    "@sast-shop/domain",
    "@sast-shop/mocks",
  ],
}

export default nextConfig
