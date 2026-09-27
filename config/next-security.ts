type SecurityHeadersOptions = {
  allowCamera: boolean;
};

export function createSecurityHeaders({
  allowCamera,
}: SecurityHeadersOptions): Array<{ key: string; value: string }> {
  const isProduction = process.env.NODE_ENV === "production";
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "frame-ancestors https://*.feishu.cn https://*.larksuite.com",
    // 注意：飞书H5 SDK需要使用eval()，因此必须包含'unsafe-eval'
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://lf-scm-cn.feishucdn.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://*.feishu.cn https://*.larksuite.com${isProduction ? "" : " http://127.0.0.1:6660 ws:"}`,
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
    {
      key: "Permissions-Policy",
      value: `camera=${allowCamera ? "(self)" : "()"}, microphone=(), geolocation=()`,
    },
    ...(isProduction
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ]
      : []),
  ];
}
