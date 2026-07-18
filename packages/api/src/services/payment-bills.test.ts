import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { FeatureUnavailableError, ValidationError } from "../errors";
import {
  confirmBill,
  getBill,
  payBill,
  supplementBillSerialNumber,
  type PayBillInput,
  type PaymentBill,
  type SupplementBillSerialNumberInput,
} from "./payment-bills";

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
};

describe("payment bill service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes stable payment bill return types", () => {
    expectTypeOf<ReturnType<typeof getBill>>().toEqualTypeOf<
      Promise<PaymentBill>
    >();
    expectTypeOf<ReturnType<typeof payBill>>().toEqualTypeOf<
      Promise<PaymentBill>
    >();
    expectTypeOf<ReturnType<typeof confirmBill>>().toEqualTypeOf<
      Promise<PaymentBill>
    >();
    expectTypeOf<ReturnType<typeof supplementBillSerialNumber>>().toEqualTypeOf<
      Promise<PaymentBill>
    >();
  });

  it("gets a bill from the local Connect backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        bill: {
          id: "12",
          billNo: "BILL-12",
          payer: {
            id: "10001",
            name: "买家",
            avatarUrl: "https://example.test/payer.png",
          },
          payee: {
            id: "10002",
            name: "卖家",
            avatarUrl: "https://example.test/payee.png",
          },
          status: "BILL_STATUS_UNPAID",
          amountCents: 1234,
          verifyCode: "4821",
          channel: "CHANNEL_WECHAT",
          serialNumber: "SN-12",
          createdAt: "1970-01-01T00:00:01Z",
          updatedAt: "1970-01-01T00:00:02Z",
          sourceType: "spot_order",
          sourceId: "5001",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const bill = await getBill("12", localOptions);

    expect(bill).toEqual({
      id: "12",
      billNo: "BILL-12",
      payer: {
        id: "10001",
        name: "买家",
        avatarUrl: "https://example.test/payer.png",
      },
      payee: {
        id: "10002",
        name: "卖家",
        avatarUrl: "https://example.test/payee.png",
      },
      status: "unpaid",
      amountCents: 1234,
      verifyCode: "4821",
      channel: "wechat",
      serialNumber: "SN-12",
      submittedAt: null,
      completedAt: null,
      closedAt: null,
      createdAt: "1970-01-01T00:00:01.000Z",
      updatedAt: "1970-01-01T00:00:02.000Z",
      sourceType: "spot_order",
      sourceId: "5001",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.payment.v1.BillService/GetBill",
      body: {
        billId: "12",
      },
    });
  });

  it("pays a bill through the local Connect backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        bill: {
          id: "12",
          billNo: "BILL-12",
          status: "BILL_STATUS_SUBMITTED",
          amountCents: 1234,
          verifyCode: "4821",
          channel: "CHANNEL_ALIPAY",
          submittedAt: "1970-01-01T00:00:03Z",
          updatedAt: "1970-01-01T00:00:03Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const bill = await payBill(
      {
        billId: "12",
        channel: "alipay",
        updatedAt: "1970-01-01T00:00:02.000Z",
      },
      localOptions,
    );

    expect(bill).toMatchObject({
      id: "12",
      status: "submitted",
      channel: "alipay",
      submittedAt: "1970-01-01T00:00:03.000Z",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.payment.v1.BillService/PayBill",
      body: {
        billId: "12",
        channel: "CHANNEL_ALIPAY",
        updatedAt: "1970-01-01T00:00:02Z",
      },
    });
  });

  it("confirms a bill through the fauxrpc backend in mock mode", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        bill: {
          id: "9001",
          billNo: "ER-20260718-001",
          status: "BILL_STATUS_COMPLETED",
          amountCents: 1500,
          verifyCode: "2718",
          channel: "CHANNEL_WECHAT",
          completedAt: "2026-07-18T03:00:00Z",
          updatedAt: "2026-07-18T03:00:00Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const bill = await confirmBill(
      { billId: "9001", updatedAt: "2026-07-18T02:00:00Z" },
      { ...localOptions, dataSource: "mock" },
    );

    expect(bill).toMatchObject({ id: "9001", status: "completed" });
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.payment.v1.BillService/ConfirmBill",
      body: { billId: "9001", updatedAt: "2026-07-18T02:00:00Z" },
    });
  });

  it("validates bill input before submitting requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getBill("", localOptions)).rejects.toThrow("账单 ID 不正确");
    await expect(getBill("9223372036854775808", localOptions)).rejects.toThrow(
      "账单 ID 不正确",
    );
    await expect(
      payBill(
        {
          billId: "12",
          channel: "bank" as PayBillInput["channel"],
          updatedAt: "1970-01-01T00:00:02Z",
        },
        localOptions,
      ),
    ).rejects.toThrow("支付渠道不正确");
    await expect(
      confirmBill(
        {
          billId: "",
          updatedAt: "1970-01-01T00:00:02Z",
        },
        localOptions,
      ),
    ).rejects.toThrow("账单 ID 不正确");
    await expect(
      supplementBillSerialNumber(
        {
          billId: "12",
          serialNumber: " ",
          updatedAt: "1970-01-01T00:00:02Z",
        } satisfies SupplementBillSerialNumberInput,
        localOptions,
      ),
    ).rejects.toThrow("支付流水号不能为空");
    await expect(
      payBill({ billId: "12", channel: "wechat", updatedAt: "" }, localOptions),
    ).rejects.toThrow("账单更新时间不能为空");
    await expect(
      supplementBillSerialNumber(
        {
          billId: "12",
          serialNumber: "中文流水号",
          updatedAt: "1970-01-01T00:00:02Z",
        },
        localOptions,
      ),
    ).rejects.toThrow("支付流水号格式不正确");
    await expect(getBill("", localOptions)).rejects.toBeInstanceOf(
      ValidationError,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws for remote mode before backend client is wired", async () => {
    await expect(
      getBill("12", { dataSource: "remote" }),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
    await expect(
      payBill(
        {
          billId: "12",
          channel: "wechat",
          updatedAt: "1970-01-01T00:00:02Z",
        },
        { dataSource: "remote" },
      ),
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
