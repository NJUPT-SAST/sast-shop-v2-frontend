# Buyer Errand Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the buyer-side errand demand flow and show buyer errand orders in the mobile orders page.

**Architecture:** Add `@sast-shop/api` errand facades first, then build the mobile store-detail/cart flow on top of those facades. `../frontend-v2/components/group/shop-detail/*` is a behavioral reference only; final UI/UX follows `$impeccable` product-register guidance, this repo's shadcn-style primitives, mobile shell, and single Action Coral theme.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, ConnectRPC Web v2, Buf Protobuf-ES v2, Vitest, Tailwind CSS v4, shadcn-style workspace UI, remixicon, sonner.

---

## Scope Check

This plan implements one vertical slice:

- Buyer opens a group store.
- Buyer selects product templates into an errand cart.
- Buyer submits an errand demand.
- Buyer sees errand demand briefs in `/orders`.

Captain demand hall, captain task processing, distribution, collecting payment, errand payment, and errand order detail pages are outside this plan.

## File Structure

Create:

```text
packages/api/src/services/errand-demands.ts
packages/api/src/services/errand-demands.test.ts
packages/api/src/services/buyer-errand-orders.ts
packages/api/src/services/buyer-errand-orders.test.ts
apps/mobile/lib/errand-delivery-time.ts
apps/mobile/lib/errand-delivery-time.test.ts
apps/mobile/components/errand-shop.tsx
apps/mobile/app/group/shop/[id]/page.tsx
```

Modify:

```text
packages/api/src/index.ts
apps/mobile/app/group/page.tsx
apps/mobile/app/orders/page.tsx
apps/mobile/components/orders-view.tsx
```

Responsibility boundaries:

- API services map generated proto messages and validate inputs.
- `errand-delivery-time.ts` owns delivery default and validation logic.
- `errand-shop.tsx` owns client-side cart state, product cards, drawer, and submission.
- Route pages load server data and pass stable props into client components.
- `orders-view.tsx` only renders/filter-layers order data; it does not fetch.

## UI/UX Direction

Use `$impeccable` as the craft standard for the mobile surface:

- Treat `/group/shop/[id]` as a task surface, not a retail product showcase.
- Use the old implementation for interaction inventory: store detail, product selection, bottom cart entry, review drawer, per-item service fee, expected delivery, and confirmation.
- Do not copy raw orange values from the old prototype. Use the `primary` Action Coral token for submit and active controls.
- Keep product cards compact and scannable. Repeated cards are allowed because they represent repeated products, but avoid decorative card walls, nested cards, broad shadows, or oversized radius.
- Make state and money visible before ornament: selected quantity, fee per item, estimated product total, service fee total, deadline, and submission state.
- Use familiar controls: buttons for add/remove, input group for money, `datetime-local` or a simple date/time picker for deadline, Drawer/Dialog for confirmation.
- Motion is limited to state feedback already present in shared components. No page-load choreography.

---

### Task 1: Add Create Errand Demand Facade

**Files:**

- Create: `packages/api/src/services/errand-demands.test.ts`
- Create: `packages/api/src/services/errand-demands.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Write failing facade tests**

Create `packages/api/src/services/errand-demands.test.ts` with these test cases:

```ts
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  ApiConfigurationError,
  ApiRequestError,
  FeatureUnavailableError,
  ValidationError,
} from "../errors";
import {
  createErrandDemand,
  type CreateErrandDemandInput,
  type CreateErrandDemandResult,
} from "./errand-demands";

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
};

const validInput: CreateErrandDemandInput = {
  storeId: "3001",
  deadline: "2026-06-09T14:00:00.000Z",
  items: [
    {
      productTemplateId: "1001",
      quantity: 2,
      serviceFeePerUnitCents: 150,
      updatedAt: "1970-01-01T00:00:02.000Z",
    },
    {
      productTemplateId: "1002",
      quantity: 1,
      serviceFeePerUnitCents: 0,
      updatedAt: null,
    },
  ],
};

