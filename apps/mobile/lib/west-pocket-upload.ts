import { validatePocketImage } from "./west-pocket";
export interface PocketUpload {
  uploadId: string;
  previewUrl: string;
  expiresAt: string;
}
export async function uploadPocketPhoto(
  file: File,
  input: {
    purpose: "face_sample" | "group_photo";
    consentVersion: string;
    requestId: string;
    pocketId?: string;
  },
): Promise<PocketUpload> {
  validatePocketImage(file);
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", input.purpose);
  form.append("consent_version", input.consentVersion);
  form.append("request_id", input.requestId);
  if (input.pocketId) form.append("pocket_id", input.pocketId);
  const response = await fetch("/api/uploads/west-pocket", {
    method: "POST",
    body: form,
  });
  const result = (await response.json().catch(() => null)) as {
    upload_id?: unknown;
    expires_at?: unknown;
    preview_url?: unknown;
    error?: unknown;
  } | null;
  if (!response.ok || typeof result?.upload_id !== "string")
    throw new Error(
      typeof result?.error === "string" ? result.error : "照片上传失败，请重试",
    );
  return {
    uploadId: result.upload_id,
    previewUrl:
      typeof result.preview_url === "string" ? result.preview_url : "",
    expiresAt: typeof result.expires_at === "string" ? result.expires_at : "",
  };
}
