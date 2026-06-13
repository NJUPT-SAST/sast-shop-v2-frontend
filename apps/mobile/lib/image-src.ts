const SUPPORTED_IMAGE_SRC_PATTERN =
  /^(https?:\/\/|\/(?!\/)|data:image\/|blob:)/

export function sanitizeImageSrc(value: string | null | undefined): string | null {
  const src = value?.trim()

  if (!src || !SUPPORTED_IMAGE_SRC_PATTERN.test(src)) {
    return null
  }

  return src
}