describe("errand demand service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes stable create errand demand return types", () => {
    expectTypeOf<ReturnType<typeof createErrandDemand>>().toEqualTypeOf<
      Promise<CreateErrandDemandResult>
    >();
  });

  it("creates an errand demand through the local Connect backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        errandDemandId: "7001",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createErrandDemand(validInput, localOptions);

    expect(result).toEqual({ errandDemandId: "7001" });
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.ErrandDemandService/CreateErrandDemand",
      body: {
        storeId: "3001",
        deadline: "2026-06-09T14:00:00Z",
        demandItems: [
          {
            productTemplateId: "1001",
            quantity: 2,
            serviceFeePerUnitCents: 150,
            updatedAt: "1970-01-01T00:00:02Z",
          },
          {
            productTemplateId: "1002",
            quantity: 1,
            serviceFeePerUnitCents: 0,
          },
        ],
      },
    });
  });

  it("validates create errand demand input before submitting requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createErrandDemand({ ...validInput, storeId: "0" }, localOptions),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createErrandDemand(
        { ...validInput, deadline: "not-a-date" },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createErrandDemand({ ...validInput, items: [] }, localOptions),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createErrandDemand(
        {
          ...validInput,
          items: [{ ...validInput.items[0]!, quantity: 0 }],
        },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createErrandDemand(
        {
          ...validInput,
          items: [{ ...validInput.items[0]!, serviceFeePerUnitCents: -1 }],
        },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a configured Connect base URL for local create mode", async () => {
    await expect(
      createErrandDemand(validInput, { dataSource: "local" }),
    ).rejects.toBeInstanceOf(ApiConfigurationError);
  });

  it("wraps local create failures in an API request error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stubJsonResponse(
          {
            code: "unavailable",
            message: "backend unavailable",
          },
          { status: 503 },
        ),
      ),
    );

    await expect(
      createErrandDemand(validInput, localOptions),
    ).rejects.toBeInstanceOf(ApiRequestError);
  });

  it("throws for remote create mode before backend client is wired", async () => {
    await expect(
      createErrandDemand(validInput, { dataSource: "remote" }),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });
});

function stubJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

async function expectConnectRequest(
  fetchMock: ReturnType<typeof vi.fn>,
  expected: {
    path: string;
    body: Record<string, unknown>;
  },
) {
  const [input, init] = fetchMock.mock.calls[0] ?? [];
  const url = typeof input === "string" ? input : (input as Request).url;
  const body =
    typeof input === "string"
      ? init?.body
      : await (input as Request).clone().text();

  expect(new URL(url).pathname).toBe(expected.path);
  expect(JSON.parse(bodyToText(body))).toEqual(expected.body);
}

function bodyToText(body: unknown): string {
  if (body instanceof Uint8Array) {
    return new TextDecoder().decode(body);
  }

  if (body instanceof ArrayBuffer) {
    return new TextDecoder().decode(body);
  }

  return String(body);
}
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
pnpm --filter @sast-shop/api test -- errand-demands.test.ts
```

Expected: fail because `./errand-demands` does not exist.

- [ ] **Step 3: Implement `errand-demands.ts`**

Create `packages/api/src/services/errand-demands.ts`:

```ts
import { createClient } from "@connectrpc/connect";
import { timestampFromDate, type Timestamp } from "@bufbuild/protobuf/wkt";
import { ErrandDemandService } from "../gen/sast/sastshopv2/errand/v1/errand_demand_service_pb";
import { resolveDataSource, type ServiceOptions } from "../data-source";
import { FeatureUnavailableError, ValidationError } from "../errors";
import { createLocalTransport, requestLocal } from "../local-connect";

export interface CreateErrandDemandInput {
  storeId: string;
  deadline: string;
  items: Array<{
    productTemplateId: string;
    quantity: number;
    serviceFeePerUnitCents: number;
    updatedAt?: string | null;
  }>;
}

export interface CreateErrandDemandResult {
  errandDemandId: string;
}

export async function createErrandDemand(
  input: CreateErrandDemandInput,
  options: ServiceOptions = {},
): Promise<CreateErrandDemandResult> {
  validateCreateErrandDemandInput(input);
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      ErrandDemandService,
      createLocalTransport(options),
    );
    const response = await requestLocal("createErrandDemand", () =>
      client.createErrandDemand({
        storeId: parseInt64(input.storeId, "店铺 ID 不正确"),
        deadline: parseRequiredTimestamp(input.deadline, "期望送达时间不正确"),
        demandItems: input.items.map((item) => ({
          productTemplateId: parseInt64(
            item.productTemplateId,
            "商品模板 ID 不正确",
          ),
          quantity: item.quantity,
          serviceFeePerUnitCents: item.serviceFeePerUnitCents,
          updatedAt: parseOptionalTimestamp(item.updatedAt),
        })),
      }),
    );

    return {
      errandDemandId: response.errandDemandId.toString(),
    };
  }

  throw new FeatureUnavailableError("createErrandDemand");
}

function validateCreateErrandDemandInput(input: CreateErrandDemandInput) {
  parseInt64(input.storeId, "店铺 ID 不正确");
  parseRequiredTimestamp(input.deadline, "期望送达时间不正确");

  if (input.items.length === 0) {
    throw new ValidationError("跑腿需求不能为空");
  }

  for (const item of input.items) {
    parseInt64(item.productTemplateId, "商品模板 ID 不正确");

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new ValidationError("跑腿需求数量不正确");
    }

    if (
      !Number.isInteger(item.serviceFeePerUnitCents) ||
      item.serviceFeePerUnitCents < 0
    ) {
      throw new ValidationError("跑腿费不正确");
    }

    parseOptionalTimestamp(item.updatedAt);
  }
}

function parseInt64(value: string, message: string): bigint {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ValidationError(message);
  }

  return BigInt(value);
}

