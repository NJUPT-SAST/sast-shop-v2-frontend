import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { getServerAuthMode } from "@/lib/auth-mode";

const sessionCookieName = "sast_shop_session";
const maxImageBytes = 10 * 1024 * 1024;
const maxRequestBytes = maxImageBytes + 64 * 1024;
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type EventoUploadResponse = {
  success?: boolean;
  data?: unknown;
  errMsg?: unknown;
};

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "请求来源不正确" }, { status: 403 });
  }

  if (
    getServerAuthMode() === "required" &&
    !(await cookies()).get(sessionCookieName)?.value
  ) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxRequestBytes) {
    return NextResponse.json({ error: "图片不能超过 10 MB" }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "图片数据不正确" }, { status: 400 });
  }

  const picture = formData.get("picture");
  if (!(picture instanceof File) || picture.size === 0) {
    return NextResponse.json({ error: "请选择图片" }, { status: 400 });
  }
  if (picture.size > maxImageBytes) {
    return NextResponse.json({ error: "图片不能超过 10 MB" }, { status: 413 });
  }
  if (!acceptedImageTypes.has(picture.type)) {
    return NextResponse.json(
      { error: "请选择 JPEG、PNG 或 WebP 图片" },
      { status: 415 },
    );
  }

  const token = process.env.EVENTO_PICTURE_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ error: "图片服务未配置" }, { status: 503 });
  }

  const upstreamForm = new FormData();
  upstreamForm.append("picture", picture, sanitizeFileName(picture.name));
  upstreamForm.append(
    "dir",
    process.env.EVENTO_PICTURE_DIR?.trim() || "sast-shop",
  );

  let upstream: Response;
  try {
    upstream = await fetch(getPictureUploadUrl(), {
      method: "POST",
      headers: { token },
      body: upstreamForm,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return NextResponse.json({ error: "图片服务暂不可用" }, { status: 502 });
  }

  let payload: EventoUploadResponse;
  try {
    payload = (await upstream.json()) as EventoUploadResponse;
  } catch {
    return NextResponse.json({ error: "图片服务返回异常" }, { status: 502 });
  }

  if (
    !upstream.ok ||
    payload.success !== true ||
    typeof payload.data !== "string"
  ) {
    return NextResponse.json(
      {
        error:
          typeof payload.errMsg === "string" && payload.errMsg.trim()
            ? payload.errMsg
            : "图片上传失败",
      },
      { status: upstream.status >= 400 && upstream.status < 500 ? 400 : 502 },
    );
  }

  const url = readPublicImageUrl(payload.data);
  if (!url) {
    return NextResponse.json({ error: "图片地址不正确" }, { status: 502 });
  }

  return NextResponse.json(
    { url },
    { headers: { "cache-control": "no-store" } },
  );
}

function isSameOrigin(request: NextRequest) {
  const source =
    request.headers.get("origin") ?? request.headers.get("referer");
  if (!source) return false;

  try {
    return new URL(source).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function getPictureUploadUrl() {
  const baseUrl =
    process.env.EVENTO_PICTURE_API_BASE_URL?.trim() ||
    "https://evento.sast.fun/api";
  return `${baseUrl.replace(/\/+$/, "")}/picture/info`;
}

function sanitizeFileName(fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  return safeName.includes(".") ? safeName : `${safeName || "product"}.jpg`;
}

function readPublicImageUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
