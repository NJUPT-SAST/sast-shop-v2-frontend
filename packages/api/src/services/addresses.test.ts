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

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
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
    expectTypeOf<ShippingAddress>().toEqualTypeOf<{
      id: string
      recipientName: string
      recipientPhone: string
      province: string
      city: string
      district: string
      detailAddress: string
      isDefault: boolean
    }>()
  })

  it("returns mock addresses in mock mode", async () => {
    const addresses = await listAddresses({ dataSource: "mock" })

    expect(addresses[0]).toMatchObject({
      id: "1001",
      recipientName: "南邮同学",
      isDefault: true,
    })
  })

  it("returns a mock address by id in mock mode", async () => {
    const address = await getAddress("1001", { dataSource: "mock" })

    expect(address).toMatchObject({
      id: "1001",
      recipientPhone: "13800000001",
    })
  })

  it("validates address input before submitting create requests", async () => {
    await expect(
      createAddress({ ...validInput, recipientName: "" }, localOptions)
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("lists addresses from the local Connect backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        shippingAddresses: [
          {
            id: "1001",
            ...validInput,
          },
        ],
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const addresses = await listAddresses(localOptions)

    expect(addresses).toEqual([
      {
        id: "1001",
        ...validInput,
      },
    ])
    expect(fetchMock).toHaveBeenCalledOnce()
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.AddressService/GetAddress",
      body: {},
    })
  })

  it("gets an address from the local Connect backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        shippingAddresses: [
          {
            id: "1002",
            ...validInput,
            recipientPhone: "13800000002",
          },
        ],
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const address = await getAddress("1002", localOptions)

    expect(address).toMatchObject({
      id: "1002",
      recipientPhone: "13800000002",
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.AddressService/GetAddress",
      body: { addressId: "1002" },
    })
  })

  it("creates an address through the local Connect backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        shippingAddresses: {
          id: "1003",
          ...validInput,
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const address = await createAddress(validInput, localOptions)

    expect(address).toEqual({
      id: "1003",
      ...validInput,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.AddressService/CreateAddress",
      body: validInput,
    })
  })

  it("updates an address through the local Connect backend", async () => {
    const changedInput = {
      ...validInput,
      detailAddress: "更新后的地址",
    }
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        shippingAddresses: {
          id: "1001",
          ...changedInput,
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const address = await updateAddress("1001", changedInput, localOptions)

    expect(address).toEqual({
      id: "1001",
      ...changedInput,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.AddressService/UpdateAddress",
      body: { addressId: "1001", ...changedInput },
    })
  })

  it("deletes an address through the local Connect backend", async () => {
    const fetchMock = vi.fn(async () => stubJsonResponse({}))
    vi.stubGlobal("fetch", fetchMock)

    await expect(deleteAddress("1001", localOptions)).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledOnce()
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.AddressService/DeleteAddress",
      body: { addressId: "1001" },
    })
  })

  it("requires a configured Connect base URL for local mode", async () => {
    await expect(listAddresses({ dataSource: "local" })).rejects.toBeInstanceOf(
      ApiConfigurationError
    )
  })

  it("wraps local Connect failures in an API request error", async () => {
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

    await expect(listAddresses(localOptions)).rejects.toBeInstanceOf(
      ApiRequestError
    )
  })

  it("throws for remote mode before backend client is wired", async () => {
    await expect(listAddresses({ dataSource: "remote" })).rejects.toBeInstanceOf(
      FeatureUnavailableError
    )
    await expect(getAddress("1001", { dataSource: "remote" })).rejects.toBeInstanceOf(
      FeatureUnavailableError
    )
    await expect(
      createAddress(validInput, { dataSource: "remote" })
    ).rejects.toBeInstanceOf(FeatureUnavailableError)
    await expect(
      updateAddress("1001", validInput, { dataSource: "remote" })
    ).rejects.toBeInstanceOf(FeatureUnavailableError)
    await expect(
      deleteAddress("1001", { dataSource: "remote" })
    ).rejects.toBeInstanceOf(FeatureUnavailableError)
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
