# Captain Errand Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the captain-side errand demand hall and acceptance flow that turns selected buyer `demand_item` rows into a captain `task`.

**Architecture:** Keep generated proto usage inside `packages/api` facades. Mobile routes remain Server Components for data loading and delegate search, selection, confirmation, and submission to focused Client Components. The slice creates the demand hall, detail selection page, API mappings, fauxrpc stubs, and a task handoff card without building procurement, distribution, or payment review operations.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, ConnectRPC Web v2, Protobuf-ES v2, Tailwind CSS v4, shadcn-style `@workspace/ui`, Vitest, pnpm workspace.

---

## File Structure

- Modify `packages/api/src/services/errand-demands.ts`: add demand hall and demand detail list facades next to existing `createErrandDemand`.
- Modify `packages/api/src/services/errand-demands.test.ts`: add tests for demand hall and detail mapping.
- Create `packages/api/src/services/errand-tasks.ts`: add `createErrandTask` and `listErrandTasks`.
- Create `packages/api/src/services/errand-tasks.test.ts`: add tests for task creation, task list mapping, validation, and remote mode.
- Modify `packages/api/src/index.ts`: export the new facade functions and types.
- Create `mock/fauxrpc/stubs/errand-demand.yaml`: add open demand hall and store detail stubs.
- Modify `mock/fauxrpc/stubs/errand-task.yaml`: add `CreateTask` response and ensure list stubs remain valid.
- Modify `packages/api/src/services/catalog.test.ts`: assert the committed errand demand and task stubs exist.
- Create `apps/mobile/lib/errand-selection.ts`: pure helpers for selection and totals.
- Create `apps/mobile/lib/errand-selection.test.ts`: verify selection toggles and total calculations.
- Create `apps/mobile/components/errand-demand-hall.tsx`: captain demand hall client component.
- Create `apps/mobile/components/errand-demand-detail.tsx`: demand row selection and confirmation client component.
- Create `apps/mobile/app/group/errand/page.tsx`: Server Component for hall data loading.
- Create `apps/mobile/app/group/errand/loading.tsx`: skeleton rows while the hall route loads.
- Create `apps/mobile/app/group/errand/[storeId]/page.tsx`: Server Component for store demand detail loading.
- Create `apps/mobile/app/group/errand/[storeId]/loading.tsx`: skeleton rows while the detail route loads.
- Create `apps/mobile/app/group/purchase/[id]/page.tsx`: minimal captain task handoff page so successful acceptance does not route to a missing page.
- Modify `apps/mobile/app/group/page.tsx`: link the `跑腿大厅` restock card to `/group/errand` and optionally show current captain task handoff cards.

## Task 1: Demand Facade Tests

**Files:**
- Modify: `packages/api/src/services/errand-demands.test.ts`

- [ ] **Step 1: Add failing type and mapping tests**

Add imports at the top of `packages/api/src/services/errand-demands.test.ts`:

```ts
import {
  createErrandDemand,
  listErrandDemandStores,
  getErrandDemandDetails,
  type CreateErrandDemandInput,
  type CreateErrandDemandResult,
  type ErrandDemandDetailGroup,
  type ErrandDemandStoreSummary,
} from "./errand-demands"
```

Add these tests inside the existing `describe("errand demand service", () => { ... })` block:

```ts
it("exposes stable captain demand return types", () => {
  expectTypeOf<ReturnType<typeof listErrandDemandStores>>().toEqualTypeOf<
    Promise<ErrandDemandStoreSummary[]>
  >()
  expectTypeOf<ReturnType<typeof getErrandDemandDetails>>().toEqualTypeOf<
    Promise<ErrandDemandDetailGroup[]>
  >()
})

it("lists open errand demand stores through the local Connect backend", async () => {
  const fetchMock = vi.fn(async () =>
    stubJsonResponse({
      demands: [
        {
          storeId: "3001",
          storeName: "SAST 小卖部",
          participantAvatars: [
            "https://example.test/avatar/a.png",
            "https://example.test/avatar/b.png",
          ],
          totalOriginUnitPriceCents: 4200,
          totalServiceFeeCents: 800,
          updatedAt: "1970-01-01T00:00:04Z",
        },
      ],
      currentPage: 1,
      totalCount: 1,
    })
  )
  vi.stubGlobal("fetch", fetchMock)

  const demands = await listErrandDemandStores({
    ...localOptions,
    storeName: "SAST",
    page: 1,
    pageSize: 20,
  })

  expect(demands).toEqual([
    {
      storeId: "3001",
      storeName: "SAST 小卖部",
      participantAvatars: [
        "https://example.test/avatar/a.png",
        "https://example.test/avatar/b.png",
      ],
      totalOriginUnitPriceCents: 4200,
      totalServiceFeeCents: 800,
      updatedAt: "1970-01-01T00:00:04.000Z",
    },
  ])
  await expectConnectRequest(fetchMock, {
    path: "/sast.sastshopv2.errand.v1.ErrandDemandService/GetDemandList",
    body: {
      page: 1,
      pageSize: 20,
      storeName: "SAST",
    },
  })
})

it("gets errand demand details through the local Connect backend", async () => {
  const fetchMock = vi.fn(async () =>
    stubJsonResponse({
      details: [
        {
          errandDemandId: "9001",
          productTemplate: {
            id: "4001",
            title: "农夫山泉矿泉水",
            description: "550ml 瓶装水",
            priceCents: 200,
            storeId: "3001",
            mainImageUrl: "https://example.test/water.png",
            barcode: "690000000001",
            updatedAt: "1970-01-01T00:00:03Z",
          },
          estimatedUnitPriceCents: 200,
          quantity: 12,
          requesters: [
            {
              requesterId: "1001",
              requesterName: "李同学",
              requesterAvatarUrl: "https://example.test/avatar/li.png",
              quantity: 6,
              serviceFeePerUnitCents: 50,
              errandDemandItemId: "9101",
              deadline: "1970-01-01T02:00:00Z",
              updatedAt: "1970-01-01T00:00:05Z",
            },
          ],
        },
      ],
    })
  )
  vi.stubGlobal("fetch", fetchMock)

  const details = await getErrandDemandDetails({ storeId: "3001" }, localOptions)

  expect(details).toEqual([
    expect.objectContaining({
      errandDemandId: "9001",
      estimatedUnitPriceCents: 200,
      quantity: 12,
      productTemplate: expect.objectContaining({
        id: "4001",
        title: "农夫山泉矿泉水",
        updatedAt: "1970-01-01T00:00:03.000Z",
      }),
      requesters: [
        expect.objectContaining({
          requesterId: "1001",
          requesterName: "李同学",
          serviceFeePerUnitCents: 50,
          errandDemandItemId: "9101",
          deadline: "1970-01-01T02:00:00.000Z",
          updatedAt: "1970-01-01T00:00:05.000Z",
        }),
      ],
    }),
  ])
  await expectConnectRequest(fetchMock, {
    path: "/sast.sastshopv2.errand.v1.ErrandDemandService/GetDemandDetail",
    body: {
      storeId: "3001",
    },
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @sast-shop/api test -- errand-demands.test.ts
```