function parseRequiredTimestamp(value: string, message: string): Timestamp {
  const timestamp = parseOptionalTimestamp(value);

  if (!timestamp) {
    throw new ValidationError(message);
  }

  return timestamp;
}

function parseOptionalTimestamp(value?: string | null): Timestamp | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("时间格式不正确");
  }

  return timestampFromDate(date);
}
```

- [ ] **Step 4: Export the facade**

Modify `packages/api/src/index.ts`:

```ts
export {
  createErrandDemand,
  type CreateErrandDemandInput,
  type CreateErrandDemandResult,
} from "./services/errand-demands";
```

Place the export near the existing order service exports.

- [ ] **Step 5: Run the focused test**

Run:

```bash
pnpm --filter @sast-shop/api test -- errand-demands.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/services/errand-demands.ts packages/api/src/services/errand-demands.test.ts packages/api/src/index.ts
git commit -m "feat(api): add errand demand facade"
```

---

### Task 2: Add Buyer Errand Order List Facade

**Files:**

- Create: `packages/api/src/services/buyer-errand-orders.test.ts`
- Create: `packages/api/src/services/buyer-errand-orders.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Write failing list facade tests**

Create `packages/api/src/services/buyer-errand-orders.test.ts` with:

```ts
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { FeatureUnavailableError, ValidationError } from "../errors";
import {
  listBuyerErrandOrders,
  type BuyerErrandOrder,
} from "./buyer-errand-orders";

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
};

describe("buyer errand order service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes stable buyer errand order return types", () => {
    expectTypeOf<ReturnType<typeof listBuyerErrandOrders>>().toEqualTypeOf<
      Promise<BuyerErrandOrder[]>
    >();
  });

  it("lists buyer errand orders through the local Connect backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        orders: [
          {
            errandDemandId: "7001",
            storeId: "3001",
            createdAt: "1970-01-01T00:00:01Z",
            storeInfo: {
              id: "3001",
              name: "SAST 小卖部",
              address: "仙林校区",
              logoUrl: "https://example.com/logo.png",
              themeColor: "#c9431f",
            },
            status: "ERRAND_DEMAND_STATUS_OPEN",
            productTemplates: [
              {
                id: "1001",
                title: "SAST 贴纸",
                description: "社团周边",
                priceCents: 1599,
                storeId: "3001",
                mainImageUrl: "https://example.com/sticker.png",
                barcode: "690000000001",
                updatedAt: "1970-01-01T00:00:02Z",
              },
            ],
            totalOriginAmountCents: 3198,
            totalServiceFeeCents: 300,
            productTotalCount: 1,
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const orders = await listBuyerErrandOrders({
      ...localOptions,
      status: "open",
      page: 1,
      pageSize: 20,
    });

    expect(orders).toEqual([
      expect.objectContaining({
        id: "7001",
        storeId: "3001",
        createdAt: "1970-01-01T00:00:01.000Z",
        status: "open",
        totalOriginAmountCents: 3198,
        totalActualAmountCents: null,
        totalServiceFeeCents: 300,
        productTotalCount: 1,
        store: expect.objectContaining({
          id: "3001",
          name: "SAST 小卖部",
        }),
        productTemplates: [
          expect.objectContaining({
            id: "1001",
            title: "SAST 贴纸",
          }),
        ],
      }),
    ]);
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.BuyerErrandOrderService/GetBuyerErrandOrderBrief",
      body: {
        page: 1,
        pageSize: 20,
        statusFilter: "ERRAND_DEMAND_STATUS_OPEN",
      },
    });
  });

  it("validates buyer errand order filters before submitting requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listBuyerErrandOrders({ ...localOptions, storeId: "0" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      listBuyerErrandOrders({ ...localOptions, page: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      listBuyerErrandOrders({ ...localOptions, pageSize: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws for remote list mode before backend client is wired", async () => {
    await expect(
      listBuyerErrandOrders({ dataSource: "remote" }),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });
});

function stubJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

async function expectConnectRequest(
  fetchMock: ReturnType<typeof vi.fn>,
  expected: {
    path: string;
    body: Record<string, unknown>;
  },
) {
  const [input, init] = fetchMock.mock.calls[0] ?? [];
  const url = typeof input === "string" ? input : (input as Request).url;
  const body =
    typeof input === "string"
      ? init?.body
      : await (input as Request).clone().text();

  expect(new URL(url).pathname).toBe(expected.path);
  expect(JSON.parse(bodyToText(body))).toEqual(expected.body);
}

function bodyToText(body: unknown): string {
  if (body instanceof Uint8Array) {
    return new TextDecoder().decode(body);
  }

  if (body instanceof ArrayBuffer) {
    return new TextDecoder().decode(body);
  }

  return String(body);
}
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
pnpm --filter @sast-shop/api test -- buyer-errand-orders.test.ts
```

Expected: fail because `./buyer-errand-orders` does not exist.

