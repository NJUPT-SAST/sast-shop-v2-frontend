export function resolveFeedbackFormUrl(
  value: string | undefined,
): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (!isFeishuFormHost(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isFeishuFormHost(hostname: string) {
  return ["feishu.cn", "larksuite.com"].some(
    (root) => hostname === root || hostname.endsWith(`.${root}`),
  );
}
