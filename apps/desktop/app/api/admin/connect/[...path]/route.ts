import { NextRequest, NextResponse } from "next/server";
import { AdminAccessError } from "@sast-shop/api";
import {
  createConnectProxyAbort,
  hasTrustedRequestOrigin,
  isAdminConnectPath,
} from "@sast-shop/api/server";
import { desktopAppConfig } from "@/lib/app-config";
import { requireAdmin } from "@/lib/admin-server";

const limit = 1024 * 1024;
async function readBody(
  request: NextRequest,
  signal: AbortSignal,
): Promise<Uint8Array | undefined> {
  if (Number(request.headers.get("content-length")) > limit)
    throw new RangeError();
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const cancel = () => {
    void reader.cancel(signal.reason).catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RangeError();
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  if (!isAdminConnectPath(path))
    return failure(404, "not_found", "未知管理接口");
  if (!hasTrustedRequestOrigin(request.headers, desktopAppConfig.appOrigin))
    return failure(403, "permission_denied", "请求来源不正确");
  const abort = createConnectProxyAbort(request.signal);
  try {
    const { options } = await requireAdmin();
    const headers = new Headers();
    for (const name of [
      "content-type",
      "connect-protocol-version",
      "connect-timeout-ms",
      "accept",
    ]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const body = await readBody(request, abort.signal);
    const upstream = await options.fetch!(
      `${options.connectBaseUrl}/${path.map(encodeURIComponent).join("/")}`,
      {
        method: "POST",
        headers,
        body: body as BodyInit | undefined,
        signal: abort.signal,
      },
    );
    const responseHeaders = new Headers({ "cache-control": "no-store" });
    for (const name of [
      "content-type",
      "connect-protocol-version",
      "retry-after",
    ]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof AdminAccessError)
      return failure(
        error.status,
        error.status === 401 ? "unauthenticated" : "permission_denied",
        error.message,
      );
    if (error instanceof RangeError)
      return failure(413, "resource_exhausted", "请求内容过大");
    if (abort.didTimeout())
      return failure(504, "deadline_exceeded", "请求超时，请核实操作结果");
    return failure(
      503,
      "unavailable",
      "管理服务暂不可用，请核实操作结果后重试",
    );
  } finally {
    abort.dispose();
  }
}

function failure(status: number, code: string, message: string) {
  return NextResponse.json(
    { code, message },
    { status, headers: { "cache-control": "no-store" } },
  );
}
