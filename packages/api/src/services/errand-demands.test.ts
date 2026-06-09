import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import {
  ApiConfigurationError,
  ApiRequestError,
  FeatureUnavailableError,
  ValidationError,
} from "../errors"
import {
  createErrandDemand,
  type CreateErrandDemandInput,
  type CreateErrandDemandResult,
} from "./errand-demands"

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
}

const validInput: CreateErrandDemandInput = {
  storeId: "3001",
  deadline: "2026-06-09T14:00:00.000Z",
  items: [
    {
      productTemplateId: "1001",
      quantity: 2,
      serviceFeePerUnitCents: 300,
      updatedAt: "2026-06-09T13:00:00.000Z",
    },
    {
      productTemplateId: "1002",
      quantity: 1,
      serviceFeePerUnitCents: 100,
      updatedAt: null,
    },
  ],
}

describe("errand demand service", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("exposes a stable create errand demand return type", () => {
    expectTypeOf<ReturnType<typeof createErrandDemand>>().toEqualTypeOf<
      Promise<CreateErrandDemandResult>
    >()
  })

  it("creates errand demands through the local Connect backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        errandDemandId: "9001",
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await createErrandDemand(validInput, localOptions)

    expect(result).toEqual({ errandDemandId: "9001" })
    expect(fetchMock).toHaveBeenCalledOnce()
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.ErrandDemandService/CreateErrandDemand",
      body: {
        storeId: "3001",
        deadline: "2026-06-09T14:00:00Z",
        demandItems: [
          {
            productTemplateId: "1001",
            quantity: 2,
            serviceFeePerUnitCents: 300,
            updatedAt: "2026-06-09T13:00:00Z",
          },
          {
            productTemplateId: "1002",
            quantity: 1,
            serviceFeePerUnitCents: 100,
          },
        ],
      },
    })
  })

  it("validates create errand demand input before submitting requests", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      createErrandDemand({ ...validInput, storeId: "0" }, localOptions)
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      createErrandDemand(
        { ...validInput, storeId: "9223372036854775808" },
        localOptions
      )
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      createErrandDemand({ ...validInput, deadline: "not-a-date" }, localOptions)
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      createErrandDemand({ ...validInput, items: [] }, localOptions)
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      createErrandDemand(
        {
          ...validInput,
          items: [{ ...validInput.items[0], quantity: 0 }],
        },
        localOptions
      )
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      createErrandDemand(
        {
          ...validInput,
          items: [
            {
              ...validInput.items[0],
              productTemplateId: "9223372036854775808",
            },
          ],
        },
        localOptions
      )
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      createErrandDemand(
        {
          ...validInput,
          items: [{ ...validInput.items[0], serviceFeePerUnitCents: -1 }],
        },
        localOptions
      )
    ).rejects.toBeInstanceOf(ValidationError)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("requires a configured Connect base URL for local create mode", async () => {
    await expect(
      createErrandDemand(validInput, { dataSource: "local" })
    ).rejects.toBeInstanceOf(ApiConfigurationError)
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

    await expect(createErrandDemand(validInput, localOptions)).rejects.toBeInstanceOf(
      ApiRequestError
    )
  })

  it("throws for remote create mode before backend client is wired", async () => {
    await expect(
      createErrandDemand(validInput, { dataSource: "remote" })
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
