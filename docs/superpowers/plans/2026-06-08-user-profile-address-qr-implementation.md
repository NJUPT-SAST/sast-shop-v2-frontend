# User Profile, Address, and QR Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the user profile, address book, and payment QR code foundation behind the `@sast-shop/api` facade, then expose it in independent mobile and desktop `/profile` pages.

**Architecture:** Keep pages dependent only on `@sast-shop/api` DTOs. `mock` uses `packages/mocks` fixtures and services, `local` uses Connect-ES v2 clients against fauxrpc, and `remote` throws `FeatureUnavailableError`. Proto messages remain inside `packages/api` and never cross page/client component boundaries.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4, Vitest, pnpm workspace, Connect-ES v2, Protobuf-ES v2, fauxrpc.

---

## File Structure

Create or modify these files:

- Create `packages/api/src/local-connect.ts`: shared local Connect transport and request wrapper.
- Modify `packages/api/src/errors.ts`: add `ValidationError`.
- Modify `packages/api/src/index.ts`: export new errors, DTOs, and facade functions.
- Create `packages/api/src/services/addresses.ts`: address DTOs, mock/local/remote facade, proto mappers.
- Create `packages/api/src/services/payment-qr-codes.ts`: QR code DTOs, mock/local/remote facade, enum mappers.
- Create `packages/api/src/services/profile.ts`: `ProfileOverview` composition service.
- Modify `packages/api/src/services/auth.ts`: reuse shared local Connect helper.
- Create `packages/api/src/services/addresses.test.ts`.
- Create `packages/api/src/services/payment-qr-codes.test.ts`.
- Create `packages/api/src/services/profile.test.ts`.
- Create `packages/api/src/errors.test.ts`.
- Create `packages/mocks/src/fixtures/addresses.ts`.
- Create `packages/mocks/src/fixtures/payment-qr-codes.ts`.
- Create `packages/mocks/src/services/addresses.ts`.
- Create `packages/mocks/src/services/payment-qr-codes.ts`.
- Modify `packages/mocks/src/index.ts`.
- Create `mock/fauxrpc/stubs/address.yaml`.
- Create `mock/fauxrpc/stubs/payment-qr-code.yaml`.
- Create `apps/mobile/app/profile/page.tsx`.
- Create `apps/mobile/components/profile-management.tsx`.
- Create `apps/mobile/components/profile-management-client.tsx`.
- Modify `apps/mobile/components/mobile-shell.tsx`.
- Create `apps/desktop/app/profile/page.tsx`.
- Create `apps/desktop/components/profile-management.tsx`.
- Create `apps/desktop/components/profile-management-client.tsx`.
- Modify `apps/desktop/components/desktop-shell.tsx`.

## Task 1: Shared API Error And Local Connect Helpers

**Files:**
- Modify: `packages/api/src/errors.ts`
- Modify: `packages/api/src/index.ts`
- Create: `packages/api/src/local-connect.ts`
- Modify: `packages/api/src/services/auth.ts`
- Create: `packages/api/src/errors.test.ts`
- Test: `packages/api/src/services/auth.test.ts`

- [ ] **Step 1: Write the failing error test**

Create `packages/api/src/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  ApiConfigurationError,
  ApiRequestError,
  FeatureUnavailableError,
  ValidationError,
} from "./errors"

describe("api errors", () => {
  it("names typed API errors consistently", () => {
    expect(new FeatureUnavailableError("profile").name).toBe(
      "FeatureUnavailableError"
    )
    expect(new ApiRequestError("profile").name).toBe("ApiRequestError")
    expect(new ApiConfigurationError("NEXT_PUBLIC_CONNECT_BASE_URL").name).toBe(
      "ApiConfigurationError"
    )
    expect(new ValidationError("收件人不能为空").name).toBe("ValidationError")
  })

  it("keeps validation messages user-readable", () => {
    expect(new ValidationError("手机号格式不正确").message).toBe(
      "手机号格式不正确"
    )
  })
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm --filter @sast-shop/api test -- errors.test.ts
```

Expected: FAIL because `ValidationError` is not exported yet.

- [ ] **Step 3: Add `ValidationError`**

Append to `packages/api/src/errors.ts`:

```ts
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ValidationError"
  }
}
```

Modify `packages/api/src/index.ts` error exports:

```ts
export {
  ApiConfigurationError,
  ApiRequestError,
  AuthRequiredError,
  FeatureUnavailableError,
  ValidationError,
} from "./errors"
```

- [ ] **Step 4: Create the shared local Connect helper**

Create `packages/api/src/local-connect.ts`:

```ts
import { createConnectTransport } from "@connectrpc/connect-web"
import {
  resolveConnectBaseUrl,
  type ServiceOptions,
} from "./data-source"
import { ApiRequestError } from "./errors"

export function createLocalTransport(options: ServiceOptions = {}) {
  return createConnectTransport({ baseUrl: resolveConnectBaseUrl(options) })
}

export async function requestLocal<T>(
  feature: string,
  request: () => Promise<T>
): Promise<T> {
  try {
    return await request()
  } catch (error) {
    throw new ApiRequestError(feature, error)
  }
}
```

- [ ] **Step 5: Refactor auth to use the helper**

In `packages/api/src/services/auth.ts`, remove the direct `createConnectTransport` import and the private `createLocalTransport` / `requestLocal` functions. Add:

```ts
import { createLocalTransport, requestLocal } from "../local-connect"
```

Keep existing `createClient(AuthService, createLocalTransport(options))` and `requestLocal(...)` call sites unchanged.

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm --filter @sast-shop/api test -- errors.test.ts auth.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/errors.ts packages/api/src/index.ts packages/api/src/local-connect.ts packages/api/src/services/auth.ts packages/api/src/errors.test.ts
git commit -m "feat: add shared api local connect helpers"
```

## Task 2: Mock Address And QR Code Services

**Files:**
- Create: `packages/mocks/src/fixtures/addresses.ts`
- Create: `packages/mocks/src/fixtures/payment-qr-codes.ts`
- Create: `packages/mocks/src/services/addresses.ts`
- Create: `packages/mocks/src/services/payment-qr-codes.ts`
- Modify: `packages/mocks/src/index.ts`
- Test: `packages/api/src/services/addresses.test.ts` and `packages/api/src/services/payment-qr-codes.test.ts` are created in Tasks 3 and 4.

- [ ] **Step 1: Add address fixtures**

Create `packages/mocks/src/fixtures/addresses.ts`:

```ts
export interface MockShippingAddress {
  id: string
  recipientName: string
  recipientPhone: string
  province: string
  city: string
  district: string
  detailAddress: string
  isDefault: boolean
}

