import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const isProd = process.env.NODE_ENV === "production"

const internalHost = process.env.TAURI_DEV_HOST || "localhost"

// Enable static export for Tauri production builds.
// This makes `pnpm build` generate the `out/` directory that Tauri loads from `src-tauri/tauri.conf.json` (frontendDist: "../out").
const nextConfig: NextConfig = {
  output: "export",
  // Note: This feature is required to use the Next.js Image component in SSG mode.
  // See https://nextjs.org/docs/messages/export-image-api for different workarounds.
  images: {
    unoptimized: true,
  },
  // Configure assetPrefix or else the server won't properly resolve your assets.
  assetPrefix: isProd ? undefined : `http://${internalHost}:3000`,
  // Dev-only proxy: the frontend talks to /api/* and we forward to the Go backend
  // running on :8080. In prod (static export), Nginx handles the same rewrite.
  async rewrites() {
    if (isProd) return []
    const backend = process.env.NEXT_PUBLIC_API_PROXY_TARGET || "http://localhost:8080"
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }]
  },
}

export default withNextIntl(nextConfig)
