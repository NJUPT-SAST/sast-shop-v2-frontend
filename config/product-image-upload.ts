const productImageUploadPath = "/api/uploads/product-image";

export function buildBackendProductImageUploadUrl(
  connectBaseUrl: string,
): string {
  const configured = connectBaseUrl.trim();
  if (!configured) throw new Error("CONNECT_BASE_URL is required");

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("CONNECT_BASE_URL must be an absolute URL");
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("CONNECT_BASE_URL is not safe for image uploads");
  }

  return new URL(productImageUploadPath, url.origin).toString();
}

export function parseBackendImageUrl(
  value: unknown,
  { allowHttp = false }: { allowHttp?: boolean } = {},
): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    const allowedProtocol =
      url.protocol === "https:" || (allowHttp && url.protocol === "http:");
    if (!allowedProtocol || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function hasMatchingImageSignature(
  mimeType: string,
  bytes: Uint8Array,
): boolean {
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    );
  }
  if (mimeType === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  return false;
}
