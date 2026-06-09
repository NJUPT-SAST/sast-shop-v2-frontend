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

const validInput: PaymentQrCodeInput = {
  channel: "alipay",
  content: "https://qr.alipay.com/sast-shop-new",
}

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
}

describe("payment QR code service", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("exposes stable payment QR code return types", () => {
    expectTypeOf(listPaymentQrCodes()).toEqualTypeOf<Promise<PaymentQrCode[]>>()
    expectTypeOf(updatePaymentQrCode(validInput)).toEqualTypeOf<
      Promise<PaymentQrCode>
    >()
    expectTypeOf<PaymentQrCode>().toEqualTypeOf<{
      id: string
      channel: "wechat" | "alipay"
      content: string
    }>()
  })

  it("returns mock payment QR channels in mock mode", async () => {
    const qrCodes = await listPaymentQrCodes({ dataSource: "mock" })

    expect(qrCodes.map((qrCode) => qrCode.channel)).toEqual(["wechat", "alipay"])
  })

  it("validates payment QR code input before submitting update requests", async () => {
    await expect(
      updatePaymentQrCode({ ...validInput, content: " " }, localOptions)
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("rejects payment QR image data URLs before submitting update requests", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      updatePaymentQrCode(
        {
          channel: "alipay",
          content: "data:image/png;base64,iVBORw0KGgo=",
        },
        localOptions
      )
    ).rejects.toThrow("收款码内容不支持，请上传对应渠道的收款码文本")

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects payment QR content that belongs to another channel", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      updatePaymentQrCode(
        {
          channel: "wechat",
          content: "https://qr.alipay.com/sast-shop",
        },
        localOptions
      )
    ).rejects.toThrow("收款码内容与渠道不匹配")

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects invalid runtime payment QR channels before submitting update requests", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const invalidInput: PaymentQrCodeInput = {
      channel: "bank" as PaymentQrCodeInput["channel"],
      content: "https://example.test/pay/bank",
    }

    await expect(updatePaymentQrCode(invalidInput, localOptions)).rejects.toThrow(
      "收款码渠道不正确"
    )
    await expect(
      updatePaymentQrCode(invalidInput, { dataSource: "mock" })
    ).rejects.toBeInstanceOf(ValidationError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("lists payment QR codes from the local Connect backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        qrCodes: [
          {
            id: "2001",
            channel: "CHANNEL_WECHAT",
            content: "https://example.test/pay/wechat/sast",
          },
        ],
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const qrCodes = await listPaymentQrCodes(localOptions)

    expect(qrCodes).toEqual([
      {
        id: "2001",
        channel: "wechat",
        content: "https://example.test/pay/wechat/sast",
      },
    ])
    expect(fetchMock).toHaveBeenCalledOnce()
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.payment.v1.QrCodeService/GetQrCode",
      body: {},
    })
  })

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
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const qrCodes = await listPaymentQrCodes({
      ...localOptions,
      ownerId: "42",
    })

    expect(qrCodes[0]?.content).toBe("https://example.test/pay/wechat/seller")
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.payment.v1.QrCodeService/GetQrCode",
      body: {
        ownerId: "42",
      },
    })
  })

  it("validates owner id before listing another user's payment QR codes", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      listPaymentQrCodes({
        ...localOptions,
        ownerId: "",
      })
    ).rejects.toThrow("收款码用户 ID 不正确")
    await expect(
      listPaymentQrCodes({
        ...localOptions,
        ownerId: "",
      })
    ).rejects.toBeInstanceOf(ValidationError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("updates a normalized payment QR code through the local Connect backend", async () => {
    const input: PaymentQrCodeInput = {
      channel: "alipay",
      content: "  https://qr.alipay.com/sast-shop  ",
    }
    const normalizedContent = "https://qr.alipay.com/sast-shop"
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        qrCode: {
          id: "2002",
          channel: "CHANNEL_ALIPAY",
          content: normalizedContent,
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const qrCode = await updatePaymentQrCode(input, localOptions)

    expect(qrCode).toEqual({
      id: "2002",
      channel: "alipay",
      content: normalizedContent,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.payment.v1.QrCodeService/UpdateQrCode",
      body: {
        channel: "CHANNEL_ALIPAY",
        content: normalizedContent,
      },
    })
  })

  it("updates normalized payment QR content in mock mode", async () => {
    const qrCode = await updatePaymentQrCode(
      {
        channel: "wechat",
        content: "  wxp://sast-shop  ",
      },
      { dataSource: "mock" }
    )

    expect(qrCode.content).toBe("wxp://sast-shop")
  })

  it("requires a configured Connect base URL for local mode", async () => {
    await expect(
      listPaymentQrCodes({ dataSource: "local" })
    ).rejects.toBeInstanceOf(ApiConfigurationError)
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

    await expect(listPaymentQrCodes(localOptions)).rejects.toBeInstanceOf(
      ApiRequestError
    )
  })

  it("throws for remote mode before backend client is wired", async () => {
    await expect(
      listPaymentQrCodes({ dataSource: "remote" })
    ).rejects.toBeInstanceOf(FeatureUnavailableError)
    await expect(
      updatePaymentQrCode(validInput, { dataSource: "remote" })
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