Expected: FAIL with TypeScript or Vitest errors that `listErrandDemandStores`, `getErrandDemandDetails`, `ErrandDemandStoreSummary`, and `ErrandDemandDetailGroup` are not exported from `./errand-demands`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add packages/api/src/services/errand-demands.test.ts
git commit -m "test: specify captain demand facades"
```

## Task 2: Demand Facade Implementation And Stubs

**Files:**
- Modify: `packages/api/src/services/errand-demands.ts`
- Modify: `packages/api/src/index.ts`
- Create: `mock/fauxrpc/stubs/errand-demand.yaml`
- Modify: `packages/api/src/services/catalog.test.ts`

- [ ] **Step 1: Add demand facade types and functions**

In `packages/api/src/services/errand-demands.ts`, add these imports:

```ts
import {
  timestampDate,
  timestampFromDate,
  type Timestamp,
} from "@bufbuild/protobuf/wkt"
import type { ProductTemplate as ProtoProductTemplate } from "../gen/sast/sastshopv2/catalog/v1/product_template_pb"
import type { ErrandDemandByStore as ProtoErrandDemandByStore } from "../gen/sast/sastshopv2/errand/v1/errand_demand_by_store_pb"
import type { ErrandDemandDetail as ProtoErrandDemandDetail } from "../gen/sast/sastshopv2/errand/v1/errand_demand_detail_pb"
import type { ErrandDemandDetailRequester as ProtoErrandDemandDetailRequester } from "../gen/sast/sastshopv2/errand/v1/errand_demand_detail_requester_pb"
import type { ProductTemplate } from "./product-templates"
```

Replace the existing `@bufbuild/protobuf/wkt` import with the combined import above so `timestampFromDate` is not imported twice.

Add these public interfaces below `CreateErrandDemandResult`:

```ts
export interface ErrandDemandStoreSummary {
  storeId: string
  storeName: string
  participantAvatars: string[]
  totalOriginUnitPriceCents: number
  totalServiceFeeCents: number
  updatedAt: string | null
}

export interface ErrandDemandRequester {
  requesterId: string
  requesterName: string
  requesterAvatarUrl: string
  quantity: number
  serviceFeePerUnitCents: number
  errandDemandItemId: string
  deadline: string | null
  updatedAt: string | null
}

export interface ErrandDemandDetailGroup {
  errandDemandId: string
  productTemplate: ProductTemplate | null
  estimatedUnitPriceCents: number
  quantity: number
  requesters: ErrandDemandRequester[]
}
```

Add these functions below `createErrandDemand`:

```ts
export async function listErrandDemandStores(
  options: ServiceOptions & {
    storeName?: string
    page?: number
    pageSize?: number
  } = {}
): Promise<ErrandDemandStoreSummary[]> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(ErrandDemandService, createLocalTransport(options))
    const response = await requestLocal("listErrandDemandStores", () =>
      client.getDemandList({
        page: parsePositiveInteger(options.page ?? 1, "页码不正确"),
        pageSize: parsePositiveInteger(options.pageSize ?? 50, "每页数量不正确"),
        ...(options.storeName?.trim()
          ? { storeName: options.storeName.trim() }
          : {}),
      })
    )

    return response.demands.map(mapErrandDemandStore)
  }

  throw new FeatureUnavailableError("listErrandDemandStores")
}

export async function getErrandDemandDetails(
  input: { storeId: string },
  options: ServiceOptions = {}
): Promise<ErrandDemandDetailGroup[]> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(ErrandDemandService, createLocalTransport(options))
    const response = await requestLocal("getErrandDemandDetails", () =>
      client.getDemandDetail({
        storeId: parseInt64(input.storeId, "店铺 ID 不正确"),
      })
    )

    return response.details.map(mapErrandDemandDetail)
  }

  throw new FeatureUnavailableError("getErrandDemandDetails")
}
```

Add these mapping helpers near the bottom of the file:

```ts
function mapErrandDemandStore(
  demand: ProtoErrandDemandByStore
): ErrandDemandStoreSummary {
  return {
    storeId: demand.storeId.toString(),
    storeName: demand.storeName,
    participantAvatars: demand.participantAvatars,
    totalOriginUnitPriceCents: demand.totalOriginUnitPriceCents,
    totalServiceFeeCents: demand.totalServiceFeeCents,
    updatedAt: formatTimestamp(demand.updatedAt),
  }
}

function mapErrandDemandDetail(
  detail: ProtoErrandDemandDetail
): ErrandDemandDetailGroup {
  return {
    errandDemandId: detail.errandDemandId.toString(),
    productTemplate: mapProductTemplate(detail.productTemplate),
    estimatedUnitPriceCents: detail.estimatedUnitPriceCents,
    quantity: detail.quantity,
    requesters: detail.requesters.map(mapErrandDemandRequester),
  }
}

function mapErrandDemandRequester(
  requester: ProtoErrandDemandDetailRequester
): ErrandDemandRequester {
  return {
    requesterId: requester.requesterId.toString(),
    requesterName: requester.requesterName,
    requesterAvatarUrl: requester.requesterAvatarUrl,
    quantity: requester.quantity,
    serviceFeePerUnitCents: requester.serviceFeePerUnitCents,
    errandDemandItemId: requester.errandDemandItemId.toString(),
    deadline: formatTimestamp(requester.deadline),
    updatedAt: formatTimestamp(requester.updatedAt),
  }
}

function mapProductTemplate(
  template?: ProtoProductTemplate
): ProductTemplate | null {
  if (!template) {
    return null
  }

  return {
    id: template.id.toString(),
    title: template.title,
    description: template.description,
    priceCents: template.priceCents,
    storeId: template.storeId.toString(),
    mainImageUrl: template.mainImageUrl,
    barcode: template.barcode,
    updatedAt: formatTimestamp(template.updatedAt),
  }
}

