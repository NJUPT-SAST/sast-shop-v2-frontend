import { isSameOriginRequest } from "../config/request-origin";
import {
  parseFormDataWithLimit,
  PayloadTooLargeError,
} from "../packages/api/src/server/limited-form-data";
import { ConcurrencyGuard } from "../packages/api/src/server/concurrency-guard";
import { readJsonResponseWithLimit } from "../packages/api/src/server/limited-json-response";

import {
  buildBackendProductImageUploadUrl,
  hasMatchingImageSignature,
  parseBackendImageUrl,
} from "../config/product-image-upload";

const maxImageBytes = 10 * 1024 * 1024;
const maxRequestBytes = maxImageBytes + 64 * 1024;
const maxBackendResponseBytes = 64 * 1024;
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const uploadConcurrency = new ConcurrencyGuard(8, 2);

type ProductImageUploadOptions = {
  appOrigin: string;
  backendBaseUrl: string;
  isAuthenticationRequired: boolean;
  sessionToken?: string;
};

type BackendUploadResponse = {
  url?: unknown;
};

export async function proxyProductImageUpload(
  request: Request,
  options: ProductImageUploadOptions,
) {
  if (!isSameOriginRequest(request.headers, options.appOrigin)) {
    return Response.json({ error: "请求来源不正确" }, { status: 403 });
  }

  if (options.isAuthenticationRequired && !options.sessionToken) {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }

  const requesterKey = await getRequesterKey(options.sessionToken);
  const releaseUploadSlot = uploadConcurrency.tryAcquire(requesterKey);
  if (!releaseUploadSlot) {
    return Response.json(
      { error: "上传任务较多，请稍后重试" },
      { status: 429 },
    );
  }

  try {
    return await handleProductImageUpload(request, options);
  } finally {
    releaseUploadSlot();
  }
}

async function handleProductImageUpload(
  request: Request,
  options: ProductImageUploadOptions,
) {
  let formData: FormData;
  try {
    formData = await parseFormDataWithLimit(request, maxRequestBytes);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return Response.json({ error: "图片不能超过 10 MB" }, { status: 413 });
    }
    return Response.json({ error: "图片数据不正确" }, { status: 400 });
  }

  const picture = formData.get("picture");
  if (!(picture instanceof File) || picture.size === 0) {
    return Response.json({ error: "请选择图片" }, { status: 400 });
  }
  if (picture.size > maxImageBytes) {
    return Response.json({ error: "图片不能超过 10 MB" }, { status: 413 });
  }
  if (
    !acceptedImageTypes.has(picture.type) ||
    !hasMatchingImageSignature(
      picture.type,
      new Uint8Array(await picture.slice(0, 12).arrayBuffer()),
    )
  ) {
    return Response.json(
      { error: "请选择有效的 JPEG、PNG 或 WebP 图片" },
      { status: 415 },
    );
  }

  const upstreamForm = new FormData();
  upstreamForm.append("picture", picture, sanitizeFileName(picture.name));

  const headers = new Headers({ accept: "application/json" });
  if (options.sessionToken) {
    headers.set("authorization", `Bearer ${options.sessionToken}`);
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      buildBackendProductImageUploadUrl(options.backendBaseUrl),
      {
        method: "POST",
        headers,
        body: upstreamForm,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      },
    );
  } catch {
    return Response.json({ error: "图片服务暂不可用" }, { status: 502 });
  }

  const payload = await readBackendPayload(upstream);
  if (!upstream.ok || !payload) {
    return Response.json(
      { error: getUploadErrorMessage(upstream.status) },
      { status: toProxyStatus(upstream.status) },
    );
  }

  const url = parseBackendImageUrl(payload.url, {
    allowHttp: process.env.NODE_ENV !== "production",
  });
  if (!url) {
    return Response.json({ error: "图片服务返回异常" }, { status: 502 });
  }

  return Response.json({ url }, { headers: { "cache-control": "no-store" } });
}

function sanitizeFileName(fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  return safeName.includes(".") ? safeName : `${safeName || "product"}.jpg`;
}

async function readBackendPayload(
  response: Response,
): Promise<BackendUploadResponse | null> {
  try {
    const payload = (await readJsonResponseWithLimit(
      response,
      maxBackendResponseBytes,
    )) as BackendUploadResponse;
    return typeof payload === "object" && payload !== null ? payload : null;
  } catch {
    return null;
  }
}

async function getRequesterKey(sessionToken: string | undefined) {
  if (!sessionToken) return "anonymous";

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(sessionToken),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function getUploadErrorMessage(status: number) {
  if (status === 401 || status === 403) return "登录状态已失效";
  if (status === 413) return "图片不能超过 10 MB";
  if (status === 415) return "请选择有效的 JPEG、PNG 或 WebP 图片";
  return "图片上传失败";
}

function toProxyStatus(status: number) {
  if ([400, 401, 403, 413, 415, 429].includes(status)) return status;
  return 502;
}