- [ ] **Step 3: Implement `buyer-errand-orders.ts`**

Create `packages/api/src/services/buyer-errand-orders.ts` with these exported names and mappings:

```ts
import { createClient } from "@connectrpc/connect";
import type { ProductTemplate as ProtoProductTemplate } from "../gen/sast/sastshopv2/catalog/v1/product_template_pb";
import type { Store as ProtoStore } from "../gen/sast/sastshopv2/catalog/v1/store_pb";
import type { BuyerErrandOrderBrief as ProtoBuyerErrandOrderBrief } from "../gen/sast/sastshopv2/errand/v1/buyer_errand_order_pb";
import { BuyerErrandOrderService } from "../gen/sast/sastshopv2/errand/v1/buyer_errand_order_service_pb";
import { ErrandDemandStatus } from "../gen/sast/sastshopv2/errand/v1/errand_demand_status_pb";
import { resolveDataSource, type ServiceOptions } from "../data-source";
import { FeatureUnavailableError, ValidationError } from "../errors";
import { createLocalTransport, requestLocal } from "../local-connect";
import type { ProductTemplate } from "./product-templates";
import type { Store } from "./catalog";

export type BuyerErrandOrderStatus =
  | "open"
  | "shopping"
  | "pending_distributing"
  | "distributing"
  | "pending_payment"
  | "completed"
  | "cancelled"
  | "unknown";

export interface BuyerErrandOrder {
  id: string;
  storeId: string;
  createdAt: string | null;
  store: Store | null;
  status: BuyerErrandOrderStatus;
  productTemplates: ProductTemplate[];
  totalOriginAmountCents: number;
  totalActualAmountCents: number | null;
  totalServiceFeeCents: number;
  productTotalCount: number;
}

export async function listBuyerErrandOrders(
  options: ServiceOptions & {
    storeId?: string;
    status?: BuyerErrandOrderStatus;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<BuyerErrandOrder[]> {
  validateListOptions(options);
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      BuyerErrandOrderService,
      createLocalTransport(options),
    );
    const response = await requestLocal("listBuyerErrandOrders", () =>
      client.getBuyerErrandOrderBrief({
        page: options.page ?? 1,
        pageSize: options.pageSize ?? 50,
        storeIdFilter: options.storeId
          ? parseInt64(options.storeId, "店铺 ID 不正确")
          : undefined,
        statusFilter: options.status
          ? mapStatusToProto(options.status)
          : undefined,
      }),
    );

    return response.orders.map(mapBuyerErrandOrder);
  }

  throw new FeatureUnavailableError("listBuyerErrandOrders");
}

function validateListOptions(options: {
  storeId?: string;
  page?: number;
  pageSize?: number;
}) {
  if (options.storeId) {
    parseInt64(options.storeId, "店铺 ID 不正确");
  }

  if (
    options.page !== undefined &&
    (!Number.isInteger(options.page) || options.page <= 0)
  ) {
    throw new ValidationError("页码不正确");
  }

  if (
    options.pageSize !== undefined &&
    (!Number.isInteger(options.pageSize) || options.pageSize <= 0)
  ) {
    throw new ValidationError("分页大小不正确");
  }
}

function mapBuyerErrandOrder(
  order: ProtoBuyerErrandOrderBrief,
): BuyerErrandOrder {
  return {
    id: order.errandDemandId.toString(),
    storeId: order.storeId.toString(),
    createdAt: order.createdAt
      ? new Date(Number(order.createdAt.seconds) * 1000).toISOString()
      : null,
    store: mapStore(order.storeInfo),
    status: mapStatusFromProto(order.status),
    productTemplates: order.productTemplates.map(mapTemplate),
    totalOriginAmountCents: order.totalOriginAmountCents,
    totalActualAmountCents: order.totalActualAmountCents ?? null,
    totalServiceFeeCents: order.totalServiceFeeCents,
    productTotalCount: order.productTotalCount,
  };
}

function mapStore(store?: ProtoStore): Store | null {
  if (!store) return null;

  return {
    id: store.id.toString(),
    name: store.name,
    address: store.address,
    logoUrl: store.logoUrl,
    themeColor: store.themeColor,
  };
}

function mapTemplate(template?: ProtoProductTemplate): ProductTemplate {
  return {
    id: template?.id.toString() ?? "0",
    title: template?.title ?? "未命名商品",
    description: template?.description ?? "",
    priceCents: template?.priceCents ?? 0,
    storeId: template?.storeId.toString() ?? "0",
    mainImageUrl: template?.mainImageUrl ?? "",
    barcode: template?.barcode ?? "",
    updatedAt: template?.updatedAt
      ? new Date(Number(template.updatedAt.seconds) * 1000).toISOString()
      : null,
  };
}

function mapStatusFromProto(
  status: ErrandDemandStatus,
): BuyerErrandOrderStatus {
  if (status === ErrandDemandStatus.OPEN) return "open";
  if (status === ErrandDemandStatus.SHOPPING) return "shopping";
  if (status === ErrandDemandStatus.PENDING_DISTRIBUTING)
    return "pending_distributing";
  if (status === ErrandDemandStatus.DISTRIBUTING) return "distributing";
  if (status === ErrandDemandStatus.PENDING_PAYMENT) return "pending_payment";
  if (status === ErrandDemandStatus.COMPLETED) return "completed";
  if (status === ErrandDemandStatus.CANCELLED) return "cancelled";
  return "unknown";
}

function mapStatusToProto(
  status: BuyerErrandOrderStatus,
): ErrandDemandStatus | undefined {
  if (status === "open") return ErrandDemandStatus.OPEN;
  if (status === "shopping") return ErrandDemandStatus.SHOPPING;
  if (status === "pending_distributing")
    return ErrandDemandStatus.PENDING_DISTRIBUTING;
  if (status === "distributing") return ErrandDemandStatus.DISTRIBUTING;
  if (status === "pending_payment") return ErrandDemandStatus.PENDING_PAYMENT;
  if (status === "completed") return ErrandDemandStatus.COMPLETED;
  if (status === "cancelled") return ErrandDemandStatus.CANCELLED;
  return undefined;
}

function parseInt64(value: string, message: string): bigint {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ValidationError(message);
  }

  return BigInt(value);
}
```