function formatTimestamp(timestamp?: Timestamp): string | null {
  return timestamp ? timestampDate(timestamp).toISOString() : null
}
```

- [ ] **Step 2: Export demand facade from package index**

In `packages/api/src/index.ts`, update the errand demand export block:

```ts
export {
  createErrandDemand,
  getErrandDemandDetails,
  listErrandDemandStores,
  type CreateErrandDemandInput,
  type CreateErrandDemandResult,
  type ErrandDemandDetailGroup,
  type ErrandDemandRequester,
  type ErrandDemandStoreSummary,
} from "./services/errand-demands"
```

- [ ] **Step 3: Add fauxrpc errand demand stubs**

Create `mock/fauxrpc/stubs/errand-demand.yaml`:

```yaml
stubs:
  - id: errand-demand-get-list
    target: sast.sastshopv2.errand.v1.ErrandDemandService/GetDemandList
    content:
      demands:
        - storeId: "3001"
          storeName: SAST 小卖部
          participantAvatars:
            - https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=128&q=80
            - https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=128&q=80
            - https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&q=80
          totalOriginUnitPriceCents: 4200
          totalServiceFeeCents: 800
          updatedAt: "2026-06-10T06:20:00Z"
      currentPage: 1
      totalCount: 1
  - id: errand-demand-get-detail
    target: sast.sastshopv2.errand.v1.ErrandDemandService/GetDemandDetail
    content:
      details:
        - errandDemandId: "9001"
          productTemplate:
            id: "4001"
            title: 农夫山泉矿泉水
            description: 550ml 瓶装水，适合活动采购
            priceCents: 200
            storeId: "3001"
            mainImageUrl: https://images.unsplash.com/photo-1564419320461-6870880221ad?auto=format&fit=crop&w=640&q=80
            barcode: "690000000001"
            updatedAt: "2026-06-09T00:00:00Z"
          estimatedUnitPriceCents: 200
          quantity: 12
          requesters:
            - requesterId: "1001"
              requesterName: 李同学
              requesterAvatarUrl: https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=128&q=80
              quantity: 6
              serviceFeePerUnitCents: 50
              errandDemandItemId: "9101"
              deadline: "2026-06-10T14:00:00Z"
              updatedAt: "2026-06-10T06:05:00Z"
            - requesterId: "1002"
              requesterName: 郑同学
              requesterAvatarUrl: https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=128&q=80
              quantity: 6
              serviceFeePerUnitCents: 50
              errandDemandItemId: "9102"
              deadline: "2026-06-11T14:00:00Z"
              updatedAt: "2026-06-10T06:06:00Z"
        - errandDemandId: "9002"
          productTemplate:
            id: "4002"
            title: 经典火腿三明治
            description: 冷藏即食，采购后请尽快分发
            priceCents: 1200
            storeId: "3001"
            mainImageUrl: https://images.unsplash.com/photo-1528736235302-52922df5c122?auto=format&fit=crop&w=640&q=80
            barcode: "690000000002"
            updatedAt: "2026-06-09T00:00:00Z"
          estimatedUnitPriceCents: 1200
          quantity: 2
          requesters:
            - requesterId: "1003"
              requesterName: 王同学
              requesterAvatarUrl: https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&q=80
              quantity: 2
              serviceFeePerUnitCents: 100
              errandDemandItemId: "9103"
              deadline: "2026-06-10T14:00:00Z"
              updatedAt: "2026-06-10T06:07:00Z"
```

- [ ] **Step 4: Assert demand stub is committed**

Add this test to `packages/api/src/services/catalog.test.ts`:

```ts
it("commits fauxrpc errand demand stubs for captain demand hall data", async () => {
  const errandDemandStub = await readFile(
    new URL("../../../../mock/fauxrpc/stubs/errand-demand.yaml", import.meta.url),
    "utf8"
  )

  expect(errandDemandStub).toContain(
    "target: sast.sastshopv2.errand.v1.ErrandDemandService/GetDemandList"
  )
  expect(errandDemandStub).toContain(
    "target: sast.sastshopv2.errand.v1.ErrandDemandService/GetDemandDetail"
  )
  expect(errandDemandStub).toContain("errandDemandItemId: \"9101\"")
  expect(errandDemandStub).toContain("serviceFeePerUnitCents: 50")
})
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @sast-shop/api test -- errand-demands.test.ts catalog.test.ts
```

Expected: PASS for the new demand facade and committed stub tests.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/services/errand-demands.ts packages/api/src/index.ts packages/api/src/services/errand-demands.test.ts packages/api/src/services/catalog.test.ts mock/fauxrpc/stubs/errand-demand.yaml
git commit -m "feat: add captain demand facades"
```

## Task 3: Errand Task Facade

**Files:**
- Create: `packages/api/src/services/errand-tasks.ts`
- Create: `packages/api/src/services/errand-tasks.test.ts`
- Modify: `packages/api/src/index.ts`
- Modify: `mock/fauxrpc/stubs/errand-task.yaml`

- [ ] **Step 1: Write failing errand task tests**

Create `packages/api/src/services/errand-tasks.test.ts`:

```ts
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import {
  ApiConfigurationError,
  ApiRequestError,
  FeatureUnavailableError,
  ValidationError,
} from "../errors"
import {
  createErrandTask,
  listErrandTasks,
  type CreateErrandTaskInput,
  type CreateErrandTaskResult,
  type ErrandTaskBrief,
} from "./errand-tasks"

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
}

const validInput: CreateErrandTaskInput = {
  storeId: "3001",
  demandItems: [
    {
      errandDemandItemId: "9101",
      updatedAt: "1970-01-01T00:00:05.000Z",
    },
  ],
}

describe("errand task service", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("exposes stable errand task return types", () => {
    expectTypeOf<ReturnType<typeof createErrandTask>>().toEqualTypeOf<
      Promise<CreateErrandTaskResult>
    >()
    expectTypeOf<ReturnType<typeof listErrandTasks>>().toEqualTypeOf<
      Promise<ErrandTaskBrief[]>
    >()
  })

  it("creates an errand task through the local Connect backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({ errandTaskId: "7001" })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await createErrandTask(validInput, localOptions)

    expect(result).toEqual({ errandTaskId: "7001" })
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.ErrandTaskService/CreateTask",
      body: {
        storeId: "3001",
        demandItems: [
          {
            errandDemandItemId: "9101",
            updatedAt: "1970-01-01T00:00:05Z",
          },
        ],
      },
    })
  })

  it("lists captain errand tasks through the local Connect backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        errandTasks: [
          {
            taskId: "7001",
            storeId: "3001",
            storeName: "SAST 小卖部",
            status: "ERRAND_TASK_STATUS_SHOPPING",
            items: [
              {
                id: "7101",
                requiredQuantity: 12,
              },
            ],
            createdAt: "1970-01-01T00:00:06Z",
          },
        ],
        currentPage: 1,
        totalCount: 1,
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const tasks = await listErrandTasks(localOptions)

    expect(tasks).toEqual([
      {
        id: "7001",
        storeId: "3001",
        storeName: "SAST 小卖部",
        status: "shopping",
        itemCount: 1,
        createdAt: "1970-01-01T00:00:06.000Z",
      },
    ])
  })

  it("validates create errand task input before submitting requests", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(createErrandTask({ ...validInput, storeId: "0" }, localOptions)).rejects.toBeInstanceOf(ValidationError)
    await expect(createErrandTask({ ...validInput, demandItems: [] }, localOptions)).rejects.toBeInstanceOf(ValidationError)
    await expect(
      createErrandTask(
        { ...validInput, demandItems: [{ errandDemandItemId: "0" }] },
        localOptions
      )
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      createErrandTask(
        {
          ...validInput,
          demandItems: [
            { errandDemandItemId: "9101", updatedAt: "not-a-date" },
          ],
        },
        localOptions
      )
    ).rejects.toBeInstanceOf(ValidationError)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("requires a configured Connect base URL for local mode", async () => {
    await expect(createErrandTask(validInput, { dataSource: "local" })).rejects.toBeInstanceOf(ApiConfigurationError)
  })

  it("wraps local create failures in an API request error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stubJsonResponse(
          {
            code: "unavailable",
            message: "backend unavailable",
          },
          { status: 503 }
        )
      )
    )

    await expect(createErrandTask(validInput, localOptions)).rejects.toBeInstanceOf(ApiRequestError)
  })

  it("throws for remote mode before backend client is wired", async () => {
    await expect(createErrandTask(validInput, { dataSource: "remote" })).rejects.toBeInstanceOf(FeatureUnavailableError)
    await expect(listErrandTasks({ dataSource: "remote" })).rejects.toBeInstanceOf(FeatureUnavailableError)
  })
})

function stubJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  })
}

async function expectConnectRequest(
  fetchMock: ReturnType<typeof vi.fn>,
  expected: {
    path: string
    body: Record<string, unknown>
  }
) {
  const [input, init] = fetchMock.mock.calls[0] ?? []
  const url = typeof input === "string" ? input : (input as Request).url
  const body =
    typeof input === "string" ? init?.body : await (input as Request).clone().text()

  expect(new URL(url).pathname).toBe(expected.path)
  expect(JSON.parse(bodyToText(body))).toEqual(expected.body)
}

function bodyToText(body: unknown): string {
  if (body instanceof Uint8Array) {
    return new TextDecoder().decode(body)
  }

  if (body instanceof ArrayBuffer) {
    return new TextDecoder().decode(body)
  }

  return String(body)
}
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @sast-shop/api test -- errand-tasks.test.ts
```