export const mockShippingAddresses: MockShippingAddress[] = [
  {
    id: "1001",
    recipientName: "南邮同学",
    recipientPhone: "13800000001",
    province: "江苏省",
    city: "南京市",
    district: "栖霞区",
    detailAddress: "南京邮电大学仙林校区 SAST 活动室",
    isDefault: true,
  },
  {
    id: "1002",
    recipientName: "值班同学",
    recipientPhone: "13800000002",
    province: "江苏省",
    city: "南京市",
    district: "鼓楼区",
    detailAddress: "南京邮电大学三牌楼校区收发室",
    isDefault: false,
  },
]
```

- [ ] **Step 2: Add QR code fixtures**

Create `packages/mocks/src/fixtures/payment-qr-codes.ts`:

```ts
export type MockPaymentQrChannel = "wechat" | "alipay"

export interface MockPaymentQrCode {
  id: string
  channel: MockPaymentQrChannel
  content: string
}

export const mockPaymentQrCodes: MockPaymentQrCode[] = [
  {
    id: "2001",
    channel: "wechat",
    content: "https://example.test/pay/wechat/sast",
  },
  {
    id: "2002",
    channel: "alipay",
    content: "https://example.test/pay/alipay/sast",
  },
]
```

- [ ] **Step 3: Add mock address service**

Create `packages/mocks/src/services/addresses.ts`:

```ts
import {
  mockShippingAddresses,
  type MockShippingAddress,
} from "../fixtures/addresses"

export type MockShippingAddressInput = Omit<MockShippingAddress, "id">

export function listMockAddresses(): MockShippingAddress[] {
  return mockShippingAddresses
}

export function getMockAddress(id: string): MockShippingAddress | null {
  return mockShippingAddresses.find((address) => address.id === id) ?? null
}

export function createMockAddress(
  input: MockShippingAddressInput
): MockShippingAddress {
  return {
    id: "1003",
    ...normalizeDefaultAddress(input),
  }
}

export function updateMockAddress(
  id: string,
  input: MockShippingAddressInput
): MockShippingAddress {
  return {
    id,
    ...normalizeDefaultAddress(input),
  }
}

export function deleteMockAddress(id: string): { deletedId: string } {
  return { deletedId: id }
}

function normalizeDefaultAddress(
  input: MockShippingAddressInput
): MockShippingAddressInput {
  if (!input.isDefault) {
    return input
  }

  return {
    ...input,
    isDefault: true,
  }
}
```

- [ ] **Step 4: Add mock QR code service**

Create `packages/mocks/src/services/payment-qr-codes.ts`:

```ts
import {
  mockPaymentQrCodes,
  type MockPaymentQrChannel,
  type MockPaymentQrCode,
} from "../fixtures/payment-qr-codes"

export interface MockPaymentQrCodeInput {
  channel: MockPaymentQrChannel
  content: string
}

export function listMockPaymentQrCodes(): MockPaymentQrCode[] {
  return mockPaymentQrCodes
}

export function updateMockPaymentQrCode(
  input: MockPaymentQrCodeInput
): MockPaymentQrCode {
  const existing = mockPaymentQrCodes.find(
    (qrCode) => qrCode.channel === input.channel
  )

  return {
    id: existing?.id ?? "2003",
    channel: input.channel,
    content: input.content,
  }
}
```

- [ ] **Step 5: Export mock fixtures and services**

Modify `packages/mocks/src/index.ts`:

```ts
export { currentUser, type MockUser } from "./fixtures/current-user"
export {
  mockShippingAddresses,
  type MockShippingAddress,
} from "./fixtures/addresses"
export {
  mockPaymentQrCodes,
  type MockPaymentQrChannel,
  type MockPaymentQrCode,
} from "./fixtures/payment-qr-codes"
export { getMockCurrentUser, loginWithMockCode } from "./services/auth"
export {
  createMockAddress,
  deleteMockAddress,
  getMockAddress,
  listMockAddresses,
  updateMockAddress,
  type MockShippingAddressInput,
} from "./services/addresses"
export {
  listMockPaymentQrCodes,
  updateMockPaymentQrCode,
  type MockPaymentQrCodeInput,
} from "./services/payment-qr-codes"
```

- [ ] **Step 6: Run package checks**

Run:

```bash
pnpm --filter @sast-shop/mocks typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/mocks/src
git commit -m "feat: add profile mock data"
```

## Task 3: Address API Facade

**Files:**
- Create: `packages/api/src/services/addresses.ts`
- Create: `packages/api/src/services/addresses.test.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Write address facade tests**

Create `packages/api/src/services/addresses.test.ts`:

```ts
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import {
  ApiConfigurationError,
  ApiRequestError,
  FeatureUnavailableError,
  ValidationError,
} from "../errors"
import {
  createAddress,
  deleteAddress,
  getAddress,
  listAddresses,
  updateAddress,
  type ShippingAddress,
  type ShippingAddressInput,
} from "./addresses"

const validInput: ShippingAddressInput = {
  recipientName: "南邮同学",
  recipientPhone: "13800000001",
  province: "江苏省",
  city: "南京市",
  district: "栖霞区",
  detailAddress: "南京邮电大学仙林校区 SAST 活动室",
  isDefault: true,
}

describe("address service", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("exposes stable address return types", () => {
    expectTypeOf(listAddresses()).toEqualTypeOf<Promise<ShippingAddress[]>>()
    expectTypeOf(getAddress("1001")).toEqualTypeOf<Promise<ShippingAddress>>()
    expectTypeOf(createAddress(validInput)).toEqualTypeOf<Promise<ShippingAddress>>()
    expectTypeOf(updateAddress("1001", validInput)).toEqualTypeOf<
      Promise<ShippingAddress>
    >()
    expectTypeOf(deleteAddress("1001")).toEqualTypeOf<Promise<void>>()
  })

  it("returns mock addresses in mock mode", async () => {
    const addresses = await listAddresses({ dataSource: "mock" })
    expect(addresses[0]).toMatchObject({
      id: "1001",
      recipientName: "南邮同学",
      isDefault: true,
    })
  })

  it("returns one mock address by id", async () => {
    await expect(getAddress("1001", { dataSource: "mock" })).resolves.toMatchObject({
      id: "1001",
      recipientPhone: "13800000001",
    })
  })

  it("validates address input before submitting", async () => {
    await expect(
      createAddress(
        {
          ...validInput,
          recipientName: "",
        },
        { dataSource: "mock" }
      )
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("lists local addresses through Connect", async () => {
    const fetchMock = stubJsonResponse({
      shippingAddresses: [
        {
          id: "1001",
          recipientName: "南邮同学",
          recipientPhone: "13800000001",
          province: "江苏省",
          city: "南京市",
          district: "栖霞区",
          detailAddress: "南京邮电大学仙林校区 SAST 活动室",
          isDefault: true,
        },
      ],
    })

    const addresses = await listAddresses({
      dataSource: "local",
      connectBaseUrl: "http://127.0.0.1:6660",
    })

    expect(addresses).toHaveLength(1)
    expect(addresses[0]?.id).toBe("1001")
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.AddressService/GetAddress",
      body: {},
    })
  })

  it("gets one local address through Connect", async () => {
    const fetchMock = stubJsonResponse({
      shippingAddresses: [
        {
          id: "1002",
          recipientName: "值班同学",
          recipientPhone: "13800000002",
          province: "江苏省",
          city: "南京市",
          district: "鼓楼区",
          detailAddress: "南京邮电大学三牌楼校区收发室",
          isDefault: false,
        },
      ],
    })

    const address = await getAddress("1002", {
      dataSource: "local",
      connectBaseUrl: "http://127.0.0.1:6660",
    })

    expect(address.id).toBe("1002")
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.AddressService/GetAddress",
      body: { addressId: "1002" },
    })
  })

  it("creates a local address through Connect", async () => {
    const fetchMock = stubJsonResponse({
      shippingAddresses: {
        id: "1003",
        ...validInput,
      },
    })

    const address = await createAddress(validInput, {
      dataSource: "local",
      connectBaseUrl: "http://127.0.0.1:6660",
    })

    expect(address.id).toBe("1003")
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.AddressService/CreateAddress",
      body: validInput,
    })
  })

  it("updates a local address through Connect", async () => {
    const fetchMock = stubJsonResponse({
      shippingAddresses: {
        id: "1001",
        ...validInput,
        detailAddress: "更新后的地址",
      },
    })

    const address = await updateAddress(
      "1001",
      { ...validInput, detailAddress: "更新后的地址" },
      {
        dataSource: "local",
        connectBaseUrl: "http://127.0.0.1:6660",
      }
    )

    expect(address.detailAddress).toBe("更新后的地址")
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.AddressService/UpdateAddress",
      body: {
        addressId: "1001",
        ...validInput,
        detailAddress: "更新后的地址",
      },
    })
  })

  it("deletes a local address through Connect", async () => {
    const fetchMock = stubJsonResponse({})

    await deleteAddress("1001", {
      dataSource: "local",
      connectBaseUrl: "http://127.0.0.1:6660",
    })

    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.AddressService/DeleteAddress",
      body: { addressId: "1001" },
    })
  })

  it("requires a Connect base URL for local mode", async () => {
    await expect(listAddresses({ dataSource: "local" })).rejects.toBeInstanceOf(
      ApiConfigurationError
    )
  })

  it("wraps local Connect failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 503 }))
    )

    await expect(
      listAddresses({
        dataSource: "local",
        connectBaseUrl: "http://127.0.0.1:6660",
      })
    ).rejects.toBeInstanceOf(ApiRequestError)
  })

  it("throws for remote mode before backend client is wired", async () => {
    await expect(listAddresses({ dataSource: "remote" })).rejects.toBeInstanceOf(
      FeatureUnavailableError
    )
  })
})

function stubJsonResponse(body: unknown) {
  const fetchMock = vi.fn(async () => {
    return new Response(JSON.stringify(body), {
      headers: {
        "content-type": "application/json",
      },
    })
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
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

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm --filter @sast-shop/api test -- addresses.test.ts
```

Expected: FAIL because `./addresses` does not exist.

- [ ] **Step 3: Implement address facade**

Create `packages/api/src/services/addresses.ts`:

```ts
import { createClient } from "@connectrpc/connect"
import {
  createMockAddress,
  deleteMockAddress,
  getMockAddress,
  listMockAddresses,
  updateMockAddress,
  type MockShippingAddress,
  type MockShippingAddressInput,
} from "@sast-shop/mocks"
import type { ShippingAddress as ProtoShippingAddress } from "../gen/sast/sastshopv2/user/v1/address_pb"
import { AddressService } from "../gen/sast/sastshopv2/user/v1/address_service_pb"
import { resolveDataSource, type ServiceOptions } from "../data-source"
import { FeatureUnavailableError, ValidationError } from "../errors"
import { createLocalTransport, requestLocal } from "../local-connect"

export interface ShippingAddress {
  id: string
  recipientName: string
  recipientPhone: string
  province: string
  city: string
  district: string
  detailAddress: string
  isDefault: boolean
}

export type ShippingAddressInput = Omit<ShippingAddress, "id">

export async function listAddresses(
  options: ServiceOptions = {}
): Promise<ShippingAddress[]> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock") {
    return listMockAddresses().map(mapMockAddress)
  }

  if (dataSource === "local") {
    const client = createClient(AddressService, createLocalTransport(options))
    const response = await requestLocal("listAddresses", () =>
      client.getAddress({})
    )

    return response.shippingAddresses.map(mapProtoAddress)
  }

  throw new FeatureUnavailableError("listAddresses")
}

export async function getAddress(
  id: string,
  options: ServiceOptions = {}
): Promise<ShippingAddress> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock") {
    const address = getMockAddress(id)
    if (!address) {
      throw new FeatureUnavailableError("getAddress")
    }
    return mapMockAddress(address)
  }

  if (dataSource === "local") {
    const client = createClient(AddressService, createLocalTransport(options))
    const response = await requestLocal("getAddress", () =>
      client.getAddress({ addressId: BigInt(id) })
    )
    const address = response.shippingAddresses[0]
    if (!address) {
      throw new FeatureUnavailableError("getAddress")
    }
    return mapProtoAddress(address)
  }

  throw new FeatureUnavailableError("getAddress")
}

export async function createAddress(
  input: ShippingAddressInput,
  options: ServiceOptions = {}
): Promise<ShippingAddress> {
  validateAddressInput(input)
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock") {
    return mapMockAddress(createMockAddress(input))
  }

  if (dataSource === "local") {
    const client = createClient(AddressService, createLocalTransport(options))
    const response = await requestLocal("createAddress", () =>
      client.createAddress(input)
    )

    if (!response.shippingAddresses) {
      throw new FeatureUnavailableError("createAddress")
    }

    return mapProtoAddress(response.shippingAddresses)
  }

  throw new FeatureUnavailableError("createAddress")
}

export async function updateAddress(
  id: string,
  input: ShippingAddressInput,
  options: ServiceOptions = {}
): Promise<ShippingAddress> {
  validateAddressInput(input)
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock") {
    return mapMockAddress(updateMockAddress(id, input))
  }

  if (dataSource === "local") {
    const client = createClient(AddressService, createLocalTransport(options))
    const response = await requestLocal("updateAddress", () =>
      client.updateAddress({
        addressId: BigInt(id),
        ...input,
      })
    )

    if (!response.shippingAddresses) {
      throw new FeatureUnavailableError("updateAddress")
    }

    return mapProtoAddress(response.shippingAddresses)
  }

  throw new FeatureUnavailableError("updateAddress")
}

export async function deleteAddress(
  id: string,
  options: ServiceOptions = {}
): Promise<void> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock") {
    deleteMockAddress(id)
    return
  }

  if (dataSource === "local") {
    const client = createClient(AddressService, createLocalTransport(options))
    await requestLocal("deleteAddress", () =>
      client.deleteAddress({ addressId: BigInt(id) })
    )
    return
  }

  throw new FeatureUnavailableError("deleteAddress")
}

function validateAddressInput(input: ShippingAddressInput): void {
  if (!input.recipientName.trim()) {
    throw new ValidationError("收件人不能为空")
  }

  if (!/^1[3-9]\d{9}$/.test(input.recipientPhone)) {
    throw new ValidationError("手机号格式不正确")
  }

  if (
    !input.province.trim() ||
    !input.city.trim() ||
    !input.district.trim() ||
    !input.detailAddress.trim()
  ) {
    throw new ValidationError("地址信息不完整")
  }
}

function mapMockAddress(address: MockShippingAddress): ShippingAddress {
  return { ...address }
}

function mapProtoAddress(address: ProtoShippingAddress): ShippingAddress {
  return {
    id: address.id.toString(),
    recipientName: address.recipientName,
    recipientPhone: address.recipientPhone,
    province: address.province,
    city: address.city,
    district: address.district,
    detailAddress: address.detailAddress,
    isDefault: address.isDefault,
  }
}

const _typecheckMockInput: MockShippingAddressInput = {
  recipientName: "",
  recipientPhone: "",
  province: "",
  city: "",
  district: "",
  detailAddress: "",
  isDefault: false,
}
void _typecheckMockInput
```

