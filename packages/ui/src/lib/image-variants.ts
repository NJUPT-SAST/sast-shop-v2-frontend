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
  const query = new URLSearchParams({
    url: imageOptimizationSrc(src),
    w: "64",
    q: "35",
  });
  return `/_next/image?${query}`;
}

export function imageOptimizationSrc(src: string): string {
  try {
    const url = new URL(src);
    const match = url.pathname.match(
      /^\/images\/sast-shop\/products\/([a-f0-9]{64}\.(?:png|jpe?g|webp))$/,
    );
    if (
      url.origin === "https://api.sast.fun" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      match
    ) {
      return `/api/images/products/${match[1]}`;
    }
  } catch {}
  return src;
}

export function imageDisplayCacheKey(src: string, sizes: string): string {
  return `display:${sizes}:${src}`;
}