Expected: FAIL because `./errand-tasks` does not exist.

- [ ] **Step 3: Implement errand task facade**

Create `packages/api/src/services/errand-tasks.ts`:

```ts
import { createClient } from "@connectrpc/connect"
import {
  timestampDate,
  timestampFromDate,
  type Timestamp,
} from "@bufbuild/protobuf/wkt"
import type { ErrandTask as ProtoErrandTask } from "../gen/sast/sastshopv2/errand/v1/errand_task_pb"
import { ErrandTaskService } from "../gen/sast/sastshopv2/errand/v1/errand_task_service_pb"
import { ErrandTaskStatus } from "../gen/sast/sastshopv2/errand/v1/errand_task_status_pb"
import { resolveDataSource, type ServiceOptions } from "../data-source"
import { FeatureUnavailableError, ValidationError } from "../errors"
import { createLocalTransport, requestLocal } from "../local-connect"

const MAX_SIGNED_INT64 = 9223372036854775807n

export type ErrandTaskStatusValue =
  | "shopping"
  | "pending_distributing"
  | "distributing"
  | "collecting_payment"
  | "completed"
  | "cancelled"
  | "unknown"

export interface CreateErrandTaskInput {
  storeId: string
  demandItems: Array<{
    errandDemandItemId: string
    updatedAt?: string | null
  }>
}

export interface CreateErrandTaskResult {
  errandTaskId: string
}

export interface ErrandTaskBrief {
  id: string
  storeId: string
  storeName: string
  status: ErrandTaskStatusValue
  itemCount: number
  createdAt: string | null
}

export async function createErrandTask(
  input: CreateErrandTaskInput,
  options: ServiceOptions = {}
): Promise<CreateErrandTaskResult> {
  const request = parseCreateErrandTaskInput(input)
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(ErrandTaskService, createLocalTransport(options))
    const response = await requestLocal("createErrandTask", () =>
      client.createTask(request)
    )

    return { errandTaskId: response.errandTaskId.toString() }
  }

  throw new FeatureUnavailableError("createErrandTask")
}

export async function listErrandTasks(
  options: ServiceOptions & {
    page?: number
    pageSize?: number
    status?: ErrandTaskStatusValue
  } = {}
): Promise<ErrandTaskBrief[]> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(ErrandTaskService, createLocalTransport(options))
    const response = await requestLocal("listErrandTasks", () =>
      client.getErrandTaskList({
        page: parsePositiveInteger(options.page ?? 1, "页码不正确"),
        pageSize: parsePositiveInteger(options.pageSize ?? 50, "每页数量不正确"),
        ...(options.status ? { filterStatus: mapStatusToProto(options.status) } : {}),
      })
    )

    return response.errandTasks.map(mapErrandTask)
  }

  throw new FeatureUnavailableError("listErrandTasks")
}

function parseCreateErrandTaskInput(input: CreateErrandTaskInput) {
  if (input.demandItems.length === 0) {
    throw new ValidationError("接单需求不能为空")
  }

  return {
    storeId: parseInt64(input.storeId, "店铺 ID 不正确"),
    demandItems: input.demandItems.map((item) => {
      const updatedAt = parseOptionalTimestamp(
        item.updatedAt,
        "需求行更新时间不正确"
      )

      return {
        errandDemandItemId: parseInt64(
          item.errandDemandItemId,
          "需求行 ID 不正确"
        ),
        ...(updatedAt ? { updatedAt } : {}),
      }
    }),
  }
}

function mapErrandTask(task: ProtoErrandTask): ErrandTaskBrief {
  return {
    id: task.taskId.toString(),
    storeId: task.storeId.toString(),
    storeName: task.storeName,
    status: mapStatusFromProto(task.status),
    itemCount: task.items.length,
    createdAt: formatTimestamp(task.createdAt),
  }
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

function mapStatusToProto(status: ErrandTaskStatusValue): ErrandTaskStatus {
  if (status === "shopping") return ErrandTaskStatus.SHOPPING
  if (status === "pending_distributing") {
    return ErrandTaskStatus.PENDING_DISTRIBUTING
  }
  if (status === "distributing") return ErrandTaskStatus.DISTRIBUTING
  if (status === "collecting_payment") return ErrandTaskStatus.COLLECTING_PAYMENT
  if (status === "completed") return ErrandTaskStatus.COMPLETED
  if (status === "cancelled") return ErrandTaskStatus.CANCELLED
  throw new ValidationError("采购任务状态不正确")
}

function parseInt64(value: string, message: string): bigint {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ValidationError(message)
  }

  const parsed = BigInt(value)

  if (parsed > MAX_SIGNED_INT64) {
    throw new ValidationError(message)
  }

  return parsed
}

function parsePositiveInteger(value: number, message: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(message)
  }

  return value
}

function parseOptionalTimestamp(
  value: string | null | undefined,
  message: string
): Timestamp | undefined {
  if (!value) {
    return undefined
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(message)
  }

  return timestampFromDate(date)
}

function formatTimestamp(timestamp?: Timestamp): string | null {
  return timestamp ? timestampDate(timestamp).toISOString() : null
}
```

