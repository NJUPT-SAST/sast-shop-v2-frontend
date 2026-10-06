const loadedImages = new Set<string>();
const maximumImages = 1024;

export function hasLoadedImage(src: string): boolean {
  return typeof window !== "undefined" && loadedImages.has(src);
}

export function rememberLoadedImage(src: string) {
  if (typeof window === "undefined") return;
  loadedImages.delete(src);
  loadedImages.add(src);
  if (loadedImages.size > maximumImages) {
    const oldest = loadedImages.values().next().value;
    if (oldest !== undefined) loadedImages.delete(oldest);
  }
}

export function forgetLoadedImage(src: string) {
  loadedImages.delete(src);
}
