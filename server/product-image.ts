import { hasMatchingImageSignature } from "../config/product-image-upload";

const maximumImageBytes = 10 * 1024 * 1024;
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const productImageFilename = /^[a-f0-9]{64}\.(?:png|jpg|jpeg|webp)$/;

export async function proxyProductImage(
  filename: string,
  backendBaseUrl: string,
): Promise<Response> {
  if (!productImageFilename.test(filename)) return imageError(404);

  let imageUrl: URL;
  try {
    const backend = new URL(backendBaseUrl.trim());
    if (
      !["http:", "https:"].includes(backend.protocol) ||
      backend.username ||
      backend.password ||
      backend.search ||
      backend.hash
    ) {
      return imageError(502);
    }
    imageUrl = new URL(
      `/images/sast-shop/products/${filename}`,
      backend.origin,
    );
  } catch {
    return imageError(502);
  }

  let upstream: Response;
  try {
    upstream = await fetch(imageUrl, {
      method: "GET",
      headers: { accept: "image/jpeg, image/png, image/webp" },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return imageError(502);
  }

  if (!upstream.ok) {
    await upstream.body?.cancel().catch(() => {});
    return imageError(upstream.status === 404 ? 404 : 502);
  }

  const contentType = upstream.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (!contentType || !acceptedImageTypes.has(contentType) || !upstream.body) {
    await upstream.body?.cancel().catch(() => {});
    return imageError(502);
  }

  if (Number(upstream.headers.get("content-length")) > maximumImageBytes) {
    await upstream.body.cancel().catch(() => {});
    return imageError(413);
  }

  const reader = upstream.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumImageBytes) {
        await reader.cancel().catch(() => {});
        return imageError(413);
      }
      chunks.push(value);
    }
  } catch {
    return imageError(502);
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (!hasMatchingImageSignature(contentType, bytes)) return imageError(502);

  return new Response(bytes, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=86400, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}

function imageError(status: number): Response {
  return new Response(null, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