- [ ] **Step 4: Export task facade from package index**

Add to `packages/api/src/index.ts`:

```ts
export {
  createErrandTask,
  listErrandTasks,
  type CreateErrandTaskInput,
  type CreateErrandTaskResult,
  type ErrandTaskBrief,
  type ErrandTaskStatusValue,
} from "./services/errand-tasks"
```

- [ ] **Step 5: Add CreateTask fauxrpc stub**

Append to `mock/fauxrpc/stubs/errand-task.yaml`:

```yaml
  - id: errand-task-create
    target: sast.sastshopv2.errand.v1.ErrandTaskService/CreateTask
    content:
      errandTaskId: "7002"
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm --filter @sast-shop/api test -- errand-tasks.test.ts catalog.test.ts
```

Expected: PASS for errand task facade tests and existing catalog stub assertions.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/services/errand-tasks.ts packages/api/src/services/errand-tasks.test.ts packages/api/src/index.ts mock/fauxrpc/stubs/errand-task.yaml
git commit -m "feat: add captain errand task facade"
```

## Task 4: Selection Helpers

**Files:**
- Create: `apps/mobile/lib/errand-selection.ts`
- Create: `apps/mobile/lib/errand-selection.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `apps/mobile/lib/errand-selection.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  calculateErrandSelectionTotals,
  getSelectableRequesterIds,
  toggleRequesterSelection,
  toggleProductSelection,
  type ErrandSelectionGroup,
} from "./errand-selection"

const groups: ErrandSelectionGroup[] = [
  {
    productId: "4001",
    estimatedUnitPriceCents: 200,
    requesters: [
      {
        errandDemandItemId: "9101",
        quantity: 6,
        serviceFeePerUnitCents: 50,
        updatedAt: "2026-06-10T06:05:00.000Z",
      },
      {
        errandDemandItemId: "9102",
        quantity: 6,
        serviceFeePerUnitCents: 50,
        updatedAt: "2026-06-10T06:06:00.000Z",
      },
    ],
  },
  {
    productId: "4002",
    estimatedUnitPriceCents: 1200,
    requesters: [
      {
        errandDemandItemId: "9103",
        quantity: 2,
        serviceFeePerUnitCents: 100,
        updatedAt: "2026-06-10T06:07:00.000Z",
      },
    ],
  },
]

describe("errand selection helpers", () => {
  it("collects selectable requester row ids", () => {
    expect(getSelectableRequesterIds(groups)).toEqual(["9101", "9102", "9103"])
  })

  it("toggles a single requester row", () => {
    expect(toggleRequesterSelection(new Set(["9101"]), "9101")).toEqual(new Set())
    expect(toggleRequesterSelection(new Set(["9101"]), "9102")).toEqual(
      new Set(["9101", "9102"])
    )
  })

  it("toggles all requester rows in a product group", () => {
    expect(toggleProductSelection(new Set(), groups[0]!)).toEqual(
      new Set(["9101", "9102"])
    )
    expect(toggleProductSelection(new Set(["9101", "9102"]), groups[0]!)).toEqual(
      new Set()
    )
  })

  it("calculates totals from selected rows", () => {
    expect(calculateErrandSelectionTotals(groups, new Set(["9101", "9103"]))).toEqual({
      selectedRowCount: 2,
      selectedQuantity: 8,
      productAmountCents: 3600,
      serviceFeeCents: 500,
      totalAmountCents: 4100,
    })
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @sast-shop/mobile test -- errand-selection.test.ts
```

Expected: FAIL because `apps/mobile/lib/errand-selection.ts` does not exist.

- [ ] **Step 3: Implement selection helpers**

Create `apps/mobile/lib/errand-selection.ts`:

```ts
export type ErrandSelectionRequester = {
  errandDemandItemId: string
  quantity: number
  serviceFeePerUnitCents: number
  updatedAt: string | null
}

export type ErrandSelectionGroup = {
  productId: string
  estimatedUnitPriceCents: number
  requesters: ErrandSelectionRequester[]
}

export type ErrandSelectionTotals = {
  selectedRowCount: number
  selectedQuantity: number
  productAmountCents: number
  serviceFeeCents: number
  totalAmountCents: number
}

export function getSelectableRequesterIds(
  groups: ErrandSelectionGroup[]
): string[] {
  return groups.flatMap((group) =>
    group.requesters
      .filter((requester) => requester.errandDemandItemId && requester.updatedAt)
      .map((requester) => requester.errandDemandItemId)
  )
}

export function toggleRequesterSelection(
  selectedIds: Set<string>,
  requesterId: string
): Set<string> {
  const nextSelectedIds = new Set(selectedIds)

  if (nextSelectedIds.has(requesterId)) {
    nextSelectedIds.delete(requesterId)
  } else {
    nextSelectedIds.add(requesterId)
  }

  return nextSelectedIds
}

export function toggleProductSelection(
  selectedIds: Set<string>,
  group: ErrandSelectionGroup
): Set<string> {
  const selectableIds = group.requesters
    .filter((requester) => requester.errandDemandItemId && requester.updatedAt)
    .map((requester) => requester.errandDemandItemId)
  const nextSelectedIds = new Set(selectedIds)
  const allSelected = selectableIds.every((id) => nextSelectedIds.has(id))

  selectableIds.forEach((id) => {
    if (allSelected) {
      nextSelectedIds.delete(id)
    } else {
      nextSelectedIds.add(id)
    }
  })

  return nextSelectedIds
}

export function calculateErrandSelectionTotals(
  groups: ErrandSelectionGroup[],
  selectedIds: Set<string>
): ErrandSelectionTotals {
  return groups.reduce<ErrandSelectionTotals>(
    (totals, group) =>
      group.requesters.reduce<ErrandSelectionTotals>((nextTotals, requester) => {
        if (!selectedIds.has(requester.errandDemandItemId)) {
          return nextTotals
        }

        const productAmountCents =
          group.estimatedUnitPriceCents * requester.quantity
        const serviceFeeCents =
          requester.serviceFeePerUnitCents * requester.quantity

        return {
          selectedRowCount: nextTotals.selectedRowCount + 1,
          selectedQuantity: nextTotals.selectedQuantity + requester.quantity,
          productAmountCents: nextTotals.productAmountCents + productAmountCents,
          serviceFeeCents: nextTotals.serviceFeeCents + serviceFeeCents,
          totalAmountCents:
            nextTotals.totalAmountCents + productAmountCents + serviceFeeCents,
        }
      }, totals),
    {
      selectedRowCount: 0,
      selectedQuantity: 0,
      productAmountCents: 0,
      serviceFeeCents: 0,
      totalAmountCents: 0,
    }
  )
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --filter @sast-shop/mobile test -- errand-selection.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/errand-selection.ts apps/mobile/lib/errand-selection.test.ts
git commit -m "test: add errand demand selection helpers"
```