- [ ] **Step 4: Export address facade**

Modify `packages/api/src/index.ts`:

```ts
export {
  createAddress,
  deleteAddress,
  getAddress,
  listAddresses,
  updateAddress,
  type ShippingAddress,
  type ShippingAddressInput,
} from "./services/addresses"
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm --filter @sast-shop/api test -- addresses.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/services/addresses.ts packages/api/src/services/addresses.test.ts packages/api/src/index.ts
git commit -m "feat: add address api facade"
```

## Task 4: Payment QR Code API Facade

**Files:**
- Create: `packages/api/src/services/payment-qr-codes.ts`
- Create: `packages/api/src/services/payment-qr-codes.test.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Write QR code facade tests**

Create `packages/api/src/services/payment-qr-codes.test.ts`:

```ts
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import {
  ApiConfigurationError,
  ApiRequestError,
  FeatureUnavailableError,
  ValidationError,
} from "../errors"
import {
  listPaymentQrCodes,
  updatePaymentQrCode,
  type PaymentQrCode,
  type PaymentQrCodeInput,
} from "./payment-qr-codes"

describe("payment QR code service", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("exposes stable QR code return types", () => {
    expectTypeOf(listPaymentQrCodes()).toEqualTypeOf<Promise<PaymentQrCode[]>>()
    expectTypeOf(
      updatePaymentQrCode({ channel: "wechat", content: "https://example.test" })
    ).toEqualTypeOf<Promise<PaymentQrCode>>()
  })

  it("returns mock QR codes in mock mode", async () => {
    const qrCodes = await listPaymentQrCodes({ dataSource: "mock" })
    expect(qrCodes.map((qrCode) => qrCode.channel)).toEqual(["wechat", "alipay"])
  })

  it("validates QR code content", async () => {
    await expect(
      updatePaymentQrCode(
        { channel: "wechat", content: "" },
        { dataSource: "mock" }
      )
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("lists local QR codes through Connect", async () => {
    const fetchMock = stubJsonResponse({
      qrCodes: [
        {
          id: "2001",
          channel: "CHANNEL_WECHAT",
          content: "https://example.test/pay/wechat/sast",
        },
      ],
    })

    const qrCodes = await listPaymentQrCodes({
      dataSource: "local",
      connectBaseUrl: "http://127.0.0.1:6660",
    })

    expect(qrCodes).toEqual([
      {
        id: "2001",
        channel: "wechat",
        content: "https://example.test/pay/wechat/sast",
      },
    ])
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.payment.v1.QrCodeService/GetQrCode",
      body: {},
    })
  })

  it("updates a local QR code through Connect", async () => {
    const input: PaymentQrCodeInput = {
      channel: "alipay",
      content: "https://example.test/pay/alipay/new",
    }
    const fetchMock = stubJsonResponse({
      qrCode: {
        id: "2002",
        channel: "CHANNEL_ALIPAY",
        content: input.content,
      },
    })

    const qrCode = await updatePaymentQrCode(input, {
      dataSource: "local",
      connectBaseUrl: "http://127.0.0.1:6660",
    })

    expect(qrCode).toEqual({
      id: "2002",
      channel: "alipay",
      content: input.content,
    })
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.payment.v1.QrCodeService/UpdateQrCode",
      body: {
        channel: "CHANNEL_ALIPAY",
        content: input.content,
      },
    })
  })

  it("requires a Connect base URL for local mode", async () => {
    await expect(
      listPaymentQrCodes({ dataSource: "local" })
    ).rejects.toBeInstanceOf(ApiConfigurationError)
  })

  it("wraps local Connect failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 503 }))
    )

    await expect(
      listPaymentQrCodes({
        dataSource: "local",
        connectBaseUrl: "http://127.0.0.1:6660",
      })
    ).rejects.toBeInstanceOf(ApiRequestError)
  })

  it("throws for remote mode before backend client is wired", async () => {
    await expect(
      listPaymentQrCodes({ dataSource: "remote" })
    ).rejects.toBeInstanceOf(FeatureUnavailableError)
  })
})

