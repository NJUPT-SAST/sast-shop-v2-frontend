const maxSigningUrlLength = 4096

export function normalizeJsapiSigningUrl(
  candidate: string,
  expectedOrigin: string,
): string {
  if (candidate.length > maxSigningUrlLength) {
    throw new Error("JSAPI 签名地址不正确")
  }

  let url: URL
  let origin: URL
  try {
    url = new URL(candidate)
    origin = new URL(expectedOrigin)
  } catch {
    throw new Error("JSAPI 签名地址不正确")
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.origin !== origin.origin ||
    url.username ||
    url.password
  ) {
    throw new Error("JSAPI 签名地址不正确")
  }

  url.hash = ""
  return url.href
}
