export const imageConfig = {
  remotePatterns: [{ protocol: "https" as const, hostname: "**", port: "" }],
  localPatterns: [
    { pathname: "/api/images/products/*", search: "" },
    { pathname: "/brand/**", search: "" },
    { pathname: "/_next/static/media/**", search: "" },
  ],
  qualities: [35, 75],
  imageSizes: [32, 48, 64, 96, 128, 192, 256, 384],
  deviceSizes: [640, 750, 828, 1080, 1280],
  minimumCacheTTL: 86400,
  maximumRedirects: 0,
  maximumResponseBody: 10 * 1024 * 1024,
  dangerouslyAllowLocalIP: false,
  dangerouslyAllowSVG: false,
};
