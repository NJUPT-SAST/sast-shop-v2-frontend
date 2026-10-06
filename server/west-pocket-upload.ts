import { hasTrustedRequestOrigin } from "../packages/api/src/server/request-origin";
import {
  hasMatchingImageSignature,
  parseBackendImageUrl,
} from "../config/product-image-upload";
import {
  parseFormDataWithLimit,
  PayloadTooLargeError,
} from "../packages/api/src/server/limited-form-data";
import { readJsonResponseWithLimit } from "../packages/api/src/server/limited-json-response";
import { ConcurrencyGuard } from "../packages/api/src/server/concurrency-guard";

const maxBytes = 10 * 1024 * 1024;
const guard = new ConcurrencyGuard(8, 2);
interface UploadOptions {
  appOrigin: string;
  backendBaseUrl: string;
  isAuthenticationRequired: boolean;
  sessionToken?: string;
  devUserId?: string;
}
export async function proxyWestPocketUpload(
  request: Request,
  options: UploadOptions,
): Promise<Response> {
  const headers = { "cache-control": "no-store" };
  const fail = (error: string, status: number) =>
    Response.json({ error }, { status, headers });
  if (!hasTrustedRequestOrigin(request.headers, options.appOrigin))
    return fail("请求来源不正确", 403);
  if (options.isAuthenticationRequired && !options.sessionToken)
    return fail("请先登录", 401);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(options.sessionToken ?? "anonymous"),
  );
  const release = guard.tryAcquire(
    Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join(""),
  );
  if (!release) return fail("正在处理较多照片，请稍后重试", 429);
  try {
    let form: FormData;
    try {
      form = await parseFormDataWithLimit(request, maxBytes + 64 * 1024);
    } catch (error) {
      return fail(
        error instanceof PayloadTooLargeError
          ? "图片不能超过 10 MB"
          : "图片数据不正确",
        error instanceof PayloadTooLargeError ? 413 : 400,
      );
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0)
      return fail("请选择图片", 400);
    if (file.size > maxBytes) return fail("图片不能超过 10 MB", 413);
    if (
      !["image/jpeg", "image/png"].includes(file.type) ||
      !hasMatchingImageSignature(
        file.type,
        new Uint8Array(await file.slice(0, 12).arrayBuffer()),
      )
    )
      return fail("请选择有效的 JPEG 或 PNG 图片", 415);
    const purpose = form.get("purpose");
    const consent = form.get("consent_version");
    const requestId = form.get("request_id");
    const pocketId = form.get("pocket_id");
    if (
      !["face_sample", "group_photo"].includes(String(purpose)) ||
      typeof consent !== "string" ||
      !consent ||
      consent.length > 100 ||
      typeof requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        requestId,
      )
    )
      return fail("上传用途或授权信息不正确", 400);
    if (
      purpose === "group_photo" &&
      (typeof pocketId !== "string" || !/^[1-9]\d{0,18}$/.test(pocketId))
    )
      return fail("请选择要上传合照的活动", 400);
    const upstreamForm = new FormData();
    upstreamForm.append(
      "file",
      file,
      `photo.${file.type === "image/png" ? "png" : "jpg"}`,
    );
    upstreamForm.append("purpose", String(purpose));
    upstreamForm.append("consent_version", consent);
    upstreamForm.append("request_id", requestId);
    if (purpose === "group_photo")
      upstreamForm.append("pocket_id", String(pocketId));
    let backend: URL;
    try {
      backend = new URL(options.backendBaseUrl);
    } catch {
      return fail("图片服务配置错误", 503);
    }
    if (
      !["https:", "http:"].includes(backend.protocol) ||
      backend.username ||
      backend.password ||
      backend.search ||
      backend.hash
    )
      return fail("图片服务配置错误", 503);
    const upstreamHeaders = new Headers({ accept: "application/json" });
    if (options.sessionToken)
      upstreamHeaders.set("authorization", `Bearer ${options.sessionToken}`);
    if (
      !options.isAuthenticationRequired &&
      options.devUserId &&
      process.env.NODE_ENV !== "production"
    )
      upstreamHeaders.set("x-dev-user-id", options.devUserId);
    let response: Response;
    try {
      response = await fetch(
        new URL("/api/v1/west-pocket/uploads", backend.origin),
        {
          method: "POST",
          body: upstreamForm,
          headers: upstreamHeaders,
          cache: "no-store",
          redirect: "manual",
          signal: AbortSignal.timeout(30_000),
        },
      );
    } catch {
      return fail("照片上传服务暂不可用，请重试", 502);
    }
    if (!response.ok) {
      const messages: Record<number, string> = {
        400: "照片或授权信息不正确，请刷新后重试",
        401: "请重新登录",
        403: "没有上传这张照片的权限",
        413: "图片不能超过 10 MB",
        415: "图片格式不支持，请选择 JPEG 或 PNG",
        429: "照片上传过于频繁，请稍后重试",
        503: "照片服务暂未开放，可直接搜索姓名选人",
      };
      return fail(
        messages[response.status] ?? "照片上传失败，请重试",
        [400, 401, 403, 413, 415, 429, 503].includes(response.status)
          ? response.status
          : 502,
      );
    }
    const result = (await readJsonResponseWithLimit(response, 64 * 1024).catch(
      () => null,
    )) as {
      upload_id?: unknown;
      preview_url?: unknown;
      expires_at?: unknown;
    } | null;
    if (
      !result ||
      typeof result.upload_id !== "string" ||
      !/^[1-9]\d*$/.test(result.upload_id) ||
      typeof result.expires_at !== "string" ||
      Number.isNaN(Date.parse(result.expires_at))
    )
      return fail("照片服务返回异常", 502);
    const preview = result.preview_url
      ? parseBackendImageUrl(result.preview_url, {
          allowHttp: process.env.NODE_ENV !== "production",
        })
      : "";
    if (result.preview_url && !preview) return fail("照片服务返回异常", 502);
    return Response.json(
      {
        upload_id: result.upload_id,
        expires_at: result.expires_at,
        preview_url: preview,
      },
      { headers },
    );
  } finally {
    release();
  }
}