function stubJsonResponse(body: unknown) {
  const fetchMock = vi.fn(async () => {
    return new Response(JSON.stringify(body), {
      headers: {
        "content-type": "application/json",
      },
    })
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
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

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm --filter @sast-shop/api test -- payment-qr-codes.test.ts
```

Expected: FAIL because `./payment-qr-codes` does not exist.

- [ ] **Step 3: Implement QR code facade**

Create `packages/api/src/services/payment-qr-codes.ts`:

```ts
import { createClient } from "@connectrpc/connect"
import {
  listMockPaymentQrCodes,
  updateMockPaymentQrCode,
  type MockPaymentQrChannel,
  type MockPaymentQrCode,
} from "@sast-shop/mocks"
import { Channel } from "../gen/sast/sastshopv2/payment/v1/channel_pb"
import type { QrCode as ProtoQrCode } from "../gen/sast/sastshopv2/payment/v1/qr_code_pb"
import { QrCodeService } from "../gen/sast/sastshopv2/payment/v1/qr_code_service_pb"
import { resolveDataSource, type ServiceOptions } from "../data-source"
import { FeatureUnavailableError, ValidationError } from "../errors"
import { createLocalTransport, requestLocal } from "../local-connect"

export type PaymentQrChannel = "wechat" | "alipay"

export interface PaymentQrCode {
  id: string
  channel: PaymentQrChannel
  content: string
}

export interface PaymentQrCodeInput {
  channel: PaymentQrChannel
  content: string
}

export async function listPaymentQrCodes(
  options: ServiceOptions = {}
): Promise<PaymentQrCode[]> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock") {
    return listMockPaymentQrCodes().map(mapMockQrCode)
  }

  if (dataSource === "local") {
    const client = createClient(QrCodeService, createLocalTransport(options))
    const response = await requestLocal("listPaymentQrCodes", () =>
      client.getQrCode({})
    )

    return response.qrCodes.map(mapProtoQrCode)
  }

  throw new FeatureUnavailableError("listPaymentQrCodes")
}

export async function updatePaymentQrCode(
  input: PaymentQrCodeInput,
  options: ServiceOptions = {}
): Promise<PaymentQrCode> {
  validatePaymentQrCodeInput(input)
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock") {
    return mapMockQrCode(updateMockPaymentQrCode(input))
  }

  if (dataSource === "local") {
    const client = createClient(QrCodeService, createLocalTransport(options))
    const response = await requestLocal("updatePaymentQrCode", () =>
      client.updateQrCode({
        channel: mapPaymentQrChannelToProto(input.channel),
        content: input.content,
      })
    )

    if (!response.qrCode) {
      throw new FeatureUnavailableError("updatePaymentQrCode")
    }

    return mapProtoQrCode(response.qrCode)
  }

  throw new FeatureUnavailableError("updatePaymentQrCode")
}

function validatePaymentQrCodeInput(input: PaymentQrCodeInput): void {
  if (!input.content.trim()) {
    throw new ValidationError("收款码内容不能为空")
  }
}

function mapMockQrCode(qrCode: MockPaymentQrCode): PaymentQrCode {
  return {
    id: qrCode.id,
    channel: qrCode.channel,
    content: qrCode.content,
  }
}

function mapProtoQrCode(qrCode: ProtoQrCode): PaymentQrCode {
  return {
    id: qrCode.id.toString(),
    channel: mapPaymentQrChannelFromProto(qrCode.channel),
    content: qrCode.content,
  }
}

function mapPaymentQrChannelToProto(channel: PaymentQrChannel): Channel {
  if (channel === "wechat") {
    return Channel.WECHAT
  }

  return Channel.ALIPAY
}

function mapPaymentQrChannelFromProto(channel: Channel): PaymentQrChannel {
  if (channel === Channel.WECHAT) {
    return "wechat"
  }

  if (channel === Channel.ALIPAY) {
    return "alipay"
  }

  throw new FeatureUnavailableError("paymentQrChannel")
}

const _typecheckMockChannel: MockPaymentQrChannel = "wechat"
void _typecheckMockChannel
```

- [ ] **Step 4: Export QR code facade**

Modify `packages/api/src/index.ts`:

```ts
export {
  listPaymentQrCodes,
  updatePaymentQrCode,
  type PaymentQrChannel,
  type PaymentQrCode,
  type PaymentQrCodeInput,
} from "./services/payment-qr-codes"
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm --filter @sast-shop/api test -- payment-qr-codes.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/services/payment-qr-codes.ts packages/api/src/services/payment-qr-codes.test.ts packages/api/src/index.ts
git commit -m "feat: add payment qr code api facade"
```

## Task 5: Profile Overview Composition

**Files:**
- Create: `packages/api/src/services/profile.ts`
- Create: `packages/api/src/services/profile.test.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Write profile overview test**

Create `packages/api/src/services/profile.test.ts`:

```ts
import { describe, expect, expectTypeOf, it } from "vitest"
import type { CurrentUser } from "./auth"
import type { PaymentQrCode } from "./payment-qr-codes"
import type { ShippingAddress } from "./addresses"
import { getProfileOverview, type ProfileOverview } from "./profile"

describe("profile service", () => {
  it("exposes a stable profile overview type", () => {
    expectTypeOf(getProfileOverview()).toEqualTypeOf<Promise<ProfileOverview>>()
    expectTypeOf<ProfileOverview>().toEqualTypeOf<{
      user: CurrentUser
      addresses: ShippingAddress[]
      defaultAddress: ShippingAddress | null
      paymentQrCodes: PaymentQrCode[]
    }>()
  })

  it("combines user, default address, and payment QR codes", async () => {
    const overview = await getProfileOverview({ dataSource: "mock" })

    expect(overview.user.name).toBe("南邮同学")
    expect(overview.defaultAddress?.id).toBe("1001")
    expect(overview.addresses).toHaveLength(2)
    expect(overview.paymentQrCodes.map((qrCode) => qrCode.channel)).toEqual([
      "wechat",
      "alipay",
    ])
  })
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm --filter @sast-shop/api test -- profile.test.ts
```

Expected: FAIL because `./profile` does not exist.

- [ ] **Step 3: Implement profile overview**

Create `packages/api/src/services/profile.ts`:

```ts
import type { ServiceOptions } from "../data-source"
import { getCurrentUser, type CurrentUser } from "./auth"
import { listAddresses, type ShippingAddress } from "./addresses"
import {
  listPaymentQrCodes,
  type PaymentQrCode,
} from "./payment-qr-codes"

export interface ProfileOverview {
  user: CurrentUser
  addresses: ShippingAddress[]
  defaultAddress: ShippingAddress | null
  paymentQrCodes: PaymentQrCode[]
}

export async function getProfileOverview(
  options: ServiceOptions = {}
): Promise<ProfileOverview> {
  const [user, addresses, paymentQrCodes] = await Promise.all([
    getCurrentUser(options),
    listAddresses(options),
    listPaymentQrCodes(options),
  ])

  return {
    user,
    addresses,
    defaultAddress: addresses.find((address) => address.isDefault) ?? null,
    paymentQrCodes,
  }
}
```

- [ ] **Step 4: Export profile facade**

Modify `packages/api/src/index.ts`:

```ts
export {
  getProfileOverview,
  type ProfileOverview,
} from "./services/profile"
```

- [ ] **Step 5: Run focused API tests**

Run:

```bash
pnpm --filter @sast-shop/api test -- profile.test.ts addresses.test.ts payment-qr-codes.test.ts auth.test.ts errors.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/services/profile.ts packages/api/src/services/profile.test.ts packages/api/src/index.ts
git commit -m "feat: add profile overview facade"
```

## Task 6: Fauxrpc Stubs

**Files:**
- Create: `mock/fauxrpc/stubs/address.yaml`
- Create: `mock/fauxrpc/stubs/payment-qr-code.yaml`
- Modify: `mock/fauxrpc/README.md`

- [ ] **Step 1: Add address stubs**

Create `mock/fauxrpc/stubs/address.yaml`:

```yaml
stubs:
  - id: address-get-address
    target: sast.sastshopv2.user.v1.AddressService/GetAddress
    content:
      shippingAddresses:
        - id: "1001"
          recipientName: 南邮同学
          recipientPhone: "13800000001"
          province: 江苏省
          city: 南京市
          district: 栖霞区
          detailAddress: 南京邮电大学仙林校区 SAST 活动室
          isDefault: true
        - id: "1002"
          recipientName: 值班同学
          recipientPhone: "13800000002"
          province: 江苏省
          city: 南京市
          district: 鼓楼区
          detailAddress: 南京邮电大学三牌楼校区收发室
          isDefault: false
  - id: address-create-address
    target: sast.sastshopv2.user.v1.AddressService/CreateAddress
    content:
      shippingAddresses:
        id: "1003"
        recipientName: 南邮同学
        recipientPhone: "13800000001"
        province: 江苏省
        city: 南京市
        district: 栖霞区
        detailAddress: 南京邮电大学仙林校区 SAST 活动室
        isDefault: true
  - id: address-update-address
    target: sast.sastshopv2.user.v1.AddressService/UpdateAddress
    content:
      shippingAddresses:
        id: "1001"
        recipientName: 南邮同学
        recipientPhone: "13800000001"
        province: 江苏省
        city: 南京市
        district: 栖霞区
        detailAddress: 南京邮电大学仙林校区 SAST 活动室
        isDefault: true
  - id: address-delete-address
    target: sast.sastshopv2.user.v1.AddressService/DeleteAddress
    content: {}
```

- [ ] **Step 2: Add QR code stubs**

Create `mock/fauxrpc/stubs/payment-qr-code.yaml`:

```yaml
stubs:
  - id: qr-code-get-qr-code
    target: sast.sastshopv2.payment.v1.QrCodeService/GetQrCode
    content:
      qrCodes:
        - id: "2001"
          channel: CHANNEL_WECHAT
          content: https://example.test/pay/wechat/sast
        - id: "2002"
          channel: CHANNEL_ALIPAY
          content: https://example.test/pay/alipay/sast
  - id: qr-code-update-qr-code
    target: sast.sastshopv2.payment.v1.QrCodeService/UpdateQrCode
    content:
      qrCode:
        id: "2001"
        channel: CHANNEL_WECHAT
        content: https://example.test/pay/wechat/sast
```

- [ ] **Step 3: Update fauxrpc docs**

Modify `mock/fauxrpc/README.md` API wiring paragraph to say:

```md
当前应用默认仍使用包内 mock 数据。将 `NEXT_PUBLIC_DATA_SOURCE` 设为 `local` 后，Auth/User、Address 和 Payment QR Code runtime API 会通过 `@connectrpc/connect` 的 `createClient` 和 `@connectrpc/connect-web` 的 `createConnectTransport({ baseUrl })` 访问本地 fauxrpc。
```

- [ ] **Step 4: Validate schema generation still works**

Run:

```bash
pnpm mock:schema
```

Expected: command exits 0 and writes `.mock/fauxrpc/sast-shop-v2.binpb`.

- [ ] **Step 5: Commit**

```bash
git add mock/fauxrpc/stubs/address.yaml mock/fauxrpc/stubs/payment-qr-code.yaml mock/fauxrpc/README.md
git commit -m "feat: add profile fauxrpc stubs"
```

## Task 7: Mobile Profile Overview And Global Drawers

**Files:**
- Create: `apps/mobile/app/profile/page.tsx`
- Create: `apps/mobile/components/profile-management.tsx`
- Create: `apps/mobile/components/profile-management-client.tsx`
- Modify: `apps/mobile/components/mobile-shell.tsx`

- [ ] **Step 1: Create mobile server data wrapper for global profile management**

Create `apps/mobile/components/profile-management.tsx`:

```tsx
import { getProfileOverview, type ProfileOverview } from "@sast-shop/api"
import { mobileAppConfig } from "@/lib/app-config"
import { ProfileManagementClient } from "./profile-management-client"

async function loadProfileOverview(): Promise<{
  overview: ProfileOverview | null
  error: string | null
}> {
  try {
    return {
      overview: await getProfileOverview({
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
      }),
      error: null,
    }
  } catch (error) {
    return {
      overview: null,
      error:
        error instanceof Error
          ? error.message
          : "资料管理暂不可用，请稍后再试",
    }
  }
}

export async function ProfileManagement() {
  const result = await loadProfileOverview()

  return (
    <ProfileManagementClient
      dataSource={mobileAppConfig.dataSource}
      overview={result.overview}
      error={result.error}
    />
  )
}
```

- [ ] **Step 2: Create mobile client drawers**

Create `apps/mobile/components/profile-management-client.tsx`:

```tsx
"use client"

import { useState } from "react"
import type { ProfileOverview } from "@sast-shop/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

type ActivePanel = "addresses" | "qr-codes" | null

export function ProfileManagementClient({
  dataSource,
  overview,
  error,
}: {
  dataSource: string
  overview: ProfileOverview | null
  error: string | null
}) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)

  return (
    <>
      <div className="grid grid-cols-2 gap-2 px-4 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={() => setActivePanel("addresses")}
        >
          地址簿
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={() => setActivePanel("qr-codes")}
        >
          收款码
        </Button>
      </div>

      {activePanel ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <section className="max-h-[82dvh] w-full overflow-y-auto rounded-t-lg bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-semibold leading-6">
                  {activePanel === "addresses" ? "地址簿" : "快捷收款码"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {error ?? `数据源：${dataSource}`}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActivePanel(null)}
              >
                关闭
              </Button>
            </div>

            {error ? (
              <p className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
                {error}
              </p>
            ) : null}

            {!error && activePanel === "addresses" ? (
              <div className="grid gap-3">
                {overview?.addresses.map((address) => (
                  <article
                    key={address.id}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{address.recipientName}</p>
                      {address.isDefault ? <Badge>默认</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {address.recipientPhone}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {address.province}
                      {address.city}
                      {address.district}
                      {address.detailAddress}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button type="button" variant="outline" size="sm">
                        编辑
                      </Button>
                      <Button type="button" variant="destructive" size="sm">
                        删除
                      </Button>
                    </div>
                  </article>
                ))}
                <Button type="button" size="lg" className="min-h-11">
                  新增地址
                </Button>
              </div>
            ) : null}

            {!error && activePanel === "qr-codes" ? (
              <div className="grid gap-3">
                {overview?.paymentQrCodes.map((qrCode) => (
                  <article
                    key={qrCode.id}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">
                        {qrCode.channel === "wechat" ? "微信支付" : "支付宝"}
                      </p>
                      <Badge variant="outline">只能修改</Badge>
                    </div>
                    <p className="mt-2 break-all text-sm leading-6 text-muted-foreground">
                      {qrCode.content}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                    >
                      修改
                    </Button>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  )
}
```

