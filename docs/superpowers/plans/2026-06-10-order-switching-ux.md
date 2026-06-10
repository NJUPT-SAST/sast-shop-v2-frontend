# Order Switching UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the mobile order page so order type, perspective, search, status filters, status badges, and dark mode follow the approved order-switching UX design.

**Architecture:** Add small focused model helpers for order filters and status metadata, extend shared UI tokens/components for dark mode and status tones, add a custom accessible `PerspectiveSwitch`, expose captain errand task data through the API facade, then rewrite `OrdersView` around the new model. Keep list rendering on Brief data and leave detail/payment flows untouched.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4, shadcn-style shared UI components, ConnectRPC Web v2, Vitest, pnpm.

---

## File Structure

- Modify `packages/ui/src/styles/globals.css`: add dark semantic tokens and status badge tone variables.
- Modify `packages/ui/src/components/badge.tsx`: add controlled tone variants for order statuses.
- Create `packages/api/src/services/errand-tasks.ts`: facade for `ErrandTaskService/GetErrandTaskList`.
- Create `packages/api/src/services/errand-tasks.test.ts`: local/mock facade tests.
- Modify `packages/api/src/index.ts`: export errand task service types and function.
- Create `apps/mobile/lib/order-filters.ts`: URL parsing, defaults, type/view/status options, status labels and badge tones.
- Create `apps/mobile/lib/order-filters.test.ts`: pure helper tests.
- Create `apps/mobile/components/perspective-switch.tsx`: custom accessible perspective switch.
- Modify `apps/mobile/app/orders/page.tsx`: load spot buyer, spot seller, buyer errand, and captain errand lists independently.
- Modify `apps/mobile/components/orders-view.tsx`: new layout, filtering, rendering, empty states, and query-state behavior.

---

### Task 1: Extend UI Theme And Badge Tones

**Files:**
- Modify: `packages/ui/src/styles/globals.css`
- Modify: `packages/ui/src/components/badge.tsx`

- [ ] **Step 1: Extend CSS variables**

Add dark mode and badge tone variables in `packages/ui/src/styles/globals.css`.

```css
:root {
  --badge-neutral: #f5f5f7;
  --badge-neutral-foreground: #333333;
  --badge-neutral-border: #e0e0e0;
  --badge-warning: #fff4d8;
  --badge-warning-foreground: #8a4b00;
  --badge-warning-border: #f2d18b;
  --badge-info: #e8f7ff;
  --badge-info-foreground: #006b9a;
  --badge-info-border: #bfe6f8;
  --badge-payment: #eaf2ff;
  --badge-payment-foreground: #0759bd;
  --badge-payment-border: #c8dcff;
  --badge-attention: #fff0e7;
  --badge-attention-foreground: #a33b00;
  --badge-attention-border: #ffd0b8;
  --badge-review: #f1eaff;
  --badge-review-foreground: #6731a6;
  --badge-review-border: #ddccff;
  --badge-success: #e8f8ee;
  --badge-success-foreground: #08723d;
  --badge-success-border: #bfe8cd;
  --badge-danger: #fff0f0;
  --badge-danger-foreground: #c21f32;
  --badge-danger-border: #ffd1d6;
}

.dark {
  --background: #111114;
  --foreground: #f5f5f7;
  --card: #1b1b20;
  --card-foreground: #f5f5f7;
  --popover: #1b1b20;
  --popover-foreground: #f5f5f7;
  --primary: #2997ff;
  --primary-foreground: #ffffff;
  --secondary: #24242a;
  --secondary-foreground: #f5f5f7;
  --accent: #24242a;
  --accent-foreground: #f5f5f7;
  --destructive: #ff453a;
  --destructive-foreground: #ffffff;
  --muted: #202026;
  --muted-foreground: #a1a1aa;
  --border: #303038;
  --input: #3a3a42;
  --ring: #2997ff;
  --badge-neutral: #24242a;
  --badge-neutral-foreground: #d6d6dc;
  --badge-neutral-border: #3a3a42;
  --badge-warning: #3d2a08;
  --badge-warning-foreground: #ffd98a;
  --badge-warning-border: #76540c;
  --badge-info: #082f42;
  --badge-info-foreground: #8bdfff;
  --badge-info-border: #155f80;
  --badge-payment: #102a4d;
  --badge-payment-foreground: #8ec5ff;
  --badge-payment-border: #1f4f87;
  --badge-attention: #4a1f05;
  --badge-attention-foreground: #ffbc91;
  --badge-attention-border: #873d12;
  --badge-review: #2b184f;
  --badge-review-foreground: #c7a8ff;
  --badge-review-border: #593894;
  --badge-success: #0b3320;
  --badge-success-foreground: #8fe0ad;
  --badge-success-border: #176239;
  --badge-danger: #4a1118;
  --badge-danger-foreground: #ff9aa6;
  --badge-danger-border: #8a2632;
}

@layer base {
  .dark {
    color-scheme: dark;
  }
}
```

