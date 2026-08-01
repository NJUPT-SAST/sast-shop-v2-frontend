# Payment QR Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the text-only payment QR flow, backend bill-backed spot payment, auth-gated remote access, shared empty states, and the related mobile UX fixes.

**Architecture:** Domain owns payment QR validation. API facade maps generated Connect services into serializable frontend types. Mobile owns browser-only QR image decoding, QR rendering, payment panel state, auth UI, and URL-driven profile dialogs. Shared UI owns reusable `Empty`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, ConnectRPC Web v2, Protobuf-ES v2, Tailwind CSS v4, Vitest, `jsqr`, `qrcode.react`, `next/image`.

---

## File Structure

- Modify: `apps/mobile/package.json`
  - Add `jsqr` and `qrcode.react`.
- Modify: `pnpm-lock.yaml`
  - Updated by `pnpm install`.
- Create: `packages/ui/src/components/empty.tsx`
  - Shared panel-level empty/error state.
- Create: `packages/domain/src/payments/qr-content.ts`
  - Channel allowlist validation and QR text constraints.
- Modify: `packages/domain/src/index.ts`
  - Export QR content helpers.
- Create: `packages/domain/src/payments/qr-content.test.ts`
  - Validation tests.
- Modify: `packages/api/src/services/payment-qr-codes.ts`
  - Reuse domain validation.
- Modify: `packages/api/src/services/payment-qr-codes.test.ts`
  - Test text-only validation.
- Create: `packages/api/src/services/payment-bills.ts`
  - Bill facade for `getBill`, `payBill`, `confirmBill`, and `supplementBillSerialNumber`.
- Create: `packages/api/src/services/payment-bills.test.ts`
  - Local Connect tests for bill facade.
- Modify: `packages/api/src/services/spot-orders.ts`
  - Map embedded `bill` from `SpotOrderDetail`.
- Modify: `packages/api/src/services/spot-orders.test.ts`
  - Assert bill fields are exposed.
- Modify: `packages/api/src/index.ts`
  - Export bill types/functions.
- Create: `apps/mobile/lib/qr-image-decoder.ts`
  - Browser-only image file to QR text decoder.
- Create: `apps/mobile/lib/qr-image-decoder.test.ts`
  - Unit tests with mocked decoder path.
- Create: `apps/mobile/components/payment-qr-code.tsx`
  - Render QR text with centered channel logo.
- Modify: `apps/mobile/components/profile-dialogs-provider.tsx`
  - Decode uploads, validate channel, render generated QR, support URL query opening.
- Modify: `apps/mobile/components/payment-dialog.tsx`
  - Loading, ready, submitted, and error states.
- Modify: `apps/mobile/components/spot-marketplace.tsx`
  - Create order/bill before showing ready payment state; call `payBill`.
- Modify: `apps/mobile/components/publish-spot-form.tsx`
  - Require seller QR before publishing and open QR dialog if missing.
- Modify: `apps/mobile/components/orders-view.tsx`
  - Buyer/seller perspective and URL-backed filters.
- Modify: `apps/mobile/components/managed-image.tsx`
  - Replace `<img>` with `next/image`.
- Modify: `apps/mobile/next.config.ts`
  - Allow remote image hosts needed by mock/product images or use `unoptimized`.
- Modify: `apps/mobile/lib/app-config.ts`
  - Add `authMode`.
- Modify: `apps/desktop/lib/app-config.ts`
  - Add `authMode`.
- Create: `apps/mobile/lib/auth-mode.ts`
  - Parse `off|required`.
- Create: `apps/mobile/app/api/connect/[...path]/route.ts`
  - Authenticated proxy for real backend.
- Create: `apps/mobile/app/api/auth/session/route.ts`
  - Session cookie endpoint for login result.
- Modify: `apps/mobile/.env.example`
  - Document auth mode.
- Modify: `apps/desktop/.env.example`
  - Document auth mode.

---

### Task 1: Add QR Dependencies

**Files:**

- Modify: `apps/mobile/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Install dependencies**

Run:

```bash
pnpm --filter @sast-shop/mobile add jsqr qrcode.react
```

Expected: `apps/mobile/package.json` includes both dependencies and `pnpm-lock.yaml` updates.

- [ ] **Step 2: Run package typecheck**

Run:

```bash
pnpm --filter @sast-shop/mobile typecheck
```

Expected: PASS. The packages are installed but unused.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml
git commit -m "chore: add qr dependencies"
```

---

### Task 2: Add Shared Empty Component

**Files:**

- Create: `packages/ui/src/components/empty.tsx`

- [ ] **Step 1: Create shared component**

Create `packages/ui/src/components/empty.tsx`:

```tsx
import * as React from "react";

import { cn } from "#lib/utils";

function Empty({
  className,
  icon,
  title,
  description,
  action,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-h-36 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div className="flex size-11 items-center justify-center rounded-full bg-background text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-[36ch] text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export { Empty };
```

