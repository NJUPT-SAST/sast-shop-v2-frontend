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
    :root { color-scheme: light; --background: #f6f3ef; --foreground: #1d1d1f; --card: #fff; --border: #e3dcd4; --muted-foreground: #6e6e73; --primary: #c9431f; --primary-foreground: #fff; }
    @media (prefers-color-scheme: dark) {
      :root { color-scheme: dark; --background: #111114; --foreground: #f5f5f7; --card: #1b1b20; --border: #303038; --muted-foreground: #a1a1aa; --primary: #ff9a78; --primary-foreground: #2b1008; }
    }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--background); color: var(--foreground); }
    main { width: min(420px, calc(100vw - 48px)); border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 28px; box-shadow: 0 16px 48px rgb(0 0 0 / 12%); }
    h1 { margin: 0 0 12px; font-size: 22px; line-height: 1.3; }
    p { margin: 0 0 20px; color: var(--muted-foreground); line-height: 1.7; }
    a { display: inline-flex; min-height: 40px; align-items: center; border-radius: 6px; background: var(--primary); padding: 0 16px; color: var(--primary-foreground); text-decoration: none; font-weight: 600; }
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