- [ ] **Step 2: Add Badge tone variants**

Modify `packages/ui/src/components/badge.tsx`.

```tsx
import * as React from "react"
import { cn } from "../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "muted"
    | "destructive"
    | "neutral"
    | "warning"
    | "info"
    | "payment"
    | "attention"
    | "review"
    | "success"
    | "danger"
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
        variant === "default" && "bg-primary text-primary-foreground",
        variant === "secondary" && "bg-secondary text-secondary-foreground",
        variant === "outline" && "border text-foreground",
        variant === "muted" && "bg-muted text-muted-foreground",
        variant === "destructive" &&
          "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
        variant === "neutral" &&
          "border bg-[var(--badge-neutral)] text-[var(--badge-neutral-foreground)] border-[var(--badge-neutral-border)]",
        variant === "warning" &&
          "border bg-[var(--badge-warning)] text-[var(--badge-warning-foreground)] border-[var(--badge-warning-border)]",
        variant === "info" &&
          "border bg-[var(--badge-info)] text-[var(--badge-info-foreground)] border-[var(--badge-info-border)]",
        variant === "payment" &&
          "border bg-[var(--badge-payment)] text-[var(--badge-payment-foreground)] border-[var(--badge-payment-border)]",
        variant === "attention" &&
          "border bg-[var(--badge-attention)] text-[var(--badge-attention-foreground)] border-[var(--badge-attention-border)]",
        variant === "review" &&
          "border bg-[var(--badge-review)] text-[var(--badge-review-foreground)] border-[var(--badge-review-border)]",
        variant === "success" &&
          "border bg-[var(--badge-success)] text-[var(--badge-success-foreground)] border-[var(--badge-success-border)]",
        variant === "danger" &&
          "border bg-[var(--badge-danger)] text-[var(--badge-danger-foreground)] border-[var(--badge-danger-border)]",
        className
      )}
      {...props}
    />
  )
}
```

- [ ] **Step 3: Run typecheck for UI**

Run: `pnpm --filter @workspace/ui typecheck`

Expected: exit code `0`.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/styles/globals.css packages/ui/src/components/badge.tsx
git commit -m "feat: add order status badge tones"
```

---

### Task 2: Add Errand Task API Facade

**Files:**
- Create: `packages/api/src/services/errand-tasks.ts`
- Create: `packages/api/src/services/errand-tasks.test.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/api/src/services/errand-tasks.test.ts`.

```ts
import { describe, expect, expectTypeOf, it } from "vitest"
import { FeatureUnavailableError, ValidationError } from "../errors"
import {
  listErrandTasks,
  type ErrandTask,
  type ErrandTaskStatusFilter,
} from "./errand-tasks"

const localOptions = {
  dataSource: "mock" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
}

