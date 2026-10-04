import agreementContent from "../content/transaction-agreement.json";

export const TRANSACTION_AGREEMENT_VERSION = agreementContent.version;
export const TRANSACTION_AGREEMENT_STORAGE_KEY =
  "sast-shop:transaction-agreement";
export const TRANSACTION_AGREEMENT_READING_MS = 5_000;

export const transactionAgreementContent = agreementContent;

function getStorageKey(userId?: string) {
  return userId
    ? `${TRANSACTION_AGREEMENT_STORAGE_KEY}:${encodeURIComponent(userId)}`
    : TRANSACTION_AGREEMENT_STORAGE_KEY;
}

export function hasAcceptedTransactionAgreement(userId?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return false;
    const record: unknown = JSON.parse(raw);
    if (!record || typeof record !== "object") return false;
    const { version, agreedAt } = record as Record<string, unknown>;
    return (
      version === TRANSACTION_AGREEMENT_VERSION &&
      typeof agreedAt === "string" &&
      Number.isFinite(Date.parse(agreedAt))
    );
  } catch {
    return false;
  }
}

export function saveTransactionAgreementAcceptance(userId?: string) {
  window.localStorage.setItem(
    getStorageKey(userId),
    JSON.stringify({
      version: TRANSACTION_AGREEMENT_VERSION,
      agreedAt: new Date().toISOString(),
    }),
  );
}
