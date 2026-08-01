# Spot Goods Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the mobile spot-goods flow with shadcn forms, toast feedback, reusable payment dialog, real scan-app jumps, QR saving, and local default payment method settings.

**Architecture:** Keep pages as facade loaders and move browser-only behavior into focused client modules. Add shadcn primitives to `@workspace/ui`, expose seller id and owner QR lookup in `@sast-shop/api`, keep local payment preferences in `apps/mobile/lib`, and use a reusable `PaymentDialog` from `apps/mobile/components`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4, shadcn/radix UI, sonner, React Hook Form, Zod, ConnectRPC facade, Vitest.

---

## File Structure

- `packages/ui/src/components/*`: add shadcn `field`, `input-group`, `sonner`, `separator`; accept registry updates to `input`, `label`, `textarea`.
- `packages/api/src/services/spot-goods.ts`: add `sellerId` to `SpotGoods`.
- `packages/api/src/services/payment-qr-codes.ts`: add optional `ownerId` to `listPaymentQrCodes`.
- `apps/mobile/lib/payment-preferences.ts`: local default payment method storage.
- `apps/mobile/lib/payment-app-links.ts`: URL-scheme scan jumps.
- `apps/mobile/components/payment-dialog.tsx`: public payment dialog using per-platform QR codes.
- `apps/mobile/components/profile-dialogs-provider.tsx`: default payment method drawer.
- `apps/mobile/components/profile-management-client.tsx`: menu entry for default payment method.
- `apps/mobile/components/spot-marketplace.tsx`: search, seller QR lookup, payment dialog, toast feedback.
- `apps/mobile/components/publish-spot-form.tsx`: shadcn Field/InputGroup + RHF/Zod + toast.

---

### Task 1: Add shadcn Form And Toast Primitives

**Files:**

