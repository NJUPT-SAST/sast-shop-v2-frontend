import type { BuyerErrandOrderStatus, ProductTemplate } from "@sast-shop/api";

export const ERRAND_DEMAND_SNAPSHOT_STORAGE_KEY =
  "sast-shop.desktop.errand-demand-snapshots.v1";

const MAX_SNAPSHOTS = 30;

export interface ErrandDemandSnapshotItem {
  productTemplate: ProductTemplate;
  quantity: number;
  serviceFeePerUnitCents: number;
}

export interface ErrandDemandSnapshot {
  demandId: string;
  storeId: string;
  deadline: string;
  createdAt: string;
  items: ErrandDemandSnapshotItem[];
}

export function createErrandDemandSnapshot(input: {
  demandId: string;
  storeId: string;
  deadline: string;
  items: ErrandDemandSnapshotItem[];
  createdAt?: string;
}): ErrandDemandSnapshot {
  return {
    demandId: input.demandId,
    storeId: input.storeId,
    deadline: input.deadline,
    createdAt: input.createdAt ?? new Date().toISOString(),
    items: input.items.map((item) => ({
      productTemplate: item.productTemplate,
      quantity: item.quantity,
      serviceFeePerUnitCents: item.serviceFeePerUnitCents,
    })),
  };
}

export function getErrandDemandSnapshot(
  demandId: string,
): ErrandDemandSnapshot | null {
  return readErrandDemandSnapshots().find((item) => item.demandId === demandId)
    ?? null;
}

export function getErrandDemandSnapshotMap(): Map<
  string,
  ErrandDemandSnapshot
> {
  return new Map(
    readErrandDemandSnapshots().map((snapshot) => [
      snapshot.demandId,
      snapshot,
    ]),
  );
}

export function saveErrandDemandSnapshot(snapshot: ErrandDemandSnapshot): void {
  const normalized = normalizeErrandDemandSnapshot(snapshot);
  const storage = getBrowserStorage();

  if (!normalized || !storage) {
    return;
  }

  const next = [
    normalized,
    ...readErrandDemandSnapshots().filter(
      (item) => item.demandId !== normalized.demandId,
    ),
  ].slice(0, MAX_SNAPSHOTS);

  try {
    storage.setItem(ERRAND_DEMAND_SNAPSHOT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Losing the edit snapshot should not turn a successful backend mutation
    // into a failed submission.
  }
}

export function readErrandDemandSnapshots(): ErrandDemandSnapshot[] {
  const storage = getBrowserStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(ERRAND_DEMAND_SNAPSHOT_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item) => {
      const normalized = normalizeErrandDemandSnapshot(item);
      return normalized ? [normalized] : [];
    });
  } catch {
    return [];
  }
}

export function normalizeErrandDemandSnapshot(
  value: unknown,
): ErrandDemandSnapshot | null {
  if (!isRecord(value)) return null;

  const demandId = getPositiveId(value.demandId);
  const storeId = getPositiveId(value.storeId);
  const deadline = getIsoTimestamp(value.deadline);
  const createdAt = getIsoTimestamp(value.createdAt);
  const rawItems = value.items;

  if (!demandId || !storeId || !deadline || !createdAt) return null;
  if (!Array.isArray(rawItems) || rawItems.length === 0) return null;

  const items = rawItems.flatMap((item) => {
    const normalized = normalizeErrandDemandSnapshotItem(item);
    return normalized ? [normalized] : [];
  });

  if (items.length === 0) return null;

  return { demandId, storeId, deadline, createdAt, items };
}

export function shouldDisplayErrandDemandExpired(
  status: BuyerErrandOrderStatus,
  deadline: string | null,
  now: Date = new Date(),
): boolean {
  if (
    status === "completed" ||
    status === "cancelled" ||
    status === "pending_payment" ||
    status === "unknown"
  ) {
    return false;
  }

  return isPastTimestamp(deadline, now);
}

function normalizeErrandDemandSnapshotItem(
  value: unknown,
): ErrandDemandSnapshotItem | null {
  if (!isRecord(value)) return null;

  const productTemplate = normalizeProductTemplate(value.productTemplate);
  const quantity = getPositiveInteger(value.quantity);
  const serviceFeePerUnitCents = getNonNegativeInteger(
    value.serviceFeePerUnitCents,
  );

  if (!productTemplate || quantity === null || serviceFeePerUnitCents === null) {
    return null;
  }

  return { productTemplate, quantity, serviceFeePerUnitCents };
}

function normalizeProductTemplate(value: unknown): ProductTemplate | null {
  if (!isRecord(value)) return null;

  const id = getPositiveId(value.id);
  const storeId = getPositiveId(value.storeId);

  if (!id || !storeId || typeof value.title !== "string") {
    return null;
  }

  const priceCents = getNonNegativeInteger(value.priceCents);
  if (priceCents === null) return null;

  return {
    id,
    title: value.title,
    description:
      typeof value.description === "string" ? value.description : "",
    priceCents,
    storeId,
    mainImageUrl:
      typeof value.mainImageUrl === "string" ? value.mainImageUrl : "",
    barcode: typeof value.barcode === "string" ? value.barcode : "",
    updatedAt:
      typeof value.updatedAt === "string" && isValidDate(value.updatedAt)
        ? new Date(value.updatedAt).toISOString()
        : null,
  };
}

function isPastTimestamp(value: string | null, now: Date): boolean {
  if (!value || Number.isNaN(now.getTime())) return false;

  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return false;

  return now.getTime() > deadline.getTime();
}

function getIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!isValidDate(value)) return null;

  return new Date(value).toISOString();
}

function getPositiveId(value: unknown): string | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  return value;
}

function getPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function getNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function getBrowserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