- [ ] **Step 4: Export the list facade**

Modify `packages/api/src/index.ts`:

```ts
export {
  listBuyerErrandOrders,
  type BuyerErrandOrder,
  type BuyerErrandOrderStatus,
} from "./services/buyer-errand-orders";
```

- [ ] **Step 5: Run focused API tests**

Run:

```bash
pnpm --filter @sast-shop/api test -- buyer-errand-orders.test.ts errand-demands.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/services/buyer-errand-orders.ts packages/api/src/services/buyer-errand-orders.test.ts packages/api/src/index.ts
git commit -m "feat(api): add buyer errand order facade"
```

---

### Task 3: Add Errand Delivery Time Utility

**Files:**

- Create: `apps/mobile/lib/errand-delivery-time.test.ts`
- Create: `apps/mobile/lib/errand-delivery-time.ts`

- [ ] **Step 1: Write failing delivery-time tests**

Create `apps/mobile/lib/errand-delivery-time.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  getDefaultErrandDeadline,
  isValidErrandDeadline,
  toDateTimeLocalValue,
} from "./errand-delivery-time";

describe("errand delivery time", () => {
  it("defaults to today 22:00 before 20:00 when that is at least two hours away", () => {
    const now = new Date("2026-06-09T10:30:00+08:00");

    expect(getDefaultErrandDeadline(now).toISOString()).toBe(
      "2026-06-09T14:00:00.000Z",
    );
  });

  it("defaults to tomorrow 22:00 at or after 20:00", () => {
    const now = new Date("2026-06-09T20:01:00+08:00");

    expect(getDefaultErrandDeadline(now).toISOString()).toBe(
      "2026-06-10T14:00:00.000Z",
    );
  });

  it("uses the next valid half-hour slot when today 22:00 is too soon", () => {
    const now = new Date("2026-06-09T21:30:00+08:00");

    expect(getDefaultErrandDeadline(now).toISOString()).toBe(
      "2026-06-10T14:00:00.000Z",
    );
  });

  it("validates deadlines at least two hours in the future", () => {
    const now = new Date("2026-06-09T10:00:00+08:00");

    expect(
      isValidErrandDeadline(new Date("2026-06-09T11:59:00+08:00"), now),
    ).toBe(false);
    expect(
      isValidErrandDeadline(new Date("2026-06-09T12:00:00+08:00"), now),
    ).toBe(true);
  });

  it("formats datetime-local values in local date and minute precision", () => {
    const date = new Date("2026-06-09T22:05:30+08:00");

    expect(toDateTimeLocalValue(date)).toBe("2026-06-09T22:05");
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
pnpm --filter @sast-shop/mobile test -- errand-delivery-time.test.ts
```

Expected: fail because `./errand-delivery-time` does not exist.

- [ ] **Step 3: Implement the utility**

Create `apps/mobile/lib/errand-delivery-time.ts`:

```ts
const DELIVERY_CUTOFF_HOUR = 20;
const DEFAULT_DELIVERY_HOUR = 22;
const MIN_LEAD_TIME_MS = 2 * 60 * 60 * 1000;

export function getDefaultErrandDeadline(now = new Date()): Date {
  const candidate = new Date(now);

  if (now.getHours() >= DELIVERY_CUTOFF_HOUR) {
    candidate.setDate(candidate.getDate() + 1);
  }

  candidate.setHours(DEFAULT_DELIVERY_HOUR, 0, 0, 0);

  if (candidate.getTime() - now.getTime() < MIN_LEAD_TIME_MS) {
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(DEFAULT_DELIVERY_HOUR, 0, 0, 0);
  }

  return candidate;
}

export function isValidErrandDeadline(deadline: Date, now = new Date()) {
  return deadline.getTime() - now.getTime() >= MIN_LEAD_TIME_MS;
}

export function toDateTimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}
```

