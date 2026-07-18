import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createSecurityHeaders } from "../../config/next-security";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const securityHeaders = createSecurityHeaders({ allowCamera: false });

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: ["@workspace/ui", "@sast-shop/api", "@sast-shop/domain"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
