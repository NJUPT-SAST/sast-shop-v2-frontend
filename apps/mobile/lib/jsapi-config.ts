import type { JSAPIAuthConfig } from "@sast-shop/api";

const maxSigningUrlLength = 4096;

export function isJsapiAuthConfig(value: unknown): value is JSAPIAuthConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const config = value as Partial<JSAPIAuthConfig>;
  return (
    typeof config.appId === "string" &&
    Boolean(config.appId) &&
    typeof config.timestamp === "string" &&
    Boolean(config.timestamp) &&
    typeof config.nonceStr === "string" &&
    Boolean(config.nonceStr) &&
    typeof config.signature === "string" &&
    Boolean(config.signature)
  );
}

export function normalizeJsapiSigningUrl(
  candidate: string,
  expectedOrigin: string,
): string {
  if (candidate.length > maxSigningUrlLength) {
    throw new Error("JSAPI 签名地址不正确");
  }

  let url: URL;
  let origin: URL;
  try {
    url = new URL(candidate);
    origin = new URL(expectedOrigin);
  } catch {
    throw new Error("JSAPI 签名地址不正确");
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.origin !== origin.origin ||
    url.username ||
    url.password
  ) {
    throw new Error("JSAPI 签名地址不正确");
  }

  url.hash = "";
  return url.href;
}
