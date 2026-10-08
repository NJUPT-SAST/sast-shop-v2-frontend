export function canOptimizeImage(src: string): boolean {
  if (/^\/(?:brand\/|_next\/static\/media\/)/.test(src)) {
    return !/\.svg(?:[?#]|$)/i.test(src);
  }
  try {
    const url = new URL(src);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !/\.svg$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function imageThumbnailSrc(src: string): string {
  const query = new URLSearchParams({ url: src, w: "64", q: "35" });
  return `/_next/image?${query}`;
}

export function imageDisplayCacheKey(src: string, sizes: string): string {
  return `display:${sizes}:${src}`;
}
