// Thin fetch wrapper. Single owner of:
//   - base URL + cookie credentials
//   - JSON serialization
//   - Idempotency-Key injection on order creation
//   - 401 -> onUnauthorized callback (registered by providers.tsx)
//   - error normalisation into ApiError

import { ApiError, type ApiErrorBody } from "./errors"

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
  headers?: Record<string, string>
  signal?: AbortSignal
  // Auto-attach an Idempotency-Key header. Only used by useCreateOrder.
  idempotent?: boolean
}

let onUnauthorized: (() => void) | null = null

export function registerUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

function getBaseUrl(): string {
  // Same-origin /api works in dev (rewrites proxy to :8080) and behind Nginx in prod.
  // Override via NEXT_PUBLIC_API_URL when calling a different host (e.g. Tauri prod build).
  const override = process.env.NEXT_PUBLIC_API_URL
  if (override && override.length > 0) return override.replace(/\/$/, "")
  return "/api"
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = getBaseUrl()
  const url = path.startsWith("http") ? path : `${base}${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue
    params.set(k, String(v))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function parseError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> = {}
  try {
    body = (await res.json()) as Partial<ApiErrorBody>
  } catch {
    // Non-JSON error response — fall back to status only.
  }
  return new ApiError({
    code: body.code || `HTTP_${res.status}`,
    message: body.message || res.statusText || "Request failed",
    status: body.status || res.status,
    details: body.details,
    request_id: body.request_id,
  })
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, headers = {}, signal, idempotent } = options

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  }
  let serializedBody: BodyInit | undefined
  if (body !== undefined) {
    finalHeaders["Content-Type"] = finalHeaders["Content-Type"] ?? "application/json"
    serializedBody = JSON.stringify(body)
  }
  if (idempotent && !finalHeaders["Idempotency-Key"]) {
    finalHeaders["Idempotency-Key"] = newIdempotencyKey()
  }

  const res = await fetch(buildUrl(path, query), {
    method,
    headers: finalHeaders,
    body: serializedBody,
    credentials: "include",
    signal,
  })

  if (res.status === 401) {
    onUnauthorized?.()
    throw await parseError(res)
  }

  if (!res.ok) {
    throw await parseError(res)
  }

  if (res.status === 204) {
    return undefined as T
  }

  const ct = res.headers.get("content-type") ?? ""
  if (!ct.includes("application/json")) {
    return undefined as T
  }
  return (await res.json()) as T
}

// Convenience helpers — the hook layer (queries.ts) is the only allowed caller
// for these so business components can stay declarative.
export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "PUT", body }),
  del: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "DELETE", body }),
}