describe("listErrandTasks", () => {
  it("returns typed errand task briefs", async () => {
    expectTypeOf<ReturnType<typeof listErrandTasks>>().toEqualTypeOf<
      Promise<ErrandTask[]>
    >()

    const tasks = await listErrandTasks(localOptions)

    expect(tasks[0]).toMatchObject({
      id: "7001",
      storeId: "3001",
      storeName: "SAST 小卖部",
      status: "shopping",
      itemTotalCount: 2,
    })
  })

  it("accepts valid status filters", async () => {
    const status: ErrandTaskStatusFilter = "shopping"

    await expect(
      listErrandTasks({ ...localOptions, status })
    ).resolves.toEqual(expect.any(Array))
  })

  it("rejects invalid pagination", async () => {
    await expect(
      listErrandTasks({ ...localOptions, page: 0 })
    ).rejects.toBeInstanceOf(ValidationError)

    await expect(
      listErrandTasks({ ...localOptions, pageSize: 0 })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("keeps remote explicitly unavailable", async () => {
    await expect(listErrandTasks({ dataSource: "remote" })).rejects.toBeInstanceOf(
      FeatureUnavailableError
    )
  })
})
```

- [ ] **Step 2: Run test and verify failure**

Run: `pnpm --filter @sast-shop/api test -- src/services/errand-tasks.test.ts`

Expected: FAIL because `./errand-tasks` does not exist.

- [ ] **Step 3: Implement facade**

Create `packages/api/src/services/errand-tasks.ts`.

```ts
import { createClient } from "@connectrpc/connect"
import type { ErrandTask as ProtoErrandTask } from "../gen/sast/sastshopv2/errand/v1/errand_task_pb"
import { ErrandTaskService } from "../gen/sast/sastshopv2/errand/v1/errand_task_service_pb"
import { ErrandTaskStatus } from "../gen/sast/sastshopv2/errand/v1/errand_task_status_pb"
import { resolveDataSource, type ServiceOptions } from "../data-source"
import { FeatureUnavailableError, ValidationError } from "../errors"
import { createLocalTransport, requestLocal } from "../local-connect"

const MAX_SIGNED_INT32 = 2147483647

export type ErrandTaskStatusValue =
  | "shopping"
  | "pending_distributing"
  | "distributing"
  | "collecting_payment"
  | "completed"
  | "cancelled"
  | "unknown"

export type ErrandTaskStatusFilter = Exclude<ErrandTaskStatusValue, "unknown">

export interface ErrandTask {
  id: string
  storeId: string
  storeName: string
  status: ErrandTaskStatusValue
  itemTotalCount: number
  createdAt: string | null
}

export async function listErrandTasks(
  options: ServiceOptions & {
    status?: ErrandTaskStatusFilter
    page?: number
    pageSize?: number
  } = {}
): Promise<ErrandTask[]> {
  const request = parseListErrandTasksOptions(options)
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(ErrandTaskService, createLocalTransport(options))
    const response = await requestLocal("listErrandTasks", () =>
      client.getErrandTaskList(request)
    )

    return response.errandTasks.map(mapErrandTask)
  }

  throw new FeatureUnavailableError("listErrandTasks")
}

function parseListErrandTasksOptions(options: {
  status?: ErrandTaskStatusFilter
  page?: number
  pageSize?: number
}) {
  return {
    page: parsePositiveInteger(options.page ?? 1, "页码不正确"),
    pageSize: parsePositiveInteger(options.pageSize ?? 50, "每页数量不正确"),
    ...(options.status
      ? { filterStatus: parseStatusFilter(options.status) }
      : {}),
  }
}

function mapErrandTask(task: ProtoErrandTask): ErrandTask {
  return {
    id: task.taskId.toString(),
    storeId: task.storeId.toString(),
    storeName: task.storeName || "跑腿店铺",
    status: mapStatusFromProto(task.status),
    itemTotalCount: task.items.length,
    createdAt: formatTimestamp(task.createdAt),
  }
}

function parseStatusFilter(status: string): ErrandTaskStatus {
  const protoStatus = mapStatusToProto(status)

  if (protoStatus === undefined) {
    throw new ValidationError("团长任务状态不正确")
  }

  return protoStatus
}

function mapStatusFromProto(status: ErrandTaskStatus): ErrandTaskStatusValue {
  if (status === ErrandTaskStatus.SHOPPING) return "shopping"
  if (status === ErrandTaskStatus.PENDING_DISTRIBUTING) {
    return "pending_distributing"
  }
  if (status === ErrandTaskStatus.DISTRIBUTING) return "distributing"
  if (status === ErrandTaskStatus.COLLECTING_PAYMENT) return "collecting_payment"
  if (status === ErrandTaskStatus.COMPLETED) return "completed"
  if (status === ErrandTaskStatus.CANCELLED) return "cancelled"
  return "unknown"
}

function mapStatusToProto(status: string): ErrandTaskStatus | undefined {
  if (status === "shopping") return ErrandTaskStatus.SHOPPING
  if (status === "pending_distributing") {
    return ErrandTaskStatus.PENDING_DISTRIBUTING
  }
  if (status === "distributing") return ErrandTaskStatus.DISTRIBUTING
  if (status === "collecting_payment") {
    return ErrandTaskStatus.COLLECTING_PAYMENT
  }
  if (status === "completed") return ErrandTaskStatus.COMPLETED
  if (status === "cancelled") return ErrandTaskStatus.CANCELLED
  return undefined
}

function parsePositiveInteger(value: number, message: string): number {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_SIGNED_INT32) {
    throw new ValidationError(message)
  }

  return value
}

function formatTimestamp(
  timestamp: { seconds: bigint; nanos: number } | undefined
): string | null {
  if (!timestamp) {
    return null
  }

  return new Date(
    Number(timestamp.seconds) * 1000 + Math.floor(timestamp.nanos / 1_000_000)
  ).toISOString()
}
```

- [ ] **Step 4: Export facade**

Add to `packages/api/src/index.ts`.

```ts
export {
  listErrandTasks,
  type ErrandTask,
  type ErrandTaskStatusFilter,
  type ErrandTaskStatusValue,
} from "./services/errand-tasks"
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @sast-shop/api test -- src/services/errand-tasks.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/services/errand-tasks.ts packages/api/src/services/errand-tasks.test.ts packages/api/src/index.ts
git commit -m "feat: add errand task list facade"
```

---

### Task 3: Add Order Filter Model Helpers

**Files:**
- Create: `apps/mobile/lib/order-filters.ts`
- Create: `apps/mobile/lib/order-filters.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/lib/order-filters.test.ts`.

```ts
import { describe, expect, it } from "vitest"
import {
  DEFAULT_ORDER_FILTERS,
  getDefaultViewForType,
  getOrderFiltersFromParams,
  getStatusOptions,
  getViewOptions,
  isViewForType,
  updateOrderFilterParams,
} from "./order-filters"

describe("order filters", () => {
  it("defaults to spot buyer", () => {
    expect(getOrderFiltersFromParams(new URLSearchParams())).toEqual(
      DEFAULT_ORDER_FILTERS
    )
  })

  it("coerces invalid view to the selected type default", () => {
    const params = new URLSearchParams("type=spot&view=captain")

    expect(getOrderFiltersFromParams(params)).toMatchObject({
      type: "spot",
      view: "buyer",
      status: "all",
      query: "",
    })
  })

  it("returns type-specific view options", () => {
    expect(getViewOptions("spot").map((option) => option.value)).toEqual([
      "buyer",
      "seller",
    ])
    expect(getViewOptions("errand").map((option) => option.value)).toEqual([
      "participant",
      "captain",
    ])
  })

  it("returns status options for each type and view", () => {
    expect(getStatusOptions("spot", "seller").map((option) => option.value)).toEqual([
      "all",
      "pending_confirm",
      "paid",
      "processing",
      "completed",
      "cancelled",
    ])
    expect(getStatusOptions("errand", "captain").map((option) => option.value)).toEqual([
      "all",
      "shopping",
      "pending_distributing",
      "distributing",
      "collecting_payment",
      "completed",
      "cancelled",
    ])
  })

  it("knows valid view and type combinations", () => {
    expect(isViewForType("spot", "buyer")).toBe(true)
    expect(isViewForType("spot", "captain")).toBe(false)
    expect(getDefaultViewForType("errand")).toBe("participant")
  })

  it("resets status and query when type changes", () => {
    const params = new URLSearchParams(
      "type=spot&view=seller&status=paid&q=drink"
    )

    const next = updateOrderFilterParams(params, {
      type: "errand",
      rememberedViews: { spot: "seller", errand: "captain" },
    })

    expect(next.toString()).toBe("type=errand&view=captain")
  })

  it("resets status and query when view changes", () => {
    const params = new URLSearchParams(
      "type=spot&view=buyer&status=pending_payment&q=sticker"
    )

    const next = updateOrderFilterParams(params, {
      view: "seller",
      rememberedViews: { spot: "buyer", errand: "participant" },
    })

    expect(next.toString()).toBe("view=seller")
  })
})
```

- [ ] **Step 2: Run test and verify failure**

Run: `pnpm --filter @sast-shop/mobile test -- lib/order-filters.test.ts`

Expected: FAIL because `./order-filters` does not exist.

- [ ] **Step 3: Implement helpers**

Create `apps/mobile/lib/order-filters.ts`.

```ts
import type {
  BuyerErrandOrderStatus,
  ErrandTaskStatusValue,
  SpotOrderStatusValue,
} from "@sast-shop/api"
import type { BadgeProps } from "@workspace/ui/components/badge"

export type OrderType = "spot" | "errand"
export type SpotOrderView = "buyer" | "seller"
export type ErrandOrderView = "participant" | "captain"
export type OrderView = SpotOrderView | ErrandOrderView
export type OrderStatus =
  | "all"
  | "pending_confirm"
  | "processing"
  | BuyerErrandOrderStatus
  | ErrandTaskStatusValue
  | SpotOrderStatusValue

export type RememberedOrderViews = Record<OrderType, OrderView>

export type OrderFilters = {
  type: OrderType
  view: OrderView
  status: OrderStatus
  query: string
}

export type OrderOption<T extends string> = {
  value: T
  label: string
}

export const DEFAULT_REMEMBERED_ORDER_VIEWS: RememberedOrderViews = {
  spot: "buyer",
  errand: "participant",
}

export const DEFAULT_ORDER_FILTERS = {
  type: "spot",
  view: "buyer",
  status: "all",
  query: "",
} satisfies OrderFilters

export const orderTypeOptions: OrderOption<OrderType>[] = [
  { value: "spot", label: "现货" },
  { value: "errand", label: "跑腿" },
]

const spotViewOptions: OrderOption<SpotOrderView>[] = [
  { value: "buyer", label: "我买" },
  { value: "seller", label: "我卖" },
]

const errandViewOptions: OrderOption<ErrandOrderView>[] = [
  { value: "participant", label: "拼单" },
  { value: "captain", label: "团长" },
]

const spotBuyerStatusOptions: OrderOption<OrderStatus>[] = [
  { value: "all", label: "全部" },
  { value: "pending_payment", label: "待支付" },
  { value: "processing", label: "处理中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
]

const spotSellerStatusOptions: OrderOption<OrderStatus>[] = [
  { value: "all", label: "全部" },
  { value: "pending_confirm", label: "待收款" },
  { value: "paid", label: "已付款" },
  { value: "processing", label: "处理中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
]

const errandParticipantStatusOptions: OrderOption<OrderStatus>[] = [
  { value: "all", label: "全部" },
  { value: "open", label: "未接单" },
  { value: "shopping", label: "采购中" },
  { value: "pending_distributing", label: "待分发" },
  { value: "distributing", label: "分发中" },
  { value: "pending_payment", label: "待支付" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
]

const errandCaptainStatusOptions: OrderOption<OrderStatus>[] = [
  { value: "all", label: "全部" },
  { value: "shopping", label: "采购中" },
  { value: "pending_distributing", label: "待分发" },
  { value: "distributing", label: "分发中" },
  { value: "collecting_payment", label: "收款中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
]

export function getViewOptions(type: OrderType) {
  return type === "spot" ? spotViewOptions : errandViewOptions
}

export function getStatusOptions(type: OrderType, view: OrderView) {
  if (type === "spot" && view === "seller") return spotSellerStatusOptions
  if (type === "errand" && view === "captain") return errandCaptainStatusOptions
  if (type === "errand") return errandParticipantStatusOptions
  return spotBuyerStatusOptions
}

export function getDefaultViewForType(type: OrderType): OrderView {
  return type === "spot" ? "buyer" : "participant"
}

export function isOrderType(value: string | null): value is OrderType {
  return value === "spot" || value === "errand"
}

export function isOrderView(value: string | null): value is OrderView {
  return (
    value === "buyer" ||
    value === "seller" ||
    value === "participant" ||
    value === "captain"
  )
}

export function isViewForType(type: OrderType, view: OrderView) {
  return getViewOptions(type).some((option) => option.value === view)
}

export function isStatusForView(
  type: OrderType,
  view: OrderView,
  status: string | null
): status is OrderStatus {
  return getStatusOptions(type, view).some((option) => option.value === status)
}

export function getOrderFiltersFromParams(params: URLSearchParams): OrderFilters {
  const type = isOrderType(params.get("type"))
    ? params.get("type")
    : DEFAULT_ORDER_FILTERS.type
  const requestedView = params.get("view")
  const view =
    isOrderView(requestedView) && isViewForType(type, requestedView)
      ? requestedView
      : getDefaultViewForType(type)
  const status = isStatusForView(type, view, params.get("status"))
    ? params.get("status")
    : DEFAULT_ORDER_FILTERS.status

  return {
    type,
    view,
    status,
    query: params.get("q") ?? DEFAULT_ORDER_FILTERS.query,
  }
}

export function updateOrderFilterParams(
  currentParams: URLSearchParams,
  updates: {
    type?: OrderType
    view?: OrderView
    status?: OrderStatus
    q?: string
    rememberedViews: RememberedOrderViews
  }
) {
  const current = getOrderFiltersFromParams(currentParams)
  const nextType = updates.type ?? current.type
  const typeChanged = nextType !== current.type
  const nextView =
    updates.view ??
    (typeChanged
      ? updates.rememberedViews[nextType] ?? getDefaultViewForType(nextType)
      : current.view)
  const view = isViewForType(nextType, nextView)
    ? nextView
    : getDefaultViewForType(nextType)
  const viewChanged = view !== current.view
  const nextStatus =
    typeChanged || viewChanged
      ? "all"
      : updates.status ?? current.status
  const nextQuery = typeChanged || viewChanged ? "" : updates.q ?? current.query
  const next = new URLSearchParams()

  setQueryParam(next, "type", nextType, "spot")
  setQueryParam(next, "view", view, getDefaultViewForType(nextType))
  setQueryParam(next, "status", nextStatus, "all")
  setQueryParam(next, "q", nextQuery.trim(), "")

  return next
}

export function getStatusLabel(status: OrderStatus) {
  return getAllStatusOptions().find((option) => option.value === status)?.label ?? "未知"
}

export function getStatusBadgeVariant(
  status: OrderStatus
): NonNullable<BadgeProps["variant"]> {
  if (status === "open") return "neutral"
  if (status === "shopping") return "warning"
  if (status === "pending_distributing" || status === "distributing") {
    return "info"
  }
  if (status === "pending_payment") return "payment"
  if (status === "pending_confirm" || status === "collecting_payment") {
    return "attention"
  }
  if (status === "paid") return "review"
  if (status === "completed") return "success"
  if (status === "cancelled") return "danger"
  return "neutral"
}

function getAllStatusOptions() {
  return [
    ...spotBuyerStatusOptions,
    ...spotSellerStatusOptions,
    ...errandParticipantStatusOptions,
    ...errandCaptainStatusOptions,
  ]
}

function setQueryParam(
  params: URLSearchParams,
  key: string,
  value: string,
  defaultValue: string
) {
  if (value && value !== defaultValue) {
    params.set(key, value)
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @sast-shop/mobile test -- lib/order-filters.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/order-filters.ts apps/mobile/lib/order-filters.test.ts
git commit -m "feat: model order page filters"
```

---

### Task 4: Add PerspectiveSwitch

**Files:**
- Create: `apps/mobile/components/perspective-switch.tsx`

- [ ] **Step 1: Create component**

Create `apps/mobile/components/perspective-switch.tsx`.

```tsx
"use client"

import { useId, type KeyboardEvent } from "react"
import { cn } from "@workspace/ui/lib/utils"
import type { OrderOption, OrderView } from "@/lib/order-filters"

type PerspectiveSwitchProps<TValue extends OrderView> = {
  label: string
  value: TValue
  options: OrderOption<TValue>[]
  onValueChange: (value: TValue) => void
  className?: string
}

export function PerspectiveSwitch<TValue extends OrderView>({
  label,
  value,
  options,
  onValueChange,
  className,
}: PerspectiveSwitchProps<TValue>) {
  const labelId = useId()
  const activeIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0
  )

  function moveSelection(direction: 1 | -1) {
    const nextIndex =
      (activeIndex + direction + options.length) % options.length
    const nextOption = options[nextIndex]

    if (nextOption) {
      onValueChange(nextOption.value)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault()
      moveSelection(1)
      return
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault()
      moveSelection(-1)
    }
  }

  return (
    <div className={cn("flex items-center", className)}>
      <span id={labelId} className="sr-only">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="relative grid h-8 min-w-32 grid-cols-2 rounded-full bg-foreground p-0.5 text-xs font-semibold text-background shadow-inner dark:bg-muted"
        onKeyDown={handleKeyDown}
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-primary transition-transform duration-200 ease-out"
          style={{
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
        {options.map((option) => {
          const selected = option.value === value

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              className={cn(
                "relative z-10 rounded-full px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                selected ? "text-primary-foreground" : "text-background dark:text-foreground"
              )}
              onClick={() => onValueChange(option.value)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @sast-shop/mobile typecheck`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/perspective-switch.tsx
git commit -m "feat: add order perspective switch"
```

---

### Task 5: Load All Order Lists

**Files:**
- Modify: `apps/mobile/app/orders/page.tsx`

- [ ] **Step 1: Update server data loading**

Modify `apps/mobile/app/orders/page.tsx` to load all four list sources.

```tsx
import {
  listBuyerErrandOrders,
  listErrandTasks,
  listSpotOrders,
} from "@sast-shop/api"
import { OrdersView } from "@/components/orders-view"
import { mobileAppConfig } from "@/lib/app-config"

async function getOrders() {
  const options = {
    dataSource: mobileAppConfig.dataSource,
    connectBaseUrl: mobileAppConfig.connectBaseUrl,
  }
  const [spotBuyerResult, spotSellerResult, buyerErrandResult, errandTaskResult] =
    await Promise.allSettled([
      listSpotOrders({ ...options, perspective: "purchaser" }),
      listSpotOrders({ ...options, perspective: "seller" }),
      listBuyerErrandOrders(options),
      listErrandTasks(options),
    ])

  return {
    spotBuyerOrders:
      spotBuyerResult.status === "fulfilled" ? spotBuyerResult.value : [],
    spotSellerOrders:
      spotSellerResult.status === "fulfilled" ? spotSellerResult.value : [],
    buyerErrandOrders:
      buyerErrandResult.status === "fulfilled" ? buyerErrandResult.value : [],
    errandTasks:
      errandTaskResult.status === "fulfilled" ? errandTaskResult.value : [],
    errors: {
      spotBuyer: spotBuyerResult.status === "rejected",
      spotSeller: spotSellerResult.status === "rejected",
      errandParticipant: buyerErrandResult.status === "rejected",
      errandCaptain: errandTaskResult.status === "rejected",
    },
  }
}

export default async function OrdersPage() {
  const result = await getOrders()

  return <OrdersView {...result} />
}
```

- [ ] **Step 2: Run typecheck and expect OrdersView prop failure**

Run: `pnpm --filter @sast-shop/mobile typecheck`

Expected: FAIL because `OrdersView` does not yet accept the new props.

- [ ] **Step 3: Leave change for next task**

Do not commit this task until `OrdersView` is updated in Task 6.

---

### Task 6: Rewrite OrdersView

**Files:**
- Modify: `apps/mobile/components/orders-view.tsx`

- [ ] **Step 1: Replace local types and props**

Update `OrdersView` props and renderable order model.

```tsx
type RenderableOrder = {
  id: string
  orderNo: string
  type: OrderType
  view: OrderView
  title: string
  store: string
  status: Exclude<OrderStatus, "all">
  amount: number | null
  summary: string
}

type OrdersViewProps = {
  spotBuyerOrders: SpotOrder[]
  spotSellerOrders: SpotOrder[]
  buyerErrandOrders: BuyerErrandOrder[]
  errandTasks: ErrandTask[]
  errors: {
    spotBuyer: boolean
    spotSeller: boolean
    errandParticipant: boolean
    errandCaptain: boolean
  }
}
```

- [ ] **Step 2: Replace URL state handling**

Use `getOrderFiltersFromParams` and `updateOrderFilterParams`.

```tsx
const [filters, setFilters] = useState<OrderFilters>(DEFAULT_ORDER_FILTERS)
const [rememberedViews, setRememberedViews] =
  useState<RememberedOrderViews>(DEFAULT_REMEMBERED_ORDER_VIEWS)

useEffect(() => {
  const syncFiltersFromLocation = () => {
    const nextFilters = getOrderFiltersFromParams(
      new URLSearchParams(window.location.search)
    )

    setFilters(nextFilters)
    setRememberedViews((current) => ({
      ...current,
      [nextFilters.type]: nextFilters.view,
    }))
  }

  syncFiltersFromLocation()
  window.addEventListener("popstate", syncFiltersFromLocation)

  return () => {
    window.removeEventListener("popstate", syncFiltersFromLocation)
  }
}, [])

function updateQuery(updates: {
  type?: OrderType
  view?: OrderView
  status?: OrderStatus
  q?: string
}) {
  const params = updateOrderFilterParams(new URLSearchParams(window.location.search), {
    ...updates,
    rememberedViews,
  })
  const nextFilters = getOrderFiltersFromParams(params)

  setFilters(nextFilters)
  setRememberedViews((current) => ({
    ...current,
    [nextFilters.type]: nextFilters.view,
  }))
  router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, {
    scroll: false,
  })
}
```

- [ ] **Step 3: Build renderable orders**

```tsx
const orders = useMemo<RenderableOrder[]>(
  () => [
    ...spotBuyerOrders.map((order) => mapSpotOrder(order, "buyer")),
    ...spotSellerOrders.map((order) => mapSpotOrder(order, "seller")),
    ...buyerErrandOrders.map(mapBuyerErrandOrder),
    ...errandTasks.map(mapErrandTask),
  ],
  [buyerErrandOrders, errandTasks, spotBuyerOrders, spotSellerOrders]
)

function mapSpotOrder(order: SpotOrder, view: "buyer" | "seller"): RenderableOrder {
  return {
    id: `${view}-${order.id}`,
    orderNo: order.orderNo || order.id,
    type: "spot",
    view,
    title: order.productTitle,
    store: order.store?.name ?? "现货",
    status: normalizeSpotStatus(order.status, view),
    amount: order.totalAmountCents,
    summary: `现货 x${order.quantity}`,
  }
}

function mapBuyerErrandOrder(order: BuyerErrandOrder): RenderableOrder {
  return {
    id: `participant-${order.id}`,
    orderNo: order.id,
    type: "errand",
    view: "participant",
    title:
      order.productTemplates
        .slice(0, 3)
        .map((template) => template.title)
        .join("、") || "跑腿需求",
    store: order.store?.name ?? "跑腿店铺",
    status: order.status,
    amount:
      order.totalActualAmountCents ??
      order.totalOriginAmountCents + order.totalServiceFeeCents,
    summary: `${order.productTotalCount} 种商品 · 跑腿费 ${formatPrice(
      order.totalServiceFeeCents
    )}`,
  }
}

function mapErrandTask(task: ErrandTask): RenderableOrder {
  return {
    id: `captain-${task.id}`,
    orderNo: task.id,
    type: "errand",
    view: "captain",
    title: `${task.storeName}采购任务`,
    store: task.storeName,
    status: task.status,
    amount: null,
    summary: `${task.itemTotalCount} 种商品`,
  }
}

function normalizeSpotStatus(
  status: SpotOrder["status"],
  view: "buyer" | "seller"
): Exclude<OrderStatus, "all"> {
  if (view === "seller" && status === "pending_payment") {
    return "pending_confirm"
  }

  if (status === "paid") {
    return view === "seller" ? "paid" : "processing"
  }

  return status
}
```

- [ ] **Step 4: Replace layout**

Render:

```tsx
const currentTypeLabel = filters.type === "spot" ? "现货订单" : "跑腿订单"
const currentViewOptions = getViewOptions(filters.type)
const currentStatusOptions = getStatusOptions(filters.type, filters.view)
const filteredOrders = orders.filter(
  (order) =>
    order.type === filters.type &&
    order.view === filters.view &&
    (filters.status === "all" || order.status === filters.status) &&
    (!normalizedQuery ||
      order.store.toLowerCase().includes(normalizedQuery) ||
      order.title.toLowerCase().includes(normalizedQuery))
)

return (
  <div className="flex flex-1 flex-col gap-4 py-6">
    <section className="flex items-center justify-between gap-3">
      <h1 className="text-xl font-semibold md:text-2xl">订单</h1>
      <span className="text-xs text-muted-foreground">
        共 {filteredOrders.length} 笔
      </span>
    </section>

    <Tabs
      value={filters.type}
      onValueChange={(value) => updateQuery({ type: value as OrderType })}
      className="flex-col"
    >
      <TabsList className="grid h-9 w-full grid-cols-2">
        {orderTypeOptions.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>

    <section className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold leading-6">{currentTypeLabel}</h2>
      <PerspectiveSwitch
        label={`${currentTypeLabel}视角`}
        value={filters.view}
        options={currentViewOptions}
        onValueChange={(view) => updateQuery({ view })}
      />
    </section>

    <InputGroup>
      <InputGroupAddon>
        <InputGroupText>
          <RiSearchLine />
        </InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        value={filters.query}
        onChange={(event) => updateQuery({ q: event.target.value })}
        placeholder="搜索店铺或商品"
      />
    </InputGroup>

    <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
      {currentStatusOptions.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={filters.status === option.value ? "default" : "outline"}
          size="sm"
          className="shrink-0 rounded-full"
          onClick={() => updateQuery({ status: option.value })}
        >
          {option.label}
        </Button>
      ))}
    </div>

    <OrderList
      orders={filteredOrders}
      emptyTitle={getEmptyTitle(filters.type, filters.view)}
      hasError={getCurrentError(errors, filters.type, filters.view)}
    />
  </div>
)
```

- [ ] **Step 5: Add helper render functions in same file**

```tsx
function OrderList({
  orders,
  emptyTitle,
  hasError,
}: {
  orders: RenderableOrder[]
  emptyTitle: string
  hasError: boolean
}) {
  if (hasError) {
    return (
      <Empty
        icon={<RiFileList3Line className="size-5" />}
        title="订单暂不可用"
        description="当前订单列表加载失败，请稍后重试。"
      />
    )
  }

  if (orders.length === 0) {
    return (
      <Empty
        icon={<RiFileList3Line className="size-5" />}
        title={emptyTitle}
        description="换一个状态或清空搜索条件。"
      />
    )
  }

  return (
    <section className="grid gap-3 md:grid-cols-2">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </section>
  )
}

function OrderCard({ order }: { order: RenderableOrder }) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="font-mono text-xs text-muted-foreground">
              #{order.orderNo}
            </span>
            <CardTitle className="mt-2 truncate text-base leading-6">
              {order.title}
            </CardTitle>
          </div>
          <Badge variant={getStatusBadgeVariant(order.status)}>
            {getStatusLabel(order.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{order.store}</p>
          <p className="mt-1 truncate text-sm">{order.summary}</p>
        </div>
        {order.amount !== null ? (
          <p className="shrink-0 text-base font-semibold text-primary">
            {formatPrice(order.amount)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function getEmptyTitle(type: OrderType, view: OrderView) {
  if (type === "spot" && view === "seller") return "暂无现货卖方订单"
  if (type === "errand" && view === "participant") return "暂无跑腿拼单订单"
  if (type === "errand" && view === "captain") return "暂无团长任务"
  return "暂无现货买方订单"
}

function getCurrentError(
  errors: OrdersViewProps["errors"],
  type: OrderType,
  view: OrderView
) {
  if (type === "spot" && view === "seller") return errors.spotSeller
  if (type === "errand" && view === "participant") {
    return errors.errandParticipant
  }
  if (type === "errand" && view === "captain") return errors.errandCaptain
  return errors.spotBuyer
}
```

- [ ] **Step 6: Run typecheck**

Run: `pnpm --filter @sast-shop/mobile typecheck`

Expected: PASS.

- [ ] **Step 7: Commit with Task 5 changes**

```bash
git add apps/mobile/app/orders/page.tsx apps/mobile/components/orders-view.tsx
git commit -m "feat: redesign mobile order switching"
```

---

### Task 7: Visual And Interaction Verification

**Files:**
- No source files expected.

- [ ] **Step 1: Run lint**

Run: `pnpm lint`

Expected: PASS.

- [ ] **Step 2: Run tests**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 3: Start mobile dev server**

Run: `pnpm dev:mobile`

Expected: Next.js starts on `http://localhost:3001`.

- [ ] **Step 4: Verify mobile light mode**

Open `http://localhost:3001/orders` at 390 x 844.

Check:

- Type tabs show `现货` and `跑腿`.
- `PerspectiveSwitch` aligns with `现货订单`.
- Active switch state uses theme primary color.
- Search and status filters are outside cards.
- Status badges use colored tones.
- Switching type or view clears search and resets status to `全部`.

- [ ] **Step 5: Verify narrow mobile**

Resize to 320 x 844.

Check:

- `现货订单` and `PerspectiveSwitch` do not overlap.
- Status chips scroll horizontally.
- Long order titles truncate.
- Amounts do not wrap over status badges.

- [ ] **Step 6: Verify dark mode**

Add `dark` to the root HTML element in DevTools.

Check:

- Page background, cards, inputs, tabs, and badges switch to dark tokens.
- Body text and badge text remain readable.
- Primary amount color remains visible.
- Focus rings remain visible.

- [ ] **Step 7: Verify keyboard interaction**

Use keyboard only.

Check:

- Tab reaches type tabs, `PerspectiveSwitch`, search, status controls, and order cards.
- Arrow keys change `PerspectiveSwitch`.
- Focus ring is visible on the active perspective option.

- [ ] **Step 8: Commit verification fixes if needed**

If verification reveals a defect, fix the smallest relevant file and commit:

```bash
git add <changed-files>
git commit -m "fix: polish order switching verification"
```

If verification has no defects, do not create a commit.