- [ ] **Step 4: Run the focused mobile test**

Run:

```bash
pnpm --filter @sast-shop/mobile test -- errand-delivery-time.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/errand-delivery-time.ts apps/mobile/lib/errand-delivery-time.test.ts
git commit -m "feat(mobile): add errand delivery deadline helpers"
```

---

### Task 4: Add Mobile Store Detail Route

**Files:**

- Modify: `apps/mobile/app/group/page.tsx`
- Create: `apps/mobile/app/group/shop/[id]/page.tsx`

- [ ] **Step 1: Make group store cards navigable**

In `apps/mobile/app/group/page.tsx`, import `Link`:

```ts
import Link from "next/link";
```

Wrap each `StoreCard` in:

```tsx
<Link
  key={store.id}
  href={`/group/shop/${store.id}`}
  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
>
  <StoreCard store={store} />
</Link>
```

Remove `key={store.id}` from the `StoreCard` itself in the map because the key is now on `Link`.

- [ ] **Step 2: Create the server route**

Create `apps/mobile/app/group/shop/[id]/page.tsx`:

```tsx
import {
  listProductTemplates,
  listStores,
  type ProductTemplate,
  type Store,
} from "@sast-shop/api";
import { Empty } from "@workspace/ui/components/empty";
import { RiStore2Line } from "@remixicon/react";
import { ErrandShop } from "@/components/errand-shop";
import { mobileAppConfig } from "@/lib/app-config";

async function loadStoreDetail(storeId: string): Promise<{
  store: Store | null;
  templates: ProductTemplate[];
  error: string | null;
}> {
  try {
    const [stores, templates] = await Promise.all([
      listStores({
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
      }),
      listProductTemplates({
        storeId,
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
      }),
    ]);

    return {
      store: stores.find((store) => store.id === storeId) ?? null,
      templates,
      error: null,
    };
  } catch {
    return {
      store: null,
      templates: [],
      error: "店铺商品暂不可用，请确认 mock 服务或稍后再试",
    };
  }
}

export default async function GroupShopPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadStoreDetail(id);

  if (result.error || !result.store) {
    return (
      <div className="flex flex-1 flex-col py-6">
        <Empty
          icon={<RiStore2Line className="size-5" />}
          title="店铺暂不可用"
          description={result.error ?? "没有找到对应店铺。"}
        />
      </div>
    );
  }

  return (
    <ErrandShop
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      store={result.store}
      templates={result.templates}
    />
  );
}
```

- [ ] **Step 3: Add a temporary component stub to make the route typecheck**

Create `apps/mobile/components/errand-shop.tsx` with:

```tsx
"use client";

import type { DataSource, ProductTemplate, Store } from "@sast-shop/api";

export function ErrandShop({
  store,
  templates,
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  store: Store;
  templates: ProductTemplate[];
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 py-6">
      <h1 className="text-xl font-semibold">{store.name}</h1>
      <p className="text-sm text-muted-foreground">
        {templates.length} 个可选商品模板
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run route typecheck**

Run:

```bash
pnpm --filter @sast-shop/mobile typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/group/page.tsx apps/mobile/app/group/shop/[id]/page.tsx apps/mobile/components/errand-shop.tsx
git commit -m "feat(mobile): add errand store route"
```

---

### Task 5: Build Errand Shop Cart UI

**Files:**

- Modify: `apps/mobile/components/errand-shop.tsx`

- [ ] **Step 1: Replace the stub with client cart state**

In `apps/mobile/components/errand-shop.tsx`, keep the existing exported `ErrandShop` name and implement these local types:

```ts
type ErrandCartItem = {
  template: ProductTemplate;
  quantity: number;
  serviceFeePerUnitCents: number;
};
```

Use `useMemo` for totals:

```ts
const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
const totalOriginAmountCents = items.reduce(
  (sum, item) => sum + item.template.priceCents * item.quantity,
  0,
);
const totalServiceFeeCents = items.reduce(
  (sum, item) => sum + item.serviceFeePerUnitCents * item.quantity,
  0,
);
```

Before writing JSX, write this comment as a temporary checklist in your working notes, not in the source file:

```text
UI quality checklist:
- Task-first, not retail-first.
- Compact product cards, no nested cards, no broad shadows.
- Action Coral only for primary action and active controls.
- Quantity, fee, deadline, and totals visible before submit.
- Drawer failure preserves state.
```

- [ ] **Step 2: Render the store header and sticky hint**

Use this structure as a starting point, then adjust spacing after browser inspection if it feels too much like a copied retail grid:

```tsx
<div className="flex flex-1 flex-col">
  <section className="flex flex-col gap-3 py-6">
    <div className="flex items-center gap-3">
      <ManagedImage
        src={store.logoUrl}
        alt={store.name}
        className="size-14 rounded-lg bg-muted"
        imageClassName="p-2"
      />
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold">{store.name}</h1>
        <p className="truncate text-sm text-muted-foreground">
          {store.address}
        </p>
      </div>
    </div>
  </section>

  <section className="sticky top-13 z-10 -mx-4 border-y bg-background/95 px-4 py-3 backdrop-blur">
    <p className="text-sm font-medium">发起跑腿需求</p>
    <p className="text-xs text-muted-foreground">
      选择商品模板，设置数量、单件跑腿费与期望送达时间。
    </p>
  </section>
