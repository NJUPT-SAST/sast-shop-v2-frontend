const maxImageBytes = 10 * 1024 * 1024;
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
  const response = await fetch("/api/uploads/product-image", {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as {
    url?: unknown;
    error?: unknown;
  } | null;

  if (!response.ok || typeof payload?.url !== "string") {
    throw new Error(
      typeof payload?.error === "string" ? payload.error : "图片上传失败",
    );
  }
  return payload.url;
}