- [ ] **Step 3: Mount mobile global management in the shell**

Modify `apps/mobile/components/mobile-shell.tsx`:

```tsx
import type { ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"
import { ProfileManagement } from "./profile-management"
```

Place `<ProfileManagement />` between the `main` element and fixed bottom `nav`, so the controls are available on every mobile page:

```tsx
      <main className="mx-auto w-full max-w-md px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4">
        {children}
      </main>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mx-auto w-full max-w-md">
        <ProfileManagement />
      </div>
```

- [ ] **Step 4: Create mobile profile overview page**

Create `apps/mobile/app/profile/page.tsx`:

```tsx
import { getProfileOverview } from "@sast-shop/api"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { mobileAppConfig } from "@/lib/app-config"

async function loadProfileOverview() {
  try {
    return {
      overview: await getProfileOverview({
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
      }),
      error: null,
    }
  } catch (error) {
    return {
      overview: null,
      error:
        error instanceof Error
          ? error.message
          : "个人资料暂不可用，请稍后再试",
    }
  }
}

export default async function ProfilePage() {
  const result = await loadProfileOverview()
  const overview = result.overview

  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-start justify-between gap-3 py-2">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">我的</p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight">
            个人资料
          </h1>
        </div>
        <Badge variant="muted" className="shrink-0">
          {mobileAppConfig.dataSource}
        </Badge>
      </section>

      {result.error ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg leading-6">资料暂不可用</CardTitle>
            <CardDescription>{result.error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {overview ? (
        <>
          <Card className="rounded-lg">
            <CardHeader>
              <CardDescription>当前用户</CardDescription>
              <CardTitle className="text-xl leading-7">
                {overview.user.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="break-all text-sm text-muted-foreground">
                用户 ID：{overview.user.id}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="text-lg leading-6">默认地址</CardTitle>
              <CardDescription>
                {overview.defaultAddress
                  ? `${overview.defaultAddress.recipientName} ${overview.defaultAddress.recipientPhone}`
                  : "还没有默认地址"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm leading-6 text-muted-foreground">
                {overview.defaultAddress
                  ? `${overview.defaultAddress.province}${overview.defaultAddress.city}${overview.defaultAddress.district}${overview.defaultAddress.detailAddress}`
                  : "添加常用地址后，下单时会更顺手。"}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="text-lg leading-6">收款码</CardTitle>
              <CardDescription>
                已配置 {overview.paymentQrCodes.length} 个渠道
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                使用底部全局入口管理地址簿和快捷收款码。
              </p>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 5: Run mobile checks**

Run:

```bash
pnpm --filter @sast-shop/mobile typecheck
pnpm --filter @sast-shop/mobile lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/profile/page.tsx apps/mobile/components/profile-management.tsx apps/mobile/components/profile-management-client.tsx apps/mobile/components/mobile-shell.tsx
git commit -m "feat: add mobile profile management"
```

## Task 8: Desktop Profile Overview And Global Dialogs

**Files:**
- Create: `apps/desktop/app/profile/page.tsx`
- Create: `apps/desktop/components/profile-management.tsx`
- Create: `apps/desktop/components/profile-management-client.tsx`
- Modify: `apps/desktop/components/desktop-shell.tsx`

- [ ] **Step 1: Create desktop server data wrapper for global profile management**

Create `apps/desktop/components/profile-management.tsx`:

```tsx
import { getProfileOverview, type ProfileOverview } from "@sast-shop/api"
import { desktopAppConfig } from "@/lib/app-config"
import { ProfileManagementClient } from "./profile-management-client"

async function loadProfileOverview(): Promise<{
  overview: ProfileOverview | null
  error: string | null
}> {
  try {
    return {
      overview: await getProfileOverview({
        dataSource: desktopAppConfig.dataSource,
        connectBaseUrl: desktopAppConfig.connectBaseUrl,
      }),
      error: null,
    }
  } catch (error) {
    return {
      overview: null,
      error:
        error instanceof Error
          ? error.message
          : "资料管理暂不可用，请稍后再试",
    }
  }
}

export async function ProfileManagement() {
  const result = await loadProfileOverview()

  return (
    <ProfileManagementClient
      dataSource={desktopAppConfig.dataSource}
      overview={result.overview}
      error={result.error}
    />
  )
}
```

- [ ] **Step 2: Create desktop client dialogs**

Create `apps/desktop/components/profile-management-client.tsx`:

```tsx
"use client"

import { useState } from "react"
import type { ProfileOverview } from "@sast-shop/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

type ActiveDialog = "addresses" | "qr-codes" | null

