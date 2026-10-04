const maxImageBytes = 10 * 1024 * 1024;
const uploadTimeoutMs = 30_000;
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function uploadProductImage(file: File): Promise<string> {
  if (!acceptedImageTypes.has(file.type)) {
    throw new Error("请选择 JPEG、PNG 或 WebP 图片");
  }
  if (file.size > maxImageBytes) {
    throw new Error("图片不能超过 10 MB");
  }

  const formData = new FormData();
  formData.append("picture", file);

  const controller = new AbortController();
  const timeoutError = new Error("图片上传超时，请重试");
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(timeoutError);
    }, uploadTimeoutMs);
  });

  try {
    const response = await Promise.race([
      fetch("/api/uploads/product-image", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      }),
      deadline,
    ]);
    const payload = (await Promise.race([
      response.json().catch(() => null),
      deadline,
    ])) as { url?: unknown; error?: unknown } | null;

    if (!response.ok || typeof payload?.url !== "string") {
      throw new Error(
        typeof payload?.error === "string" ? payload.error : "图片上传失败",
      );
    }

    return payload.url;
  } catch (error) {
    if (timedOut) throw timeoutError;
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