- [ ] **Step 2: Typecheck UI package**

Run:

```bash
pnpm --filter @workspace/ui test
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/empty.tsx
git commit -m "feat: add shared empty state"
```

---

### Task 3: Add Domain QR Text Validation

**Files:**

- Create: `packages/domain/src/payments/qr-content.ts`
- Create: `packages/domain/src/payments/qr-content.test.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Write failing validation tests**

Create `packages/domain/src/payments/qr-content.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  MAX_PAYMENT_QR_CONTENT_LENGTH,
  isPaymentQrContentAllowed,
  validatePaymentQrContent,
} from "./qr-content";

describe("payment QR content validation", () => {
  it("accepts recognized WeChat QR content", () => {
    expect(isPaymentQrContentAllowed("wechat", "wxp://f2f0example")).toBe(true);
    expect(
      isPaymentQrContentAllowed(
        "wechat",
        "https://wx.tenpay.com/f2f?t=AQAAATEST",
      ),
    ).toBe(true);
  });

  it("accepts recognized Alipay QR content", () => {
    expect(
      isPaymentQrContentAllowed("alipay", "https://qr.alipay.com/fkx123"),
    ).toBe(true);
    expect(
      isPaymentQrContentAllowed(
        "alipay",
        "alipays://platformapi/startapp?saId=10000007",
      ),
    ).toBe(true);
  });

  it("rejects content for the wrong channel", () => {
    expect(
      isPaymentQrContentAllowed("wechat", "https://qr.alipay.com/fkx123"),
    ).toBe(false);
    expect(isPaymentQrContentAllowed("alipay", "wxp://f2f0example")).toBe(
      false,
    );
  });

  it("rejects empty, control-character, and overlong content", () => {
    expect(validatePaymentQrContent("wechat", " ")).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(validatePaymentQrContent("wechat", "wxp://abc\u0000")).toEqual({
      ok: false,
      reason: "control-character",
    });
    expect(
      validatePaymentQrContent(
        "wechat",
        `wxp://${"a".repeat(MAX_PAYMENT_QR_CONTENT_LENGTH)}`,
      ),
    ).toEqual({
      ok: false,
      reason: "too-long",
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --filter @sast-shop/domain test -- qr-content
```

Expected: FAIL because `qr-content.ts` does not exist.

- [ ] **Step 3: Implement validation**

Create `packages/domain/src/payments/qr-content.ts`:

```ts
import type { PaymentPlatform } from "./platforms";

export const MAX_PAYMENT_QR_CONTENT_LENGTH = 512;

export type PaymentQrContentValidationReason =
  "empty" | "too-long" | "control-character" | "unsupported-channel-content";

export type PaymentQrContentValidationResult =
  | { ok: true; content: string }
  | { ok: false; reason: PaymentQrContentValidationReason };

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

const CHANNEL_ALLOWLIST: Record<PaymentPlatform, RegExp[]> = {
  wechat: [
    /^wxp:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/,
    /^weixin:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/,
    /^https:\/\/wx\.tenpay\.com\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/,
  ],
  alipay: [
    /^https:\/\/qr\.alipay\.com\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/,
    /^alipays:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/,
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
  return CHANNEL_ALLOWLIST[channel].some((pattern) =>
    pattern.test(content.trim()),
  );
}
```

- [ ] **Step 4: Export helpers**

Modify `packages/domain/src/index.ts`:

```ts
export {
  MAX_PAYMENT_QR_CONTENT_LENGTH,
  isPaymentQrContentAllowed,
  validatePaymentQrContent,
  type PaymentQrContentValidationReason,
  type PaymentQrContentValidationResult,
} from "./payments/qr-content";
```

- [ ] **Step 5: Run domain tests**

Run:

```bash
pnpm --filter @sast-shop/domain test -- qr-content
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/index.ts packages/domain/src/payments/qr-content.ts packages/domain/src/payments/qr-content.test.ts
git commit -m "feat: validate payment qr text"
```

---

### Task 4: Enforce QR Text Validation in API Facade

**Files:**

- Modify: `packages/api/src/services/payment-qr-codes.ts`
- Modify: `packages/api/src/services/payment-qr-codes.test.ts`

- [ ] **Step 1: Add failing API validation tests**

Add to `packages/api/src/services/payment-qr-codes.test.ts`:

```ts
it("rejects QR image data before submitting update requests", async () => {
  await expect(
    updatePaymentQrCode(
      { channel: "wechat", content: "data:image/png;base64,abc" },
      localOptions,
    ),
  ).rejects.toThrow("收款码内容不符合微信支付格式");
});

it("rejects wrong-channel QR text before submitting update requests", async () => {
  await expect(
    updatePaymentQrCode(
      { channel: "wechat", content: "https://qr.alipay.com/fkx123" },
      localOptions,
    ),
  ).rejects.toThrow("收款码内容不符合微信支付格式");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @sast-shop/api test -- payment-qr-codes
```

Expected: FAIL because current validation only rejects blank content.

- [ ] **Step 3: Reuse domain validation**

Modify imports in `packages/api/src/services/payment-qr-codes.ts`:

```ts
import { validatePaymentQrContent } from "@sast-shop/domain";
```

Replace the non-empty content check inside `validatePaymentQrCodeInput`:

```ts
const content = validatePaymentQrContent(input.channel, input.content);

if (!content.ok) {
  throw new ValidationError(
    `收款码内容不符合${input.channel === "wechat" ? "微信支付" : "支付宝"}格式`,
  );
}
```

Ensure local update sends normalized content:

```ts
const validatedContent = validatePaymentQrCodeInput(input);
```

Change `validatePaymentQrCodeInput` to return the normalized content:

```ts
function validatePaymentQrCodeInput(input: PaymentQrCodeInput): string {
  if (!isPaymentQrChannel(input.channel)) {
    throw new ValidationError("收款码渠道不正确");
  }

  const content = validatePaymentQrContent(input.channel, input.content);

  if (!content.ok) {
    throw new ValidationError(
      `收款码内容不符合${input.channel === "wechat" ? "微信支付" : "支付宝"}格式`,
    );
  }

  return content.content;
}
```

Then call `updateMockPaymentQrCode({ ...input, content: validatedContent })` and send `content: validatedContent` to Connect.

- [ ] **Step 4: Run API tests**

Run:

```bash
pnpm --filter @sast-shop/api test -- payment-qr-codes
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/payment-qr-codes.ts packages/api/src/services/payment-qr-codes.test.ts
git commit -m "feat: enforce payment qr text validation"
```

---

### Task 5: Add Bill Facade

**Files:**

- Create: `packages/api/src/services/payment-bills.ts`
- Create: `packages/api/src/services/payment-bills.test.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Write failing bill facade tests**

Create `packages/api/src/services/payment-bills.test.ts`:

```ts
import { ConnectError } from "@connectrpc/connect";
import { create, toBinary } from "@bufbuild/protobuf";
import { describe, expect, expectTypeOf, it } from "vitest";

import { BillStatus } from "../gen/sast/sastshopv2/payment/v1/bill_pb";
import {
  PayBillResponseSchema,
  GetBillResponseSchema,
} from "../gen/sast/sastshopv2/payment/v1/bill_service_pb";
import { FeatureUnavailableError, ValidationError } from "../errors";
import { getBill, payBill, type PaymentBill } from "./payment-bills";

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "https://connect.test",
};

describe("payment bill service", () => {
  it("exposes stable bill types", () => {
    expectTypeOf(getBill("1")).toEqualTypeOf<Promise<PaymentBill>>();
  });

  it("gets a bill from the local Connect backend", async () => {
    const restoreFetch = mockConnectResponse(
      GetBillResponseSchema,
      create(GetBillResponseSchema, {
        bill: {
          id: 12n,
          billNo: "BILL-12",
          status: BillStatus.UNPAID,
          amountCents: 1234,
          verifyCode: "4821",
        },
      }),
    );

    const bill = await getBill("12", localOptions);

    expect(bill).toMatchObject({
      id: "12",
      billNo: "BILL-12",
      status: "unpaid",
      amountCents: 1234,
      verifyCode: "4821",
    });

    restoreFetch();
  });

  it("pays a bill through the local Connect backend", async () => {
    const restoreFetch = mockConnectResponse(
      PayBillResponseSchema,
      create(PayBillResponseSchema, {
        bill: {
          id: 12n,
          billNo: "BILL-12",
          status: BillStatus.SUBMITTED,
          amountCents: 1234,
          verifyCode: "4821",
        },
      }),
    );

    const bill = await payBill(
      { billId: "12", channel: "wechat" },
      localOptions,
    );

    expect(bill.status).toBe("submitted");
    restoreFetch();
  });

  it("validates bill ids", async () => {
    await expect(getBill("0", localOptions)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("rejects remote until proxy integration is wired", async () => {
    await expect(getBill("1", { dataSource: "remote" })).rejects.toBeInstanceOf(
      FeatureUnavailableError,
    );
  });
});
```

Add this helper at the bottom of `payment-bills.test.ts`:

```ts
function mockConnectResponse<T>(
  schema: Parameters<typeof toBinary<T>>[0],
  message: T,
) {
  const originalFetch = globalThis.fetch;
  const body = toBinary(schema, message);

  globalThis.fetch = vi.fn(
    async () =>
      new Response(body, {
        status: 200,
        headers: {
          "content-type": "application/proto",
        },
      }),
  ) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @sast-shop/api test -- payment-bills
```

Expected: FAIL because `payment-bills.ts` does not exist.

- [ ] **Step 3: Implement bill facade**

Create `packages/api/src/services/payment-bills.ts`:

```ts
import { createClient } from "@connectrpc/connect";
import {
  timestampDate,
  timestampFromDate,
  type Timestamp,
} from "@bufbuild/protobuf/wkt";
import {
  BillStatus,
  type Bill as ProtoBill,
} from "../gen/sast/sastshopv2/payment/v1/bill_pb";
import { Channel } from "../gen/sast/sastshopv2/payment/v1/channel_pb";
import { BillService } from "../gen/sast/sastshopv2/payment/v1/bill_service_pb";
import { resolveDataSource, type ServiceOptions } from "../data-source";
import { FeatureUnavailableError, ValidationError } from "../errors";
import { createLocalTransport, requestLocal } from "../local-connect";
import type { PaymentQrChannel } from "./payment-qr-codes";

export type PaymentBillStatus =
  "unpaid" | "submitted" | "completed" | "closed" | "unknown";

export interface PaymentBill {
  id: string;
  billNo: string;
  status: PaymentBillStatus;
  amountCents: number;
  verifyCode: string;
  channel: PaymentQrChannel | null;
  serialNumber: string | null;
  updatedAt: string | null;
}

export interface PayBillInput {
  billId: string;
  channel: PaymentQrChannel;
  updatedAt?: string | Timestamp | null;
}

export async function getBill(
  id: string,
  options: ServiceOptions = {},
): Promise<PaymentBill> {
  const dataSource = resolveDataSource(options);

  if (dataSource === "local") {
    const client = createClient(BillService, createLocalTransport(options));
    const response = await requestLocal("getBill", () =>
      client.getBill({ billId: parseInt64(id, "账单 ID 不正确") }),
    );

    if (!response.bill) {
      throw new FeatureUnavailableError("getBill");
    }

    return mapBill(response.bill);
  }

  throw new FeatureUnavailableError("getBill");
}

export async function payBill(
  input: PayBillInput,
  options: ServiceOptions = {},
): Promise<PaymentBill> {
  const dataSource = resolveDataSource(options);

  if (dataSource === "local") {
    const client = createClient(BillService, createLocalTransport(options));
    const response = await requestLocal("payBill", () =>
      client.payBill({
        billId: parseInt64(input.billId, "账单 ID 不正确"),
        channel: mapChannelToProto(input.channel),
        updatedAt: parseTimestampInput(input.updatedAt),
      }),
    );

    if (!response.bill) {
      throw new FeatureUnavailableError("payBill");
    }

    return mapBill(response.bill);
  }

  throw new FeatureUnavailableError("payBill");
}
```

Add the remaining facade methods and helpers in the same file:

```ts
export async function confirmBill(
  input: { billId: string; updatedAt?: string | Timestamp | null },
  options: ServiceOptions = {},
): Promise<PaymentBill> {
  const dataSource = resolveDataSource(options);

  if (dataSource === "local") {
    const client = createClient(BillService, createLocalTransport(options));
    const response = await requestLocal("confirmBill", () =>
      client.confirmBill({
        billId: parseInt64(input.billId, "账单 ID 不正确"),
        updatedAt: parseTimestampInput(input.updatedAt),
      }),
    );

    if (!response.bill) {
      throw new FeatureUnavailableError("confirmBill");
    }

    return mapPaymentBill(response.bill);
  }

  throw new FeatureUnavailableError("confirmBill");
}

export async function supplementBillSerialNumber(
  input: {
    billId: string;
    serialNumber: string;
    updatedAt?: string | Timestamp | null;
  },
  options: ServiceOptions = {},
): Promise<PaymentBill> {
  const dataSource = resolveDataSource(options);

  if (!input.serialNumber.trim()) {
    throw new ValidationError("支付流水号不能为空");
  }

  if (dataSource === "local") {
    const client = createClient(BillService, createLocalTransport(options));
    const response = await requestLocal("supplementBillSerialNumber", () =>
      client.supplementSerialNumber({
        billId: parseInt64(input.billId, "账单 ID 不正确"),
        serialNumber: input.serialNumber.trim(),
        updatedAt: parseTimestampInput(input.updatedAt),
      }),
    );

    if (!response.bill) {
      throw new FeatureUnavailableError("supplementBillSerialNumber");
    }

    return mapPaymentBill(response.bill);
  }

  throw new FeatureUnavailableError("supplementBillSerialNumber");
}

export function mapPaymentBill(bill: ProtoBill): PaymentBill {
  return {
    id: bill.id.toString(),
    billNo: bill.billNo,
    status: mapStatusFromProto(bill.status),
    amountCents: bill.amountCents,
    verifyCode: bill.verifyCode,
    channel: mapChannelFromProto(bill.channel),
    serialNumber: bill.serialNumber ?? null,
    updatedAt: formatTimestamp(bill.updatedAt),
  };
}

function mapStatusFromProto(status: BillStatus): PaymentBillStatus {
  if (status === BillStatus.UNPAID) return "unpaid";
  if (status === BillStatus.SUBMITTED) return "submitted";
  if (status === BillStatus.COMPLETED) return "completed";
  if (status === BillStatus.CLOSED) return "closed";
  return "unknown";
}

function mapChannelFromProto(channel: Channel): PaymentQrChannel | null {
  if (channel === Channel.WECHAT) return "wechat";
  if (channel === Channel.ALIPAY) return "alipay";
  return null;
}

function mapChannelToProto(channel: PaymentQrChannel): Channel {
  if (channel === "wechat") return Channel.WECHAT;
  if (channel === "alipay") return Channel.ALIPAY;
  throw new ValidationError("支付渠道不正确");
}

function parseInt64(value: string, message: string): bigint {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ValidationError(message);
  }

  return BigInt(value);
}

function parseTimestampInput(
  input?: string | Timestamp | null,
): Timestamp | undefined {
  if (!input) {
    return undefined;
  }

  if (typeof input === "string") {
    return timestampFromDate(new Date(input));
  }

  return input;
}

function formatTimestamp(timestamp?: Timestamp): string | null {
  return timestamp ? timestampDate(timestamp).toISOString() : null;
}
```

- [ ] **Step 4: Export facade**

Modify `packages/api/src/index.ts`:

```ts
export {
  confirmBill,
  getBill,
  payBill,
  supplementBillSerialNumber,
  type PaymentBill,
  type PaymentBillStatus,
  type PayBillInput,
} from "./services/payment-bills";
```

- [ ] **Step 5: Run API tests**

Run:

```bash
pnpm --filter @sast-shop/api test -- payment-bills
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/index.ts packages/api/src/services/payment-bills.ts packages/api/src/services/payment-bills.test.ts
git commit -m "feat: add payment bill facade"
```

---

### Task 6: Expose Embedded Bills on Spot Orders

**Files:**

- Modify: `packages/api/src/services/spot-orders.ts`
- Modify: `packages/api/src/services/spot-orders.test.ts`

- [ ] **Step 1: Add failing spot order bill mapping test**

In `packages/api/src/services/spot-orders.test.ts`, update the create-order response fixture to include:

```ts
bill: {
  id: 91n,
  billNo: "BILL-91",
  amountCents: 2468,
  verifyCode: "9137",
}
```

Then assert:

```ts
expect(orders[0]?.bill).toMatchObject({
  id: "91",
  billNo: "BILL-91",
  amountCents: 2468,
  verifyCode: "9137",
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --filter @sast-shop/api test -- spot-orders
```

Expected: FAIL because `SpotOrder` has no `bill`.

- [ ] **Step 3: Add bill type to SpotOrder**

In `packages/api/src/services/spot-orders.ts`, import and use the bill mapper:

```ts
import type { PaymentBill } from "./payment-bills";
```

Extend `SpotOrder`:

```ts
bill: PaymentBill | null;
```

Set `bill: null` in `mapSpotOrder` and map the embedded detail bill in `mapSpotOrderDetail`.

If `mapBill` is private in `payment-bills.ts`, export it as `mapPaymentBill`:

```ts
export function mapPaymentBill(bill: ProtoBill): PaymentBill;
```

- [ ] **Step 4: Run test**

Run:

```bash
pnpm --filter @sast-shop/api test -- spot-orders payment-bills
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/spot-orders.ts packages/api/src/services/spot-orders.test.ts packages/api/src/services/payment-bills.ts
git commit -m "feat: expose spot order payment bill"
```

---

### Task 7: Add QR Image Decoder and QR Renderer

**Files:**

- Create: `apps/mobile/lib/qr-image-decoder.ts`
- Create: `apps/mobile/lib/qr-image-decoder.test.ts`
- Create: `apps/mobile/components/payment-qr-code.tsx`

- [ ] **Step 1: Write decoder tests**

Create `apps/mobile/lib/qr-image-decoder.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { readQrTextFromFile, QrImageDecodeError } from "./qr-image-decoder";

describe("qr image decoder", () => {
  it("rejects non-image files", async () => {
    const file = new File(["hello"], "note.txt", { type: "text/plain" });

    await expect(readQrTextFromFile(file)).rejects.toBeInstanceOf(
      QrImageDecodeError,
    );
  });

  it("rejects oversized files", async () => {
    const file = new File([new Uint8Array(3 * 1024 * 1024)], "qr.png", {
      type: "image/png",
    });

    await expect(
      readQrTextFromFile(file, { maxBytes: 1024 }),
    ).rejects.toBeInstanceOf(QrImageDecodeError);
  });
});
```

- [ ] **Step 2: Run decoder tests to verify failure**

Run:

```bash
pnpm --filter @sast-shop/mobile test -- qr-image-decoder
```

Expected: FAIL because decoder file does not exist.

- [ ] **Step 3: Implement decoder**

Create `apps/mobile/lib/qr-image-decoder.ts`:

```ts
import jsQR from "jsqr";

export class QrImageDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QrImageDecodeError";
  }
}

export async function readQrTextFromFile(
  file: File,
  options: { maxBytes?: number } = {},
) {
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;

  if (!file.type.startsWith("image/")) {
    throw new QrImageDecodeError("请选择二维码图片");
  }

  if (file.size > maxBytes) {
    throw new QrImageDecodeError("图片不能超过 2MB");
  }

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new QrImageDecodeError("当前浏览器无法解析二维码");
  }

  context.drawImage(bitmap, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(imageData.data, imageData.width, imageData.height);

  if (!result?.data) {
    throw new QrImageDecodeError("未识别到二维码，请换一张清晰图片");
  }

  return result.data;
}
```

- [ ] **Step 4: Create renderer component**

Create `apps/mobile/components/payment-qr-code.tsx`:

```tsx
"use client";

import { RiAlipayLine, RiWechatPayLine } from "@remixicon/react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@workspace/ui/lib/utils";
import type { PaymentPlatform } from "@/lib/payment-preferences";

export function PaymentQrCode({
  content,
  channel,
  className,
}: {
  content: string;
  channel: PaymentPlatform;
  className?: string;
}) {
  const Icon = channel === "wechat" ? RiWechatPayLine : RiAlipayLine;

  return (
    <div
      className={cn(
        "relative flex aspect-square items-center justify-center rounded-lg bg-white p-3",
        className,
      )}
    >
      <QRCodeSVG value={content} className="size-full" marginSize={1} />
      <span className="absolute flex size-10 items-center justify-center rounded-md border bg-white shadow-sm">
        <Icon
          className={cn(
            "size-6",
            channel === "wechat" ? "text-green-600" : "text-blue-600",
          )}
        />
      </span>
    </div>
  );
}
```

- [ ] **Step 5: Run mobile tests and typecheck**

Run:

```bash
pnpm --filter @sast-shop/mobile test -- qr-image-decoder
pnpm --filter @sast-shop/mobile typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/qr-image-decoder.ts apps/mobile/lib/qr-image-decoder.test.ts apps/mobile/components/payment-qr-code.tsx
git commit -m "feat: decode and render payment qr codes"
```

---

### Task 8: Update Profile QR Dialog

**Files:**

- Modify: `apps/mobile/components/profile-dialogs-provider.tsx`

- [ ] **Step 1: Replace file upload behavior**

In `handleFileChange`, replace `readFileAsDataUrl(file)` with:

```ts
try {
  const content = await readQrTextFromFile(file);
  const validation = validatePaymentQrContent(channel, content);

  if (!validation.ok) {
    toast.error(`请上传${label}收款码`);
    return;
  }

  await onUpsert(channel, validation.content);
} catch (error) {
  toast.error(error instanceof Error ? error.message : "二维码解析失败");
} finally {
  event.target.value = "";
}
```

Import `readQrTextFromFile`, `validatePaymentQrContent`, and `PaymentQrCode`.

- [ ] **Step 2: Render generated QR**

Replace `ManagedImage` in QR cards with:

```tsx
<PaymentQrCode
  content={qrCode.content}
  channel={channel}
  className="size-full rounded-md"
/>
```

Remove `readFileAsDataUrl`.

- [ ] **Step 3: Add URL query opening**

In `ProfileDialogsProvider`, import `useSearchParams` and `useRouter`.

Add an effect:

```ts
useEffect(() => {
  const dialog = searchParams.get("dialog");

  if (dialog === "qr-code") {
    setQrOpen(true);
  }

  if (dialog === "address") {
    setAddressOpen(true);
  }
}, [searchParams]);
```

When closing a URL-opened dialog, clean the query by replacing the current URL without `dialog`.

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm --filter @sast-shop/mobile typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/profile-dialogs-provider.tsx
git commit -m "feat: decode qr uploads in profile dialog"
```

---

### Task 9: Update Spot Payment State Flow

**Files:**

- Modify: `apps/mobile/components/payment-dialog.tsx`
- Modify: `apps/mobile/components/spot-marketplace.tsx`

- [ ] **Step 1: Redesign PaymentDialog props**

Change `PaymentDialogProps` to state-driven input:

```ts
export type PaymentDialogState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      amountCents: number;
      verifyCode: string;
      billId: string;
      billUpdatedAt: string | null;
      qrCodes: Partial<Record<PaymentPlatform, string>>;
      defaultPlatform: PaymentPlatform;
    }
  | {
      status: "submitted";
      amountCents: number;
      verifyCode: string;
      channel: PaymentPlatform;
      serialNumber?: string | null;
    }
  | { status: "error"; title: string; description: string };
```

`PaymentDialog` receives `state`, `onPay`, `onRetry`, and `onCancelPayment`.

- [ ] **Step 2: Add skeleton and Empty states**

Use `Skeleton` in `loading`.

Use `Empty` in `error`:

```tsx
<Empty
  icon={<RiCloseCircleLine className="size-5" />}
  title={state.title}
  description={state.description}
  action={
    <Button type="button" onClick={onRetry}>
      重试
    </Button>
  }
/>
```

- [ ] **Step 3: Replace QR image rendering**

In ready state, render:

```tsx
<PaymentQrCode
  content={panelQrCodeContent}
  channel={value}
  className="w-44 max-w-full"
/>
```

- [ ] **Step 4: Update SpotMarketplace checkout**

Replace `checkoutDraft` with:

```ts
const [paymentState, setPaymentState] = useState<PaymentDialogState>({
  status: "idle",
});
```

`startCheckout` should:

```ts
setPaymentState({ status: "loading" })
try {
  const [createdOrder] = await createSpotOrders([...], serviceOptions)
  if (!createdOrder?.bill) throw new Error("订单账单暂不可用")
  const qrCodes = await listPaymentQrCodes({ ...serviceOptions, ownerId: selectedProduct.sellerId })
  setPaymentState({
    status: "ready",
    amountCents: createdOrder.bill.amountCents,
    verifyCode: createdOrder.bill.verifyCode,
    billId: createdOrder.bill.id,
    billUpdatedAt: createdOrder.bill.updatedAt,
    qrCodes: mapQrCodes(qrCodes),
    defaultPlatform: readDefaultPaymentPlatform(),
  })
} catch {
  setPaymentState({
    status: "error",
    title: "支付信息加载失败",
    description: "请稍后重试，或联系发布者确认收款码。",
  })
}
```

`onPay` should call:

```ts
const paidBill = await payBill(
  {
    billId: state.billId,
    channel: selectedPlatform,
    updatedAt: state.billUpdatedAt,
  },
  serviceOptions,
);
setPaymentState({
  status: "submitted",
  amountCents: paidBill.amountCents,
  verifyCode: paidBill.verifyCode,
  channel: paidBill.channel ?? selectedPlatform,
  serialNumber: paidBill.serialNumber,
});
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm --filter @sast-shop/mobile typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/payment-dialog.tsx apps/mobile/components/spot-marketplace.tsx
git commit -m "feat: use bill-backed spot payment flow"
```

---

### Task 10: Require Seller QR Before Publishing Spot Goods

**Files:**

- Modify: `apps/mobile/components/publish-spot-form.tsx`
- Modify: `apps/mobile/components/profile-dialogs-provider.tsx`

- [ ] **Step 1: Extend profile dialog context**

Add to `ProfileDialogsContextValue`:

```ts
hasPaymentQrCode: boolean;
```

Provide:

```ts
hasPaymentQrCode: qrCodes.length > 0;
```

- [ ] **Step 2: Guard publish submission**

In `PublishSpotForm`, import `useProfileDialogs`.

Before `createSpotGoods`:

```ts
if (!hasPaymentQrCode) {
  toast.message("上架前需要先上传快捷收款码");
  openQrCodeDialog();
  return;
}
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm --filter @sast-shop/mobile typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/publish-spot-form.tsx apps/mobile/components/profile-dialogs-provider.tsx
git commit -m "feat: require payment qr before spot publish"
```

---

### Task 11: Add Auth Mode and Proxy

**Files:**

- Create: `apps/mobile/lib/auth-mode.ts`
- Modify: `apps/mobile/lib/app-config.ts`
- Modify: `apps/desktop/lib/app-config.ts`
- Create: `apps/mobile/app/api/connect/[...path]/route.ts`
- Create: `apps/mobile/app/api/auth/session/route.ts`

- [ ] **Step 1: Add auth mode parser**

Create `apps/mobile/lib/auth-mode.ts`:

```ts
export type AuthMode = "off" | "required";

export function resolveAuthMode(value: string | undefined): AuthMode {
  return value === "required" ? "required" : "off";
}
```

- [ ] **Step 2: Add config values**

In app configs:

```ts
authMode: resolveAuthMode(process.env.AUTH_MODE ?? process.env.NEXT_PUBLIC_AUTH_MODE),
```

Use a local parser in desktop or move parser to a shared package if both apps need it.

- [ ] **Step 3: Add proxy route**

Create `apps/mobile/app/api/connect/[...path]/route.ts`:

```ts
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { mobileAppConfig } from "@/lib/app-config";

const SESSION_COOKIE = "sast_shop_session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (mobileAppConfig.authMode === "required") {
    const session = (await cookies()).get(SESSION_COOKIE)?.value;

    if (!session) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
  }

  const { path } = await params;
  const target = new URL(path.join("/"), mobileAppConfig.connectBaseUrl);
  const headers = new Headers(request.headers);
  const session = (await cookies()).get(SESSION_COOKIE)?.value;

  if (session) {
    headers.set("Authorization", `Bearer ${session}`);
  }

  const response = await fetch(target, {
    method: "POST",
    headers,
    body: request.body,
    duplex: "half",
  } as RequestInit);

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}
```

- [ ] **Step 4: Add session endpoint**

Create `apps/mobile/app/api/auth/session/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "sast_shop_session";

export async function POST(request: NextRequest) {
  const { sessionToken, expiresAt } = await request.json();

  if (typeof sessionToken !== "string" || !sessionToken) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt ? new Date(expiresAt) : undefined,
  });

  return response;
}
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm --filter @sast-shop/mobile typecheck
pnpm --filter @sast-shop/desktop typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/auth-mode.ts apps/mobile/lib/app-config.ts apps/desktop/lib/app-config.ts apps/mobile/app/api/connect apps/mobile/app/api/auth
git commit -m "feat: add auth mode and connect proxy"
```

---

### Task 12: Migrate ManagedImage to next/image

**Files:**

- Modify: `apps/mobile/components/managed-image.tsx`
- Modify: `apps/mobile/next.config.ts`

- [ ] **Step 1: Update ManagedImage**

Replace `<img>` with `Image`:

```tsx
import Image from "next/image";
```

Use:

```tsx
<Image
  src={src}
  alt={alt}
  fill
  unoptimized
  sizes="(max-width: 768px) 50vw, 25vw"
  className={cn(
    "object-cover",
    state !== "loaded" && "opacity-0",
    imageClassName,
  )}
  onLoad={() => updateState("loaded")}
  onError={() => updateState("error")}
/>
```

Keep the wrapper `relative`.

- [ ] **Step 2: Run lint**

Run:

```bash
pnpm --filter @sast-shop/mobile lint
```

Expected: PASS with no `no-img-element` warning for `ManagedImage`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/managed-image.tsx apps/mobile/next.config.ts
git commit -m "fix: use next image in managed image"
```

---

### Task 13: Improve Orders URL State and Empty Usage

**Files:**

- Modify: `apps/mobile/components/orders-view.tsx`

- [ ] **Step 1: Use URL-backed state**

Import:

```ts
import { useRouter, useSearchParams } from "next/navigation";
```

Read initial state from query:

```ts
const perspective =
  searchParams.get("perspective") === "seller" ? "seller" : "purchaser";
const status = isStatus(searchParams.get("status"))
  ? searchParams.get("status")
  : "all";
const query = searchParams.get("q") ?? "";
```

Update query with `router.replace` when filters change.

- [ ] **Step 2: Add buyer/seller labels**

Use `Tabs` for:

```ts
[
  { value: "purchaser", label: "我买的" },
  { value: "seller", label: "我卖的" },
];
```

- [ ] **Step 3: Use Empty for unsupported tabs**

Replace ad hoc unavailable-state cards with:

```tsx
<Empty
  icon={<RiFileList3Line className="size-5" />}
  title="暂未接入"
  description="跑腿订单和团长任务会在对应接口接入后展示。"
/>
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm --filter @sast-shop/mobile typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/orders-view.tsx
git commit -m "feat: persist mobile order filters"
```

---

### Task 14: Final Verification

**Files:**

- All changed files.

- [ ] **Step 1: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS with no `managed-image.tsx` `<img>` warning.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Run tests**

Run:

```bash
pnpm --filter @sast-shop/domain test
pnpm --filter @sast-shop/api test
pnpm --filter @sast-shop/mobile test
pnpm --filter @workspace/ui test
```

Expected: PASS.

- [ ] **Step 4: Run mobile dev server**

Run:

```bash
pnpm dev:mobile
```

Expected: server starts on `http://localhost:3001`.

- [ ] **Step 5: Visual smoke check**

Check mobile viewport:

- `/shop`: open product detail, click buy, see skeleton, then ready/error state.
- `/profile`: open QR dialog, see generated QR previews and upload actions.
- `/publish/spot`: without QR, submit opens QR dialog.
- `/orders`: buyer/seller filter and URL query update.

- [ ] **Step 6: Commit final fixes**

If verification required follow-up fixes:

```bash
git add apps/mobile packages/api packages/domain packages/ui
git commit -m "fix: stabilize payment qr flow"
```

If no follow-up fixes are needed, do not create an empty commit.