## Task 5: Captain Demand Hall Route

**Files:**
- Create: `apps/mobile/app/group/errand/page.tsx`
- Create: `apps/mobile/app/group/errand/loading.tsx`
- Create: `apps/mobile/components/errand-demand-hall.tsx`
- Modify: `apps/mobile/app/group/page.tsx`

- [ ] **Step 1: Create hall server route**

Create `apps/mobile/app/group/errand/page.tsx`:

```tsx
import { listErrandDemandStores, type ErrandDemandStoreSummary } from "@sast-shop/api"
import { ErrandDemandHall } from "@/components/errand-demand-hall"
import { mobileAppConfig } from "@/lib/app-config"

async function loadErrandDemandStores(): Promise<{
  demands: ErrandDemandStoreSummary[]
  error: string | null
}> {
  try {
    return {
      demands: await listErrandDemandStores({
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
      }),
      error: null,
    }
  } catch {
    return {
      demands: [],
      error: "跑腿需求暂不可用，请确认 mock 服务或稍后再试",
    }
  }
}

export default async function ErrandDemandHallPage() {
  const result = await loadErrandDemandStores()

  return <ErrandDemandHall demands={result.demands} error={result.error} />
}
```

- [ ] **Step 2: Create hall loading skeleton**

Create `apps/mobile/app/group/errand/loading.tsx`:

```tsx
import { Skeleton } from "@workspace/ui/components/skeleton"

export default function ErrandDemandHallLoading() {
  return (
    <div className="flex flex-1 flex-col gap-5 py-6">
      <section className="flex flex-col gap-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-5 w-64" />
      </section>
      <section className="rounded-lg border bg-card p-3">
        <Skeleton className="h-10 w-full rounded-md" />
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Create hall client component**

Create `apps/mobile/components/errand-demand-hall.tsx`:

```tsx
"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  RiArrowRightSLine,
  RiSearchLine,
  RiStore2Line,
} from "@remixicon/react"
import type { ErrandDemandStoreSummary } from "@sast-shop/api"
import { formatPrice } from "@sast-shop/domain"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Empty } from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"

export function ErrandDemandHall({
  demands,
  error,
}: {
  demands: ErrandDemandStoreSummary[]
  error: string | null
}) {
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLowerCase()
  const filteredDemands = useMemo(
    () =>
      demands.filter(
        (demand) =>
          !normalizedQuery ||
          demand.storeName.toLowerCase().includes(normalizedQuery)
      ),
    [demands, normalizedQuery]
  )

  return (
    <div className="flex flex-1 flex-col gap-5 py-6">
      <section className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold md:text-2xl">跑腿采购大厅</h1>
        <p className="text-sm text-muted-foreground">
          {error ?? "按店铺聚合未接单需求，选择完整需求行后接单。"}
        </p>
      </section>

      <section className="rounded-lg border bg-card p-3">
        <div className="relative">
          <RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
            placeholder="搜索店铺名称"
          />
        </div>
      </section>

      {filteredDemands.length > 0 ? (
        <section className="grid gap-3 md:grid-cols-2">
          {filteredDemands.map((demand) => (
            <DemandStoreCard key={demand.storeId} demand={demand} />
          ))}
        </section>
      ) : (
        <Empty
          icon={<RiStore2Line className="size-5" />}
          title={error ? "跑腿需求暂不可用" : "暂无待接单需求"}
          description={
            error ??
            (query.trim()
              ? "没有匹配的店铺需求。"
              : "有新的跑腿需求时会显示在这里。")
          }
        />
      )}
    </div>
  )
}

