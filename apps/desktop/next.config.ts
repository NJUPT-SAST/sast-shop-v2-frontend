import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createSecurityHeaders } from "../../config/next-security";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const securityHeaders = createSecurityHeaders({ allowCamera: false });
const allowedDevOrigins = (() => {
  const configured = process.env.NEXT_PUBLIC_APP_ORIGIN;
  if (!configured) return [];

  try {
    return [new URL(configured).host];
  } catch {
    return [];
  }
})();

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: ["@workspace/ui", "@sast-shop/api", "@sast-shop/domain"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Allow the configured public Host header while running the dev server.
  allowedDevOrigins,
};

export default nextConfig;
