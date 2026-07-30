import type { PaymentPlatform } from "./platforms";

export const MAX_PAYMENT_QR_CONTENT_LENGTH = 512;

export type PaymentQrContentValidationReason =
  "empty" | "too-long" | "control-character" | "unsupported-channel-content";

export type PaymentQrContentValidationResult =
  | { ok: true; content: string }
  | { ok: false; reason: PaymentQrContentValidationReason };

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const QR_CONTENT_CHARS = String.raw`[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+`;

const CHANNEL_ALLOWLIST: Record<PaymentPlatform, RegExp[]> = {
  wechat: [
    new RegExp(`^wxp://${QR_CONTENT_CHARS}$`),
    new RegExp(`^weixin://${QR_CONTENT_CHARS}$`),
    new RegExp(`^https://wx\\.tenpay\\.com/${QR_CONTENT_CHARS}$`),
  ],
  alipay: [
    new RegExp(`^https://qr\\.alipay\\.com/${QR_CONTENT_CHARS}$`),
    new RegExp(`^alipays://${QR_CONTENT_CHARS}$`),
  ],
};

export function validatePaymentQrContent(
  channel: PaymentPlatform,
  content: string,
): PaymentQrContentValidationResult {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    return { ok: false, reason: "empty" };
  }

  if (normalizedContent.length > MAX_PAYMENT_QR_CONTENT_LENGTH) {
    return { ok: false, reason: "too-long" };
  }

  if (CONTROL_CHARACTER_PATTERN.test(normalizedContent)) {
    return { ok: false, reason: "control-character" };
  }

  if (!isPaymentQrContentAllowed(channel, normalizedContent)) {
    return { ok: false, reason: "unsupported-channel-content" };
  }

  return { ok: true, content: normalizedContent };
}

export function isPaymentQrContentAllowed(
  channel: PaymentPlatform,
  content: string,
) {
  const normalizedContent = content.trim();

  return CHANNEL_ALLOWLIST[channel].some((pattern) =>
    pattern.test(normalizedContent),
  );
}
