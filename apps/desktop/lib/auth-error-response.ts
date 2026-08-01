import "server-only";

import { NextResponse } from "next/server";

export function createAuthErrorResponse({
  title,
  description,
  status,
  retryHref = "/api/auth/lark/authorize",
}: {
  title: string;
  description: string;
  status: number;
  retryHref?: string;
}) {
  return new NextResponse(
    `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #1f2329; }
    main { width: min(420px, calc(100vw - 48px)); border: 1px solid #dee0e3; border-radius: 8px; background: #fff; padding: 28px; box-shadow: 0 16px 48px rgb(31 35 41 / 8%); }
    h1 { margin: 0 0 12px; font-size: 22px; line-height: 1.3; }
    p { margin: 0 0 20px; color: #646a73; line-height: 1.7; }
    a { display: inline-flex; min-height: 40px; align-items: center; border-radius: 6px; background: #0071e3; padding: 0 16px; color: #fff; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <a href="${escapeHtml(retryHref)}">重新登录</a>
  </main>
</body>
</html>`,
    {
      status,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/html; charset=utf-8",
      },
    },
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