- Create: `packages/ui/src/components/field.tsx`
- Create: `packages/ui/src/components/input-group.tsx`
- Create: `packages/ui/src/components/sonner.tsx`
- Create: `packages/ui/src/components/separator.tsx`
- Modify: `packages/ui/src/components/input.tsx`
- Modify: `packages/ui/src/components/label.tsx`
- Modify: `packages/ui/src/components/textarea.tsx`
- Modify: `packages/ui/package.json`
- Modify: `apps/mobile/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Preview registry changes**

Run from `packages/ui`:

```bash
pnpm dlx shadcn@latest add field input-group sonner --dry-run
```

Expected: creates `field.tsx`, `input-group.tsx`, `sonner.tsx`, `separator.tsx`; updates `input.tsx`, `label.tsx`, `textarea.tsx`; adds `sonner` and `next-themes`.

- [ ] **Step 2: Apply registry changes**

```bash
pnpm dlx shadcn@latest add field input-group sonner
```

- [ ] **Step 3: Add mobile form dependencies**

Run from repo root:

```bash
pnpm add react-hook-form zod @hookform/resolvers --filter @sast-shop/mobile
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter @workspace/ui typecheck
pnpm --filter @sast-shop/mobile typecheck
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add packages/ui apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat: add shadcn form and toast primitives"
```

---

### Task 2: Expose Seller ID And Owner QR Lookup

**Files:**

- Modify: `packages/api/src/services/spot-goods.ts`
- Modify: `packages/api/src/services/spot-goods.test.ts`
- Modify: `packages/api/src/services/payment-qr-codes.ts`
- Modify: `packages/api/src/services/payment-qr-codes.test.ts`

- [ ] **Step 1: Write failing seller id assertion**

In `packages/api/src/services/spot-goods.test.ts`, update the existing local create assertion:

```ts
expect(goods).toMatchObject({
  id: "2001",
  salePriceCents: 1299,
  stock: 8,
  sellerId: "42",
  sellerName: "南邮同学",
  product: {
    id: "1001",
    title: "SAST 贴纸",
  },
});
```

- [ ] **Step 2: Write failing owner QR test**

In `packages/api/src/services/payment-qr-codes.test.ts`, add:

```ts
it("passes owner id when listing another user's payment QR codes", async () => {
  const fetchMock = vi.fn(async () =>
    stubJsonResponse({
      qrCodes: [
        {
          id: "3001",
          channel: "CHANNEL_WECHAT",
          content: "https://example.test/pay/wechat/seller",
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const qrCodes = await listPaymentQrCodes({
    ...localOptions,
    ownerId: "42",
  });

  expect(qrCodes[0]?.content).toBe("https://example.test/pay/wechat/seller");
  await expectConnectRequest(fetchMock, {
    path: "/sast.sastshopv2.payment.v1.QrCodeService/GetQrCode",
    body: {
      ownerId: "42",
    },
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm --filter @sast-shop/api test -- --run src/services/spot-goods.test.ts src/services/payment-qr-codes.test.ts
```

Expected: fails because `sellerId` and `ownerId` are not implemented.

- [ ] **Step 4: Implement `sellerId`**

In `packages/api/src/services/spot-goods.ts`, change `SpotGoods`:

```ts
export interface SpotGoods {
  id: string;
  product: SpotProductTemplate;
  salePriceCents: number;
  stock: number | null;
  sellerId: string | null;
  sellerName: string | null;
  updatedAt: string | null;
}
```

Set brief mapping:

```ts
sellerId: null,
sellerName: null,
```

Set detail mapping:

```ts
sellerId: goods.seller?.id.toString() ?? null,
sellerName: goods.seller?.name ?? null,
```

- [ ] **Step 5: Implement `ownerId` QR lookup**

In `packages/api/src/services/payment-qr-codes.ts`, update the signature:

```ts
export async function listPaymentQrCodes(
  options: ServiceOptions & { ownerId?: string } = {}
): Promise<PaymentQrCode[]> {
```

In local mode:

```ts
const response = await requestLocal("listPaymentQrCodes", () =>
  client.getQrCode({
    ownerId: options.ownerId
      ? parseInt64(options.ownerId, "收款码用户 ID 不正确")
      : undefined,
  }),
);
```

Add:

```ts
function parseInt64(value: string, message: string): bigint {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ValidationError(message);
  }

  return BigInt(value);
}
```

- [ ] **Step 6: Verify**

```bash
pnpm --filter @sast-shop/api test -- --run src/services/spot-goods.test.ts src/services/payment-qr-codes.test.ts
pnpm --filter @sast-shop/api typecheck
```

Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/services/spot-goods.ts packages/api/src/services/spot-goods.test.ts packages/api/src/services/payment-qr-codes.ts packages/api/src/services/payment-qr-codes.test.ts
git commit -m "feat: expose seller payment qr lookup"
```

---

### Task 3: Add Local Payment Preference Helpers

**Files:**

- Create: `apps/mobile/lib/payment-preferences.ts`
- Create: `apps/mobile/lib/payment-preferences.test.ts`

- [ ] **Step 1: Write tests**

Create `apps/mobile/lib/payment-preferences.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAYMENT_PLATFORM,
  PAYMENT_PLATFORM_STORAGE_KEY,
  isPaymentPlatform,
  readDefaultPaymentPlatform,
  writeDefaultPaymentPlatform,
} from "./payment-preferences";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("payment preferences", () => {
  it("validates platforms", () => {
    expect(isPaymentPlatform("wechat")).toBe(true);
    expect(isPaymentPlatform("alipay")).toBe(true);
    expect(isPaymentPlatform("cash")).toBe(false);
  });

  it("falls back to wechat for empty or invalid storage", () => {
    const storage = new MemoryStorage();
    expect(readDefaultPaymentPlatform(storage)).toBe(DEFAULT_PAYMENT_PLATFORM);
    storage.setItem(PAYMENT_PLATFORM_STORAGE_KEY, "cash");
    expect(readDefaultPaymentPlatform(storage)).toBe(DEFAULT_PAYMENT_PLATFORM);
  });

  it("persists the selected platform", () => {
    const storage = new MemoryStorage();
    writeDefaultPaymentPlatform("alipay", storage);
    expect(readDefaultPaymentPlatform(storage)).toBe("alipay");
  });
});
```

- [ ] **Step 2: Run failing test**

```bash
pnpm exec vitest run apps/mobile/lib/payment-preferences.test.ts
```

Expected: fails because implementation is missing.

- [ ] **Step 3: Implement helper**

Create `apps/mobile/lib/payment-preferences.ts`:

```ts
export type PaymentPlatform = "wechat" | "alipay";

export const DEFAULT_PAYMENT_PLATFORM: PaymentPlatform = "wechat";
export const PAYMENT_PLATFORM_STORAGE_KEY =
  "sast-shop.default-payment-platform";

export function isPaymentPlatform(value: unknown): value is PaymentPlatform {
  return value === "wechat" || value === "alipay";
}

export function readDefaultPaymentPlatform(
  storage: Storage | undefined = getBrowserStorage(),
): PaymentPlatform {
  const value = storage?.getItem(PAYMENT_PLATFORM_STORAGE_KEY);

  return isPaymentPlatform(value) ? value : DEFAULT_PAYMENT_PLATFORM;
}

export function writeDefaultPaymentPlatform(
  platform: PaymentPlatform,
  storage: Storage | undefined = getBrowserStorage(),
) {
  storage?.setItem(PAYMENT_PLATFORM_STORAGE_KEY, platform);
}

function getBrowserStorage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}
```

- [ ] **Step 4: Verify and commit**

```bash
pnpm exec vitest run apps/mobile/lib/payment-preferences.test.ts
pnpm --filter @sast-shop/mobile typecheck
git add apps/mobile/lib/payment-preferences.ts apps/mobile/lib/payment-preferences.test.ts
git commit -m "feat: add local payment preference helpers"
```

---

### Task 4: Add Payment App Link Helpers

**Files:**

- Create: `apps/mobile/lib/payment-app-links.ts`
- Create: `apps/mobile/lib/payment-app-links.test.ts`

- [ ] **Step 1: Write tests**

Create `apps/mobile/lib/payment-app-links.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { getPaymentScanUrl, openPaymentScanner } from "./payment-app-links";

describe("payment app links", () => {
  it("returns scanner URL schemes", () => {
    expect(getPaymentScanUrl("wechat")).toBe("weixin://scanqrcode");
    expect(getPaymentScanUrl("alipay")).toBe(
      "alipays://platformapi/startapp?saId=10000007",
    );
  });

  it("opens scanner links through location assignment", () => {
    const assign = vi.fn();
    openPaymentScanner("wechat", {
      assign: assign as unknown as Location["assign"],
    });
    expect(assign).toHaveBeenCalledWith("weixin://scanqrcode");
  });
});
```

- [ ] **Step 2: Implement helper**

Create `apps/mobile/lib/payment-app-links.ts`:

```ts
import type { PaymentPlatform } from "./payment-preferences";

const PAYMENT_SCAN_URLS: Record<PaymentPlatform, string> = {
  wechat: "weixin://scanqrcode",
  alipay: "alipays://platformapi/startapp?saId=10000007",
};

export function getPaymentScanUrl(platform: PaymentPlatform) {
  return PAYMENT_SCAN_URLS[platform];
}

export function openPaymentScanner(
  platform: PaymentPlatform,
  locationLike: Pick<Location, "assign"> = window.location,
) {
  locationLike.assign(getPaymentScanUrl(platform));
}
```

- [ ] **Step 3: Verify and commit**

```bash
pnpm exec vitest run apps/mobile/lib/payment-app-links.test.ts
pnpm --filter @sast-shop/mobile typecheck
git add apps/mobile/lib/payment-app-links.ts apps/mobile/lib/payment-app-links.test.ts
git commit -m "feat: add payment scanner link helpers"
```

---

### Task 5: Mount Toaster And Add Default Payment Setting

**Files:**

- Modify: `apps/mobile/app/layout.tsx`
- Modify: `apps/mobile/components/profile-dialogs-provider.tsx`
- Modify: `apps/mobile/components/profile-management-client.tsx`

- [ ] **Step 1: Mount Toaster**

In `apps/mobile/app/layout.tsx`:

```tsx
import { Toaster } from "@workspace/ui/components/sonner";
```

After `</ProfileDialogsProvider>`:

```tsx
<Toaster position="top-center" richColors />
```

- [ ] **Step 2: Extend profile provider**

In `apps/mobile/components/profile-dialogs-provider.tsx`, add `useEffect` to the React import and add:

```tsx
import { toast } from "sonner";
import {
  DEFAULT_PAYMENT_PLATFORM,
  readDefaultPaymentPlatform,
  writeDefaultPaymentPlatform,
  type PaymentPlatform,
} from "@/lib/payment-preferences";
```

Extend context:

```ts
interface ProfileDialogsContextValue {
  openAddressDialog: () => void;
  openQrCodeDialog: () => void;
  openPaymentPreferenceDialog: () => void;
}
```

Add state and functions:

```tsx
const [paymentPreferenceOpen, setPaymentPreferenceOpen] = useState(false);
const [defaultPaymentPlatform, setDefaultPaymentPlatform] =
  useState<PaymentPlatform>(DEFAULT_PAYMENT_PLATFORM);

useEffect(() => {
  setDefaultPaymentPlatform(readDefaultPaymentPlatform());
}, []);

function saveDefaultPaymentPlatform(platform: PaymentPlatform) {
  writeDefaultPaymentPlatform(platform);
  setDefaultPaymentPlatform(platform);
  toast.success("默认支付方式已更新");
}
```

Add provider value:

```tsx
openPaymentPreferenceDialog: () => setPaymentPreferenceOpen(true),
```

Add a `ResponsiveDialog` titled `默认支付方式` with two `Button`s for `wechat` and `alipay`, using `RiWechatPayLine` and `RiAlipayLine`.

- [ ] **Step 3: Add profile menu item**

In `apps/mobile/components/profile-management-client.tsx`, import `RiWallet3Line`, read `openPaymentPreferenceDialog`, make `快捷收款码` not last and bordered, then add:

```tsx
<ProfileMenuButton
  title="默认支付方式"
  icon={<RiWallet3Line className="size-4" />}
  onClick={openPaymentPreferenceDialog}
  last
/>
```

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @sast-shop/mobile typecheck
pnpm lint
git add apps/mobile/app/layout.tsx apps/mobile/components/profile-dialogs-provider.tsx apps/mobile/components/profile-management-client.tsx
git commit -m "feat: add default payment method setting"
```

---

### Task 6: Build Reusable Payment Dialog

**Files:**

- Create: `apps/mobile/components/payment-dialog.tsx`

- [ ] **Step 1: Create component**

Create `apps/mobile/components/payment-dialog.tsx` with these key props:

```tsx
export function PaymentDialog({
  open,
  onOpenChange,
  amountCents,
  verifyCode,
  qrCodes,
  defaultPlatform,
  submitting,
  onPay,
  onCancelPayment,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  amountCents: number
  verifyCode: string
  qrCodes: Partial<Record<PaymentPlatform, string>>
  defaultPlatform: PaymentPlatform
  submitting?: boolean
  onPay: () => void | Promise<void>
  onCancelPayment: () => void
}) {
```

Implementation requirements:

- Use `ResponsiveDialog forceDrawer`.
- Use `Tabs`, `TabsList`, `TabsTrigger` for platform switching.
- Use `formatPrice(amountCents)` for amount.
- Compute `const qrCodeUrl = qrCodes[platform]`.
- If `qrCodeUrl` is missing, show `当前支付方式暂无收款码` and disable 保存收款码、打开扫一扫、支付.
- `保存收款码` creates an `<a>` with `download` and clicks it, then `toast.success("已开始保存收款码")`.
- `打开扫一扫` calls `openPaymentScanner(platform)` and catches failures with `toast.error("无法打开支付 App，请手动打开扫一扫")`.
- `支付` calls `onPay`; `取消支付` calls `onCancelPayment`.
- Add `useEffect` so reopening the dialog resets selected platform from `defaultPlatform`.

- [ ] **Step 2: Verify and commit**

```bash
pnpm --filter @sast-shop/mobile typecheck
git add apps/mobile/components/payment-dialog.tsx
git commit -m "feat: add reusable payment dialog"
```

---

### Task 7: Refactor Spot Marketplace

**Files:**

- Modify: `apps/mobile/components/spot-marketplace.tsx`

- [ ] **Step 1: Update imports and product mapping**

Add imports:

```tsx
import { useEffect, useMemo, useState } from "react";
import { listPaymentQrCodes } from "@sast-shop/api";
import { toast } from "sonner";
import {
  readDefaultPaymentPlatform,
  type PaymentPlatform,
} from "@/lib/payment-preferences";
import { PaymentDialog } from "./payment-dialog";
import { Input } from "@workspace/ui/components/input";
```

Add `sellerId: string | null` to `SpotProduct` and map:

```tsx
sellerId: goods.sellerId,
```

- [ ] **Step 2: Add search and QR state**

```tsx
const [query, setQuery] = useState("");
const [defaultPlatform, setDefaultPlatform] =
  useState<PaymentPlatform>("wechat");
const [paymentQrCodes, setPaymentQrCodes] = useState<
  Partial<Record<PaymentPlatform, string>>
>({});

useEffect(() => {
  setDefaultPlatform(readDefaultPaymentPlatform());
}, []);
```

Create `filteredProducts` by matching title, description, seller, and barcode.

- [ ] **Step 3: Replace checkout start**

```tsx
async function startCheckout() {
  if (!selectedProduct) return;

  if (!selectedProduct.sellerId) {
    toast.error("发布者收款信息暂不可用");
    return;
  }

  setDefaultPlatform(readDefaultPaymentPlatform());
  setSubmitting(true);

  try {
    const qrCodes = await listPaymentQrCodes({
      ...serviceOptions,
      ownerId: selectedProduct.sellerId,
    });

    setPaymentQrCodes(
      Object.fromEntries(
        qrCodes.map((qrCode) => [qrCode.channel, qrCode.content]),
      ) as Partial<Record<PaymentPlatform, string>>,
    );
    setCheckoutDraft({ product: selectedProduct, quantity });
    setSelectedProduct(null);
    setSubmitted(false);
    setSubmissionError(null);
    setCreatedOrderNo(null);
  } catch {
    toast.error("收款码暂不可用，请稍后再试");
  } finally {
    setSubmitting(false);
  }
}
```

- [ ] **Step 4: Replace inline payment dialog**

Delete the inline payment `ResponsiveDialog` and render:

```tsx
<PaymentDialog
  open={checkoutDraft !== null}
  onOpenChange={(open) => {
    if (!open) setCheckoutDraft(null);
  }}
  amountCents={amount}
  verifyCode={verifyCode}
  qrCodes={paymentQrCodes}
  defaultPlatform={defaultPlatform}
  submitting={submitting}
  onCancelPayment={() => {
    setCheckoutDraft(null);
    toast.message("已取消支付");
  }}
  onPay={() => {
    void submitOrder();
  }}
/>
```

- [ ] **Step 5: Add search UI and toast submit feedback**

Add an `Input` above the grid with placeholder `搜索商品、规格、卖家或条码`, render `filteredProducts`, and show an empty `Card` when filtered length is 0.

In `submitOrder`, add:

```tsx
toast.success("订单已提交，等待收款确认");
```

on success, and:

```tsx
toast.error("订单提交失败，请稍后再试");
```

on failure.

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter @sast-shop/mobile typecheck
pnpm lint
git add apps/mobile/components/spot-marketplace.tsx
git commit -m "feat: polish spot marketplace payment flow"
```

---

### Task 8: Refactor Publish Spot Form

**Files:**

- Modify: `apps/mobile/components/publish-spot-form.tsx`

- [ ] **Step 1: Add RHF/Zod and shadcn imports**

Add:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group";
```

Add:

```tsx
const formSchema = z.object({
  barcode: z.string().trim().min(1, "请输入商品条码"),
  price: z.coerce.number().positive("售价必须大于 0"),
  stock: z.coerce.number().int("库存必须是整数").positive("库存必须大于 0"),
});

type FormValues = z.infer<typeof formSchema>;
```

- [ ] **Step 2: Replace local field state**

Use:

```tsx
const form = useForm<FormValues>({
  resolver: zodResolver(formSchema),
  defaultValues: {
    barcode: "",
    price: 0,
    stock: 1,
  },
});
const barcode = form.watch("barcode");
```

Keep query/template/submission states.

- [ ] **Step 3: Convert fields**

Use `Controller` + `Field` for barcode, price, and stock. Barcode uses `InputGroup`; price and stock use `Input`. Put `FieldError` below each invalid field, with `data-invalid` on `Field` and `aria-invalid` on the input.

Barcode query button behavior:

```tsx
const nextBarcode = form.getValues("barcode").trim();
if (!nextBarcode) {
  form.setError("barcode", { message: "请输入商品条码" });
  return;
}
setQueried(true);
setSelectedTemplate(null);
setSubmitted(false);
```

- [ ] **Step 4: Update submit**

```tsx
async function submitSpotGoods(values: FormValues) {
  if (!selectedTemplate) {
    toast.error("请先选择商品模板");
    return;
  }

  setSubmitting(true);
  setSubmissionError(null);

  try {
    await createSpotGoods(
      {
        productTemplateId: selectedTemplate.id,
        salePriceCents: Math.round(values.price * 100),
        stockTotal: values.stock,
        productTemplateUpdatedAt: selectedTemplate.updatedAt,
      },
      serviceOptions,
    );
    setSubmitted(true);
    toast.success("已提交上架");
  } catch {
    const message = "上架失败，请稍后再试";
    setSubmissionError(message);
    toast.error(message);
  } finally {
    setSubmitting(false);
  }
}
```

Button uses:

```tsx
onClick={form.handleSubmit(submitSpotGoods)}
```

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @sast-shop/mobile typecheck
pnpm lint
git add apps/mobile/components/publish-spot-form.tsx
git commit -m "feat: polish spot publish form"
```

---

### Task 9: Final Verification

**Files:**

- No planned file edits.

- [ ] **Step 1: Run automated checks**

```bash
pnpm exec vitest run apps/mobile/lib/payment-preferences.test.ts apps/mobile/lib/payment-app-links.test.ts
pnpm --filter @sast-shop/api test -- --run src/services/spot-goods.test.ts src/services/payment-qr-codes.test.ts
pnpm --filter @workspace/ui typecheck
pnpm --filter @sast-shop/mobile typecheck
pnpm lint
```

Expected: all commands pass. `pnpm lint` may keep the existing `managed-image.tsx` `<img>` warning.

- [ ] **Step 2: Start mobile dev server**

```bash
pnpm dev:mobile
```

Expected: app starts on `http://localhost:3001`.

- [ ] **Step 3: Manual mobile smoke**

Use a mobile viewport around 390 x 844:

- `/profile`: change 默认支付方式 and confirm toast.
- `/shop`: search with result and no-result terms.
- `/shop`: open a product, change quantity, open payment dialog, confirm default platform and QR changes by platform.
- Payment dialog: test 保存收款码, 打开扫一扫, 取消支付, 支付, and missing-QR disabled state when available.
- `/publish/spot`: test empty barcode, invalid price, invalid stock, no template, valid template, success toast, failure toast.

Expected: no bottom-nav overlap, safe-area padding holds, toast is visible, and no UI claims payment is seller-confirmed before seller confirmation.

- [ ] **Step 4: Handle verification fixes**

If verification exposes a defect, return to the task that introduced it, make a focused fix, rerun the relevant checks, and commit the exact touched files with a specific message such as:

```bash
git commit -m "fix: handle missing seller qr code"
```

If verification exposes no defects, do not create an empty commit.
