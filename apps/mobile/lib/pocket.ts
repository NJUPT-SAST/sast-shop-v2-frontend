import {
  AuthRequiredError,
  FeatureUnavailableError,
  ResourceNotFoundError,
} from "@sast-shop/api";

/** Parse decimal yuan without floating point rounding or silently rounding user input. */
export function parsePocketAmount(value: string): number {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error("请输入正确的金额，最多两位小数");
  }
  const [yuan = "0", fraction = ""] = normalized.split(".");
  const cents = Number(yuan) * 100 + Number(fraction.padEnd(2, "0"));
  if (cents <= 0 || cents > 2147483647)
    throw new Error("金额需大于 0 且不超过 21474836.47 元");
  return cents;
}

export function pocketMoney(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

export function pocketError(error: unknown): string {
  if (error instanceof AuthRequiredError) return "请登录后再试";
  if (error instanceof FeatureUnavailableError)
    return "Pocket 暂未开放，请稍后再试";
  if (error instanceof ResourceNotFoundError)
    return "活动不存在，或你暂时没有访问权限";
  if (error instanceof Error && /[\u3400-\u9fff]/.test(error.message))
    return error.message;
  return "暂时无法确认结果，请刷新核实后重试";
}

export function pocketStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "草稿",
    publishing: "正在发起收款",
    collecting: "收款中",
    settled: "已收齐",
    cancelling: "正在取消",
    cancelled: "已取消",
  };
  return labels[status] ?? "状态待更新";
}

export function pocketPaymentLabel(status: string): string {
  const labels: Record<string, string> = {
    unpaid: "待付款",
    submitted: "待确认到账",
    completed: "已确认到账",
    closed: "已关闭",
  };
  return labels[status] ?? "等待创建账单";
}

export function pocketJobLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "等待处理",
    queued: "等待处理",
    running: "处理中",
    succeeded: "处理完成",
    completed: "处理完成",
    failed: "处理失败",
    cancelled: "已取消",
  };
  return labels[status] ?? "等待更新";
}

export function pocketJobError(code: string): string {
  const labels: Record<string, string> = {
    NO_FACE: "未识别到人脸，请补拍或手动选人",
    LOW_QUALITY: "照片不清晰，请在光线充足时重拍",
    ONE_FACE_REQUIRED: "照片中仅可有本人一张人脸",
    FACE_LIMIT_REACHED: "人脸过多，请分组补拍",
    SAMPLE_REJECTED: "照片未通过检查，请换一张清晰正脸照",
    PROVIDER_TIMEOUT: "识别超时，请重试或手动选人",
  };
  return labels[code] ?? "处理未完成，请刷新查看";
}

export function pocketJobFinished(status: string): boolean {
  return ["succeeded", "completed", "failed", "cancelled"].includes(status);
}

export function validatePocketImage(file: Pick<File, "type" | "size">): void {
  if (!["image/jpeg", "image/png"].includes(file.type))
    throw new Error("请选择 JPEG 或 PNG 图片，HEIC 照片请先转换格式");
  if (file.size <= 0 || file.size > 10 * 1024 * 1024)
    throw new Error("每张图片需大于 0 且不超过 10 MB");
}