export function ProfileManagementClient({
  dataSource,
  overview,
  error,
}: {
  dataSource: string
  overview: ProfileOverview | null
  error: string | null
}) {
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null)

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setActiveDialog("addresses")}
        >
          地址簿
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setActiveDialog("qr-codes")}
        >
          收款码
        </Button>
      </div>

      {activeDialog ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-8">
          <section className="max-h-[78dvh] w-full max-w-3xl overflow-y-auto rounded-lg bg-background p-6 shadow-lg">
            <div className="mb-5 flex items-start justify-between gap-6">
              <div className="min-w-0">
                <p className="text-xl font-semibold leading-7">
                  {activeDialog === "addresses" ? "地址簿" : "快捷收款码"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {error ?? `数据源：${dataSource}`}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActiveDialog(null)}
              >
                关闭
              </Button>
            </div>

            {error ? (
              <p className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
                {error}
              </p>
            ) : null}

            {!error && activeDialog === "addresses" ? (
              <div className="grid gap-2">
                {overview?.addresses.map((address) => (
                  <div
                    key={address.id}
                    className="grid min-h-14 grid-cols-[7rem_8rem_minmax(0,1fr)_5rem_9rem] items-center gap-4 rounded-lg border border-border px-4"
                  >
                    <p className="truncate font-medium">{address.recipientName}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {address.recipientPhone}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {address.province}
                      {address.city}
                      {address.district}
                      {address.detailAddress}
                    </p>
                    {address.isDefault ? <Badge>默认</Badge> : <span />}
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm">
                        编辑
                      </Button>
                      <Button type="button" variant="destructive" size="sm">
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {!error && activeDialog === "qr-codes" ? (
              <div className="grid gap-2">
                {overview?.paymentQrCodes.map((qrCode) => (
                  <div
                    key={qrCode.id}
                    className="grid min-h-14 grid-cols-[8rem_minmax(0,1fr)_6rem] items-center gap-4 rounded-lg border border-border px-4"
                  >
                    <p className="font-medium">
                      {qrCode.channel === "wechat" ? "微信支付" : "支付宝"}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {qrCode.content}
                    </p>
                    <Button type="button" variant="outline" size="sm">
                      修改
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  )
}
```

- [ ] **Step 3: Mount desktop global management in the shell**

Modify `apps/desktop/components/desktop-shell.tsx`:

```tsx
import type { ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"
import { ProfileManagement } from "./profile-management"
```

Place `<ProfileManagement />` in the sticky header action area before the existing message button:

```tsx
              <div className="flex shrink-0 items-center gap-2">
                <ProfileManagement />
                <Button type="button" variant="ghost" size="sm">
                  消息
                </Button>
                <Button type="button" size="sm">
                  新建发布
                </Button>
              </div>
```

- [ ] **Step 4: Create desktop profile overview page**

Create `apps/desktop/app/profile/page.tsx`:

```tsx
import { getProfileOverview } from "@sast-shop/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { desktopAppConfig } from "@/lib/app-config"

async function loadProfileOverview() {
  try {
    return {
      overview: await getProfileOverview({
        dataSource: desktopAppConfig.dataSource,
        connectBaseUrl: desktopAppConfig.connectBaseUrl,
      }),
      error: null,
    }
  } catch (error) {
    return {
      overview: null,
      error:
        error instanceof Error
          ? error.message
          : "个人资料暂不可用，请稍后再试",
    }
  }
}

export default async function ProfilePage() {
  const result = await loadProfileOverview()
  const overview = result.overview

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">{desktopAppConfig.dataSource}</Badge>
            <Badge variant="outline">资料管理</Badge>
          </div>
          <h1 className="mt-3 text-3xl font-semibold leading-tight">
            个人资料
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            管理地址簿与收款码，为后续订单支付和确认收款做准备。
          </p>
        </div>
      </section>

      {result.error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl leading-7">资料暂不可用</CardTitle>
            <CardDescription>{result.error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {overview ? (
        <section className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-4">
          <Card>
            <CardHeader>
              <CardDescription>当前用户</CardDescription>
              <CardTitle className="text-2xl leading-8">
                {overview.user.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="break-all text-sm text-muted-foreground">
                用户 ID：{overview.user.id}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl leading-7">收款码</CardTitle>
              <CardDescription>微信与支付宝收款信息</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {overview.paymentQrCodes.map((qrCode) => (
                <div
                  key={qrCode.id}
                  className="grid min-h-14 grid-cols-[8rem_minmax(0,1fr)_6rem] items-center gap-4 rounded-lg border border-border px-4"
                >
                  <p className="font-medium">
                    {qrCode.channel === "wechat" ? "微信支付" : "支付宝"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {qrCode.content}
                  </p>
                  <Button type="button" variant="outline" size="sm">
                    编辑
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="col-span-2">
            <CardHeader>
              <CardTitle className="text-xl leading-7">地址簿</CardTitle>
              <CardDescription>常用收货地址与默认地址</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {overview.addresses.map((address) => (
                <div
                  key={address.id}
                  className="grid min-h-16 grid-cols-[8rem_8rem_minmax(0,1fr)_5rem] items-center gap-4 rounded-lg border border-border px-4"
                >
                  <p className="truncate font-medium">{address.recipientName}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {address.recipientPhone}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {address.province}
                    {address.city}
                    {address.district}
                    {address.detailAddress}
                  </p>
                  {address.isDefault ? <Badge>默认</Badge> : <span />}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 5: Run desktop checks**

Run:

```bash
pnpm --filter @sast-shop/desktop typecheck
pnpm --filter @sast-shop/desktop lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/app/profile/page.tsx apps/desktop/components/profile-management.tsx apps/desktop/components/profile-management-client.tsx apps/desktop/components/desktop-shell.tsx
git commit -m "feat: add desktop profile management"
```

## Task 9: Full Verification

**Files:**
- No planned file changes.

- [ ] **Step 1: Run full non-build checks**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: all commands exit 0.

- [ ] **Step 2: Run build**

Run:

```bash
pnpm build
```

Expected: exits 0. If Turbopack fails inside the sandbox with a port permission error, rerun the same command in approval mode.

- [ ] **Step 3: Run proto drift check**

Run:

```bash
pnpm proto:generate
git status --short buf.gen.yaml packages/api/src/gen
```

Expected: no output from the `git status --short buf.gen.yaml packages/api/src/gen` command.

- [ ] **Step 4: Manual local-mode smoke check**

Run fauxrpc in one terminal:

```bash
pnpm mock:fauxrpc
```

Run mobile and desktop in separate terminals with `.env.local` configured for local mode:

```bash
pnpm dev:mobile
pnpm dev:desktop
```

Open:

```text
http://localhost:3001/profile
http://localhost:3002/profile
```

Expected: both pages show current user, address data, and QR code data from fauxrpc stubs. The mobile shell can open address and QR code drawers from any page; the desktop shell can open address and QR code dialogs from any page.

- [ ] **Step 5: Final commit if verification caused doc-only updates**

If verification required small docs-only corrections, commit them:

```bash
git add docs mock/fauxrpc/README.md
git commit -m "docs: clarify profile verification"
```

If verification did not modify files, skip this commit.

## Self-Review Checklist

- Spec coverage: API facade, mock/local/remote flow, PRD global address/QR entry behavior, mobile scope, desktop scope, error handling, tests, and acceptance are covered by Tasks 1-9.
- Placeholder scan: checked for unresolved placeholders and vague implementation instructions.
- Type consistency: `ShippingAddress`, `ShippingAddressInput`, `PaymentQrCode`, `PaymentQrCodeInput`, `PaymentQrChannel`, and `ProfileOverview` are introduced before page tasks use them.