</div>
```

Use `top-13` only if it exists in this Tailwind setup. If it does not compile, use `top-[3.25rem]`.

- [ ] **Step 3: Render product cards**

For each template, render a `Card` with:

- `ManagedImage` using `template.mainImageUrl`.
- Title.
- Description.
- `formatPrice(template.priceCents)` from `@sast-shop/domain`.
- `Badge` text `店铺标价`.
- Button text `加入清单` when quantity is zero.
- Quantity controls with `-` and `+` icon buttons when selected.

Use remixicon `RiAddLine`, `RiSubtractLine`, and `RiShoppingBag3Line`.

Design constraints:

- Use `rounded-lg` or less.
- Do not pair a visible border with a broad soft shadow.
- Use `line-clamp-2` for long product names and `truncate` for barcode/spec metadata.
- The add button label is `加入清单`; quantity buttons use icons with accessible labels.
- Body text uses existing foreground/muted tokens and must remain readable on the card background.

- [ ] **Step 4: Add product detail drawer**

Use `ResponsiveDialog` for product detail. Content:

- Title.
- Image.
- Price row.
- `商品规格`.
- `条码编号`.
- Muted note: `商品标价仅用于预估，最终金额以团长实际采购结果为准。`

- [ ] **Step 5: Add bottom cart bar**

Render a fixed bottom action inside the mobile content area:

```tsx
<div className="sticky bottom-0 z-20 -mx-4 mt-auto border-t bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur">
  <Button
    type="button"
    size="lg"
    disabled={totalCount === 0}
    className="h-12 w-full justify-between rounded-lg"
    onClick={() => setCartOpen(true)}
  >
    <span className="flex items-center gap-2">
      <RiShoppingCartLine className="size-5" />
      {totalCount > 0 ? `${totalCount} 件` : "跑腿清单"}
    </span>
    <span>
      {totalCount > 0
        ? formatPrice(totalOriginAmountCents + totalServiceFeeCents)
        : "选择商品后发起需求"}
    </span>
  </Button>
</div>
```

- [ ] **Step 6: Add cart drawer and confirmation flow**

Use `ResponsiveDialog` for `cartOpen`.

Drawer content:

- Header `跑腿清单`.
- Empty state with `Empty` when there are no items.
- Item rows with quantity controls and `InputGroup` money input.
- `input type="datetime-local"` bound to `deadlineValue`.
- Totals rows.
- Muted settlement note.
- Submit button `确认发起跑腿需求`.

Drawer design constraints:

- The drawer is a working surface. Keep it dense but calm.
- Totals should be aligned in a simple vertical summary, not in separate decorative cards.
- Destructive clear/remove actions use existing destructive styling and require confirmation only for clearing the whole cart.
- Submission loading disables the submit button and keeps the drawer content visible.

Before submit:

```ts
const deadline = new Date(deadlineValue);

if (!isValidErrandDeadline(deadline)) {
  toast.error("期望送达时间至少需要在 2 小时后");
  return;
}
```

Submit:

```ts
await createErrandDemand(
  {
    storeId: store.id,
    deadline: deadline.toISOString(),
    items: items.map((item) => ({
      productTemplateId: item.template.id,
      quantity: item.quantity,
      serviceFeePerUnitCents: item.serviceFeePerUnitCents,
      updatedAt: item.template.updatedAt,
    })),
  },
  serviceOptions,
);
```

Success:

```ts
toast.success("跑腿需求已发起");
setItems([]);
setCartOpen(false);
router.push("/orders?source=errand&perspective=purchaser");
```

Failure:

```ts
toast.error("跑腿需求提交失败，请稍后再试");
```

Keep the drawer open on failure.

- [ ] **Step 7: Run mobile typecheck**

Run:

```bash
pnpm --filter @sast-shop/mobile typecheck
```

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/components/errand-shop.tsx
git commit -m "feat(mobile): build errand cart flow"
```

---

### Task 6: Wire Buyer Errand Orders Into Orders Page

**Files:**

- Modify: `apps/mobile/app/orders/page.tsx`
- Modify: `apps/mobile/components/orders-view.tsx`

- [ ] **Step 1: Load buyer errand orders on the server page**

Modify `apps/mobile/app/orders/page.tsx`:

```tsx
import { listBuyerErrandOrders, listSpotOrders } from "@sast-shop/api";
```

Return both arrays:

```ts
async function getOrders() {
  try {
    const [spotOrders, buyerErrandOrders] = await Promise.all([
      listSpotOrders({
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
      }),
      listBuyerErrandOrders({
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
      }),
    ]);

    return {
      spotOrders,
      buyerErrandOrders,
      error: null,
    };
  } catch {
    return {
      spotOrders: [],
      buyerErrandOrders: [],
      error: "订单暂不可用，请确认 mock 服务或稍后再试",
    };
  }
}
```

Render:

```tsx
return (
  <OrdersView
    spotOrders={result.spotOrders}
    buyerErrandOrders={result.buyerErrandOrders}
    error={result.error}
  />
);
```

- [ ] **Step 2: Add errand order props and status labels**

In `apps/mobile/components/orders-view.tsx`, import the type:

```ts
import type { BuyerErrandOrder, SpotOrder } from "@sast-shop/api";
```

Add status labels:

```ts
const errandStatusLabel: Record<string, string> = {
  open: "未接单",
  shopping: "采购中",
  pending_distributing: "待分发",
  distributing: "分发中",
  pending_payment: "待支付",
  completed: "已完成",
  cancelled: "已取消",
  unknown: "未知",
};
```

- [ ] **Step 3: Map buyer errand orders for filtering**

Add:

```ts
const errandOrders = useMemo(
  () =>
    buyerErrandOrders.map((order) => ({
      id: order.id,
      source: "errand" as const,
      title:
        order.productTemplates
          .map((template) => template.title)
          .filter(Boolean)
          .slice(0, 3)
          .join("、") || "跑腿需求",
      store: order.store?.name ?? "跑腿店铺",
      status: order.status,
      amount:
        order.totalActualAmountCents ??
        order.totalOriginAmountCents + order.totalServiceFeeCents,
      summary: `${order.productTotalCount} 种商品 · 跑腿费 ${formatPrice(
        order.totalServiceFeeCents,
      )}`,
    })),
  [buyerErrandOrders],
);
```

Keep spot and errand filters separate so spot status values do not hide errand statuses incorrectly.

- [ ] **Step 4: Render `跑腿订单 / 我买的` cards**

In the `TabsContent` body:

- For `item.value === "spot" && perspective === "purchaser"`, keep existing spot card rendering.
- For `item.value === "errand" && perspective === "purchaser"`, render errand cards using `errandStatusLabel`.
- For `item.value === "errand" && perspective === "seller"`, render `Empty` with title `跑腿没有卖家视角`.
- For `item.value === "captain"`, keep `暂未接入`.

Errand card title:

```tsx
<CardTitle className="mt-2 line-clamp-2 text-base leading-6">
  {order.title}
</CardTitle>
```

Errand amount:

```tsx
<p className="shrink-0 text-base font-semibold text-primary">
  {formatPrice(order.amount)}
</p>
```

- [ ] **Step 5: Run mobile typecheck**

Run:

```bash
pnpm --filter @sast-shop/mobile typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/orders/page.tsx apps/mobile/components/orders-view.tsx
git commit -m "feat(mobile): show buyer errand orders"
```

---

### Task 7: Final Verification And Visual Smoke

**Files:**

- No planned code changes unless verification finds a defect.

- [ ] **Step 1: Run API tests**

Run:

```bash
pnpm --filter @sast-shop/api test
```

Expected: pass.

- [ ] **Step 2: Run mobile tests**

Run:

```bash
pnpm --filter @sast-shop/mobile test
```

Expected: pass.

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm lint
```

Expected: pass.

- [ ] **Step 4: Run build**

Run:

```bash
pnpm build
```

Expected: pass. If Turbopack fails in the sandbox due to port permissions, rerun with approval in the normal escalation flow.

- [ ] **Step 5: Start mobile dev server**

Run:

```bash
pnpm dev:mobile
```

Expected: server starts on `http://localhost:3001`.

- [ ] **Step 6: Inspect in Codex in-app Browser**

Use the in-app Browser at mobile viewport `390x844`.

Check:

- `http://localhost:3001/group` shows navigable store cards.
- Store card opens `/group/shop/[id]`.
- Store detail header, sticky hint, template grid, and bottom cart bar fit without overlap.
- Add item, increase/decrease quantity, and open cart drawer.
- Change service fee and deadline; totals update.
- Too-soon deadline blocks submit with toast.
- Submit success navigates to `/orders?source=errand&perspective=purchaser`.
- Errand order tab shows cards or a clear empty/error state.
- Drawer and bottom cart bar do not collide with bottom nav or safe area.

Reset the temporary browser viewport after the smoke check.

- [ ] **Step 7: Commit verification fixes if needed**

If verification required code fixes:

```bash
git add <changed-files>
git commit -m "fix: polish buyer errand flow"
```

If no fixes were required, do not create an empty commit.