function DemandStoreCard({ demand }: { demand: ErrandDemandStoreSummary }) {
  const totalAmount =
    demand.totalOriginUnitPriceCents + demand.totalServiceFeeCents

  return (
    <Card className="rounded-lg">
      <Link
        href={`/group/errand/${demand.storeId}`}
        className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <CardHeader className="gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-base leading-6">
                {demand.storeName}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatUpdatedAt(demand.updatedAt)}
              </p>
            </div>
            <p className="shrink-0 text-lg font-semibold text-primary">
              {formatPrice(totalAmount)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              商品 {formatPrice(demand.totalOriginUnitPriceCents)}
            </Badge>
            <Badge variant="secondary">
              跑腿 {formatPrice(demand.totalServiceFeeCents)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {demand.participantAvatars.slice(0, 3).map((avatar, index) => (
              <Avatar key={`${avatar}-${index}`} className="size-7 border-2 border-card">
                <AvatarImage src={avatar} alt="购买人头像" />
                <AvatarFallback className="text-xs">买</AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {demand.participantAvatars.length} 位购买人
          </span>
          <Button asChild size="sm" className="shrink-0 rounded-full">
            <span>
              查看需求
              <RiArrowRightSLine data-icon="inline-end" />
            </span>
          </Button>
        </CardContent>
      </Link>
    </Card>
  )
}

function formatUpdatedAt(value: string | null) {
  if (!value) {
    return "更新时间未知"
  }

  return `更新于 ${new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))}`
}
```

- [ ] **Step 4: Link group page restock card**

In `apps/mobile/app/group/page.tsx`, import `Button` if needed and wrap the `跑腿大厅` card with `Link href="/group/errand"`. The card should keep the current visual vocabulary and be keyboard-focusable:

```tsx
<Link
  href="/group/errand"
  className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
>
  <Card className="h-full rounded-lg p-1">
    <CardHeader className="gap-3">
      <RiRunLine className="size-8 text-primary" />
      <div className="min-w-0">
        <CardTitle className="truncate text-base leading-5">
          跑腿大厅
        </CardTitle>
        <CardDescription>接单、分发、收款</CardDescription>
      </div>
    </CardHeader>
  </Card>
</Link>
```

- [ ] **Step 5: Run lint for mobile**

Run:

```bash
pnpm --filter @sast-shop/mobile lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/group/errand/page.tsx apps/mobile/app/group/errand/loading.tsx apps/mobile/components/errand-demand-hall.tsx apps/mobile/app/group/page.tsx
git commit -m "feat: add captain errand demand hall"
```

## Task 6: Captain Demand Detail Route

**Files:**
- Create: `apps/mobile/app/group/errand/[storeId]/page.tsx`
- Create: `apps/mobile/app/group/errand/[storeId]/loading.tsx`
- Create: `apps/mobile/components/errand-demand-detail.tsx`
- Create: `apps/mobile/app/group/purchase/[id]/page.tsx`

- [ ] **Step 1: Create detail server route**

Create `apps/mobile/app/group/errand/[storeId]/page.tsx`:

```tsx
import {
  getErrandDemandDetails,
  listStores,
  type ErrandDemandDetailGroup,
} from "@sast-shop/api"
import { RiStore2Line } from "@remixicon/react"
import { Empty } from "@workspace/ui/components/empty"
import { ErrandDemandDetail } from "@/components/errand-demand-detail"
import { mobileAppConfig } from "@/lib/app-config"

type PageProps = {
  params: Promise<{
    storeId: string
  }>
}

async function loadDemandDetails(storeId: string): Promise<{
  details: ErrandDemandDetailGroup[]
  storeName: string
  error: string | null
}> {
  try {
    const [stores, details] = await Promise.all([
      listStores({
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
      }),
      getErrandDemandDetails(
        { storeId },
        {
          dataSource: mobileAppConfig.dataSource,
          connectBaseUrl: mobileAppConfig.connectBaseUrl,
        }
      ),
    ])

    return {
      details,
      storeName:
        stores.find((store) => store.id === storeId)?.name ?? "店铺需求",
      error: null,
    }
  } catch {
    return {
      details: [],
      storeName: "店铺需求",
      error: "跑腿需求详情暂不可用，请稍后再试",
    }
  }
}

export default async function ErrandDemandDetailPage({ params }: PageProps) {
  const { storeId } = await params
  const { details, storeName, error } = await loadDemandDetails(storeId)

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center py-6">
        <Empty
          icon={<RiStore2Line className="size-5" />}
          title="需求详情暂不可用"
          description={error}
        />
      </div>
    )
  }

  return (
    <ErrandDemandDetail
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      storeId={storeId}
      storeName={storeName}
      details={details}
    />
  )
}
```

- [ ] **Step 2: Create detail loading skeleton**

Create `apps/mobile/app/group/errand/[storeId]/loading.tsx`:

```tsx
import { Skeleton } from "@workspace/ui/components/skeleton"

export default function ErrandDemandDetailLoading() {
  return (
    <div className="flex flex-1 flex-col gap-5 py-6">
      <section className="flex flex-col gap-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-5 w-56" />
      </section>
      <section className="flex flex-col gap-3 pb-28">
        {Array.from({ length: 2 }).map((_, groupIndex) => (
          <div key={groupIndex} className="rounded-lg border bg-card p-3">
            <div className="flex gap-3">
              <Skeleton className="size-16 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-5 w-28" />
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </section>
      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-card px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create detail client component**

Create `apps/mobile/components/errand-demand-detail.tsx` with these core imports and structure:

```tsx
"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  RiCheckboxCircleLine,
  RiStore2Line,
} from "@remixicon/react"
import {
  createErrandTask,
  type DataSource,
  type ErrandDemandDetailGroup,
} from "@sast-shop/api"
import { formatPrice } from "@sast-shop/domain"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { Empty } from "@workspace/ui/components/empty"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"
import { ManagedImage } from "./managed-image"
import {
  calculateErrandSelectionTotals,
  toggleProductSelection,
  toggleRequesterSelection,
  type ErrandSelectionGroup,
} from "@/lib/errand-selection"

export function ErrandDemandDetail({
  dataSource,
  connectBaseUrl,
  storeId,
  storeName,
  details,
}: {
  dataSource: DataSource
  connectBaseUrl: string
  storeId: string
  storeName: string
  details: ErrandDemandDetailGroup[]
}) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const selectionGroups = useMemo<ErrandSelectionGroup[]>(
    () =>
      details.map((group) => ({
        productId: group.productTemplate?.id ?? group.errandDemandId,
        estimatedUnitPriceCents: group.estimatedUnitPriceCents,
        requesters: group.requesters.map((requester) => ({
          errandDemandItemId: requester.errandDemandItemId,
          quantity: requester.quantity,
          serviceFeePerUnitCents: requester.serviceFeePerUnitCents,
          updatedAt: requester.updatedAt,
        })),
      })),
    [details]
  )
  const totals = useMemo(
    () => calculateErrandSelectionTotals(selectionGroups, selectedIds),
    [selectionGroups, selectedIds]
  )

  async function submitTask() {
    if (totals.selectedRowCount === 0 || submitting) {
      return
    }

    setSubmitting(true)
    try {
      const byId = new Map(
        details.flatMap((group) =>
          group.requesters.map((requester) => [requester.errandDemandItemId, requester])
        )
      )
      const result = await createErrandTask(
        {
          storeId,
          demandItems: Array.from(selectedIds).map((id) => {
            const requester = byId.get(id)

            return {
              errandDemandItemId: id,
              updatedAt: requester?.updatedAt,
            }
          }),
        },
        { dataSource, connectBaseUrl }
      )

      toast.success("接单成功")
      setConfirmOpen(false)
      router.push(`/group/purchase/${result.errandTaskId}`)
    } catch {
      toast.error("部分需求已被接单，请刷新后重试")
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  if (details.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-6">
        <Empty
          icon={<RiStore2Line className="size-5" />}
          title="这个店铺暂无可接单需求"
          description="可以返回跑腿采购大厅查看其他店铺。"
        />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-5 py-6">
      <section className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold md:text-2xl">
          {storeName}
        </h1>
        <p className="text-sm text-muted-foreground">
          勾选完整需求行，创建采购任务。
        </p>
      </section>

      <section className="flex flex-col gap-3 pb-28">
        {details.map((group, groupIndex) => (
          <DemandProductGroup
            key={`${group.errandDemandId}-${group.productTemplate?.id ?? groupIndex}`}
            group={group}
            selectedIds={selectedIds}
            onToggleProduct={() =>
              setSelectedIds((current) =>
                toggleProductSelection(current, selectionGroups[groupIndex]!)
              )
            }
            onToggleRequester={(id) =>
              setSelectedIds((current) => toggleRequesterSelection(current, id))
            }
          />
        ))}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-card px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:sticky md:bottom-auto md:rounded-lg md:border">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              已选 {totals.selectedRowCount} 行，{totals.selectedQuantity} 件
            </p>
            <p className="truncate text-xs text-muted-foreground">
              商品 {formatPrice(totals.productAmountCents)} · 跑腿费{" "}
              {formatPrice(totals.serviceFeeCents)}
            </p>
          </div>
          <Button
            type="button"
            disabled={totals.selectedRowCount === 0 || submitting}
            onClick={() => setConfirmOpen(true)}
          >
            确认接单
          </Button>
        </div>
      </div>

      <ResponsiveDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>确认接单</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              选中的需求行会创建为你的采购任务，未选中的需求仍留在大厅等待其他团长接单。
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={submitting}
              onClick={submitTask}
            >
              {submitting ? "接单中" : "确认接单"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  )
}
```

In the same file, add `DemandProductGroup`, `RequesterRow`, `nameInitial`, and `formatDeadline` helpers. Keep rows accessible with native checkbox inputs:

```tsx
function DemandProductGroup({
  group,
  selectedIds,
  onToggleProduct,
  onToggleRequester,
}: {
  group: ErrandDemandDetailGroup
  selectedIds: Set<string>
  onToggleProduct: () => void
  onToggleRequester: (id: string) => void
}) {
  const selectedCount = group.requesters.filter((requester) =>
    selectedIds.has(requester.errandDemandItemId)
  ).length
  const allSelected =
    group.requesters.length > 0 && selectedCount === group.requesters.length
  const product = group.productTemplate

  return (
    <Card className="rounded-lg p-3">
      <div className="flex gap-3">
        <button
          type="button"
          className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onToggleProduct}
          aria-label={`切换${product?.title ?? "商品"}全部需求`}
        >
          <ManagedImage
            src={product?.mainImageUrl ?? ""}
            alt={product?.title ?? "商品图片"}
            className="size-16 rounded-lg"
          />
        </button>
        <div className="min-w-0 flex-1">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleProduct}
              className="mt-1 size-4 accent-primary"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {product?.title ?? "未命名商品"}
              </span>
              <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {product?.description ?? "暂无规格信息"}
              </span>
            </span>
            <Badge variant="secondary" className="shrink-0">
              合计 x{group.quantity}
            </Badge>
          </label>
          <p className="mt-2 text-sm text-primary">
            预估单价 {formatPrice(group.estimatedUnitPriceCents)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {group.requesters.map((requester) => (
          <RequesterRow
            key={requester.errandDemandItemId}
            requester={requester}
            selected={selectedIds.has(requester.errandDemandItemId)}
            onToggle={() => onToggleRequester(requester.errandDemandItemId)}
          />
        ))}
      </div>
    </Card>
  )
}

function RequesterRow({
  requester,
  selected,
  onToggle,
}: {
  requester: ErrandDemandDetailGroup["requesters"][number]
  selected: boolean
  onToggle: () => void
}) {
  const disabled = !requester.errandDemandItemId || !requester.updatedAt

  return (
    <label
      className={cn(
        "flex items-center gap-2 rounded-lg border p-2",
        selected && "border-primary/40 bg-primary/5",
        disabled && "opacity-60"
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        disabled={disabled}
        onChange={onToggle}
        className="size-4 accent-primary"
      />
      <Avatar className="size-8">
        <AvatarImage src={requester.requesterAvatarUrl} alt={requester.requesterName} />
        <AvatarFallback className="text-xs">
          {nameInitial(requester.requesterName)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {requester.requesterName}
          <span className="ml-1 font-normal text-muted-foreground">
            {requester.quantity} 件
          </span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {formatDeadline(requester.deadline)}
        </span>
      </span>
      <span className="shrink-0 text-xs font-semibold text-primary">
        跑腿 {formatPrice(requester.serviceFeePerUnitCents * requester.quantity)}
      </span>
    </label>
  )
}

function nameInitial(name: string) {
  return name.trim().slice(0, 1) || "买"
}

function formatDeadline(value: string | null) {
  if (!value) {
    return "期望送达未知"
  }

  return `期望 ${new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))}`
}
```

- [ ] **Step 4: Add captain task handoff page**

Create `apps/mobile/app/group/purchase/[id]/page.tsx`:

```tsx
import { RiFileList3Line } from "@remixicon/react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Empty } from "@workspace/ui/components/empty"

type PageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function CaptainPurchaseHandoffPage({ params }: PageProps) {
  const { id } = await params

  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <Empty
        icon={<RiFileList3Line className="size-5" />}
        title="采购任务已创建"
        description={`任务 #${id} 已进入正在采购。采购清单处理会在下一步接入。`}
        action={
          <Button asChild>
            <Link href="/group">返回团购</Link>
          </Button>
        }
      />
    </div>
  )
}
```

- [ ] **Step 5: Run mobile tests and lint**

Run:

```bash
pnpm --filter @sast-shop/mobile test -- errand-selection.test.ts
pnpm --filter @sast-shop/mobile lint
```

Expected: both commands PASS.

- [ ] **Step 6: Commit**

```bash
git add 'apps/mobile/app/group/errand/[storeId]/page.tsx' 'apps/mobile/app/group/errand/[storeId]/loading.tsx' 'apps/mobile/app/group/purchase/[id]/page.tsx' apps/mobile/components/errand-demand-detail.tsx
git commit -m "feat: add captain errand demand detail"
```

## Task 7: Integration Verification

**Files:**
- No planned edits. If a verification command fails, fix only the files named by the failing output and rerun the same command before continuing.

- [ ] **Step 1: Run API tests**

Run:

```bash
pnpm --filter @sast-shop/api test
```

Expected: PASS.

- [ ] **Step 2: Run mobile tests**

Run:

```bash
pnpm --filter @sast-shop/mobile test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
pnpm build
```

Expected: PASS. If Turbopack fails in the sandbox with a port permission error, rerun with approval because this repository notes that `pnpm build` may need elevated permissions for Turbopack.

- [ ] **Step 5: Start mobile dev server**

Run:

```bash
pnpm dev:mobile
```

Expected: Next.js serves the mobile app on `http://localhost:3001`.

- [ ] **Step 6: Manual smoke check**

Use the in-app Browser at `http://localhost:3001` with mobile viewport 390×844 and verify:

- `/group` shows the `跑腿大厅` entry and it navigates to `/group/errand`.
- `/group/errand` shows search and every card has `查看需求`.
- Hall card amounts show product amount, service fee, and total clearly.
- `/group/errand/3001` shows product groups.
- Every requester row has an avatar and visible service fee.
- Product-level checkbox toggles child rows.
- Bottom bar totals update when rows are selected.
- Confirmation overlay opens as a Drawer on mobile.
- Successful submit shows `接单成功` and navigates to `/group/purchase/7002`.
- No content is hidden under the bottom navigation or safe area.

- [ ] **Step 7: Commit verification fixes**

If Step 1 through Step 6 required fixes, commit those fixes:

For a UI-only verification fix, run:

```bash
git add apps/mobile/components/errand-demand-detail.tsx apps/mobile/components/errand-demand-hall.tsx apps/mobile/app/group/page.tsx
git commit -m "fix: stabilize captain errand entry flow"
```

For an API-only verification fix, run:

```bash
git add packages/api/src/services/errand-demands.ts packages/api/src/services/errand-tasks.ts packages/api/src/index.ts
git commit -m "fix: stabilize captain errand entry flow"
```

If `git status --short` is clean after verification, do not create an empty commit.
