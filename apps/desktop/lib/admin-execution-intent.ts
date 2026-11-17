import type { AdminDomain } from "@sast-shop/api";

const pending = new Map<string, string>();
export class AdminExecutionIntentError extends Error {
  constructor() {
    super(
      "浏览器无法保存本次处理标识，尚未提交执行。请启用会话存储后重新打开此操作；当前禁止重复提交。",
    );
    this.name = "AdminExecutionIntentError";
  }
}
function key(userId: string, domain: AdminDomain, previewId: string) {
  return `sast-shop:admin-execution:v1:${JSON.stringify([userId, domain, previewId])}`;
}
function valid(value: string | null | undefined): value is string {
  return Boolean(value && /^[^\s\u0000-\u001f]{1,128}$/.test(value));
}

/** Persist intent before the first write, including when Execute never reaches the server. */
export function getAdminExecutionRequestId(
  userId: string,
  domain: AdminDomain,
  previewId: string,
  serverRequestId?: string,
) {
  if (!userId || !previewId) throw new AdminExecutionIntentError();
  const storageKey = key(userId, domain, previewId);
  if (valid(serverRequestId)) {
    pending.set(storageKey, serverRequestId);
    try {
      window.sessionStorage.setItem(storageKey, serverRequestId);
    } catch {
      /* The server already holds the durable identifier. */
    }
    return serverRequestId;
  }
  try {
    const storage = window.sessionStorage;
    const stored = storage.getItem(storageKey);
    if (stored !== null && !valid(stored))
      throw new AdminExecutionIntentError();
    const requestId = stored ?? pending.get(storageKey) ?? crypto.randomUUID();
    pending.set(storageKey, requestId);
    storage.setItem(storageKey, requestId);
    if (storage.getItem(storageKey) !== requestId)
      throw new AdminExecutionIntentError();
    return requestId;
  } catch {
    throw new AdminExecutionIntentError();
  }
}

export function clearAdminExecutionRequestId(
  userId: string,
  domain: AdminDomain,
  previewId: string,
) {
  const storageKey = key(userId, domain, previewId);
  pending.delete(storageKey);
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    /* The completed case remains authoritative. */
  }
}
