// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BuyerErrandOrder,
  BuyerErrandOrderDetail,
  ListSpotGoodsResult,
  SpotOrder,
} from "@sast-shop/api";
import { BuyerErrandOrderDetailView } from "../components/buyer-errand-order-detail";
import { OrdersView } from "../components/orders-view";
import { SpotMarketplace } from "../components/spot-marketplace";
import { SpotOrderDetail } from "../components/spot-order-detail";

const {
  createSpotOrders,
  getSpotGoods,
  getBill,
  getSpotOrderDetail,
  getBuyerErrandOrderDetail,
  cancelSpotOrder,
  cancelErrandDemand,
  completeSpotOrder,
  confirmBill,
  listPaymentQrCodes,
  payBill,
  supplementBillSerialNumber,
  ensureAgreement,
} = vi.hoisted(() => ({
  createSpotOrders: vi.fn(),
  getSpotGoods: vi.fn(),
  getBill: vi.fn(),
  getSpotOrderDetail: vi.fn(),
  getBuyerErrandOrderDetail: vi.fn(),
  cancelSpotOrder: vi.fn(),
  cancelErrandDemand: vi.fn(),
  completeSpotOrder: vi.fn(),
  confirmBill: vi.fn(),
  listPaymentQrCodes: vi.fn(),
  payBill: vi.fn(),
  supplementBillSerialNumber: vi.fn(),
  ensureAgreement: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/orders",
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("@sast-shop/api", () => ({
  createSpotOrders,
  getSpotGoods,
  getBill,
  getSpotOrderDetail,
  getBuyerErrandOrderDetail,
  listSpotGoods: vi.fn(),
  listPaymentQrCodes,
  payBill,
  cancelSpotOrder,
  cancelErrandDemand,
  completeSpotOrder,
  confirmBill,
  supplementBillSerialNumber,
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement }),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));
vi.mock("../components/managed-image", () => ({
  ManagedImage: ({ alt }: { alt: string }) => <div aria-label={alt} />,
}));
vi.mock("../components/lark-contact-button", () => ({
  LarkContactButton: () => null,
}));
vi.mock("qrcode.react", () => ({
  QRCodeCanvas: ({ value }: { value: string }) => (
    <div aria-label="付款二维码" data-content={value} />
  ),
}));
vi.mock("@workspace/ui/hooks/use-infinite-page", () => ({
  useInfinitePage: ({
    initialPage,
  }: {
    initialPage: { items: ListSpotGoodsResult["goods"] };
  }) => ({
    items: initialPage.items,
    loadingMore: false,
    loadMoreError: null,
    hasMore: false,
    totalCount: initialPage.items.length,
    loadMore: vi.fn(),
  }),
}));
vi.mock("@workspace/ui/components/dialog", () => {
  const Container = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: ({
      open,
      children,
    }: {
      open: boolean;
      children: React.ReactNode;
    }) => (open ? <div role="dialog">{children}</div> : null),
    DialogContent: Container,
    DialogHeader: Container,
    DialogFooter: Container,
    DialogTitle: Container,
    DialogDescription: Container,
  };
});

const product = {
  id: "4001",
  title: "矿泉水",
  description: "550ml",
  priceCents: 250,
  storeId: "3001",
  mainImageUrl: "",
  barcode: "690000000001",
  updatedAt: "2026-07-18T01:00:00Z",
};
const store = {
  id: "3001",
  name: "SAST 小卖部",
  address: "南邮仙林校区",
  logoUrl: "",
  themeColor: "#0071e3",
};
const initialPage: ListSpotGoodsResult = {
  goods: [
    {
      id: "5001",
      product,
      salePriceCents: 200,
      updatedAt: "2026-07-18T01:00:00Z",
      store,
    },
  ],
  currentPage: 1,
  pageSize: 10,
  totalCount: 1,
};
const order: SpotOrder = {
  id: "7001",
  orderNo: "SPOT-20260718-0001",
  store,
  productTitle: "矿泉水",
  productDescription: "550ml",
  productImageUrl: "",
  quantity: 1,
  unitPriceCents: 200,
  totalAmountCents: 200,
  billId: "9101",
  seller: null,
  status: "pending_payment",
  createdAt: "2026-07-18T00:00:00Z",
  paidAt: null,
  completedAt: null,
  cancelledAt: null,
  bill: {
    id: "9101",
    billNo: "BILL-9101",
    payer: null,
    payee: { id: "42", name: "卖家", avatarUrl: "" },
    status: "unpaid",
    amountCents: 200,
    verifyCode: "2718",
    channel: null,
    serialNumber: null,
    submittedAt: null,
    completedAt: null,
    closedAt: null,
    createdAt: null,
    updatedAt: "2026-07-18T02:00:00Z",
    sourceType: "spot_order",
    sourceId: "7001",
  },
};
const errandOrder: BuyerErrandOrderDetail = {
  id: "8001",
  storeId: "3001",
  createdAt: "2026-07-18T00:00:00Z",
  updatedAt: "2026-07-18T02:00:00Z",
  store,
  status: "pending_payment",
  productItems: [],
  totalOriginAmountCents: 200,
  totalActualAmountCents: 200,
  totalServiceFeeCents: 0,
  captain: null,
  bill: {
    ...order.bill!,
    id: "9201",
    sourceType: "errand_order",
    sourceId: "8001",
  },
  deadline: null,
  shoppingStartAt: null,
  shoppingCompletedAt: null,
  distributionCompletedAt: null,
  paymentCompletedAt: null,
  cancelledAt: null,
};
const errandBrief: BuyerErrandOrder = {
  id: "8001",
  storeId: "3001",
  createdAt: "2026-07-18T00:00:00Z",
  store,
  status: "open",
  productTemplates: [],
  totalOriginAmountCents: 200,
  totalActualAmountCents: null,
  totalServiceFeeCents: 0,
  productTotalCount: 0,
};

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const storedPreferences = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storedPreferences.get(key) ?? null,
    setItem: (key: string, value: string) => storedPreferences.set(key, value),
  });
  ensureAgreement.mockReset().mockResolvedValue(false);
  createSpotOrders.mockReset();
  getSpotGoods.mockReset().mockResolvedValue({
    id: "5001",
    product,
    salePriceCents: 200,
    stock: 5,
    sellerId: "42",
    sellerName: "卖家",
    sellerAvatarUrl: "",
    updatedAt: "2026-07-18T01:00:00Z",
  });
  listPaymentQrCodes
    .mockReset()
    .mockResolvedValue([
      { channel: "wechat", content: "https://example.com/pay" },
    ]);
  payBill.mockReset();
  supplementBillSerialNumber.mockReset();
  getBill.mockReset();
  getSpotOrderDetail.mockReset();
  getBuyerErrandOrderDetail.mockReset();
  cancelSpotOrder.mockReset();
  cancelErrandDemand.mockReset();
  completeSpotOrder.mockReset();
  confirmBill.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (element) =>
      element.getAttribute("aria-label") === label ||
      element.textContent?.trim().startsWith(label),
  );
  expect(button, `Missing button: ${label}`).toBeDefined();
  await act(async () => button!.click());
}

async function clickDialogButton(label: string) {
  const button = Array.from(
    container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
  ).find((element) => element.textContent?.trim().startsWith(label));
  expect(button, `Missing dialog button: ${label}`).toBeDefined();
  await act(async () => button!.click());
}

async function enterSerialNumber(value: string) {
  const input = container.querySelector<HTMLInputElement>(
    'input[aria-label="支付流水号"]',
  );
  expect(input).not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  await act(async () => {
    setter?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("desktop transaction guard", () => {
  it("does not create a spot order when the agreement is declined", async () => {
    await act(async () => {
      root.render(
        <SpotMarketplace
          dataSource="local"
          connectBaseUrl="http://127.0.0.1:1323"
          initialPage={initialPage}
          error={null}
        />,
      );
    });

    await click("选购矿泉水");
    await click("创建订单");

    expect(ensureAgreement).toHaveBeenCalledTimes(1);
    expect(createSpotOrders).not.toHaveBeenCalled();
  });

  it("does not submit payment when the agreement is declined", async () => {
    await act(async () => {
      root.render(
        <SpotOrderDetail
          dataSource="local"
          connectBaseUrl="http://127.0.0.1:1323"
          order={order}
          view="buyer"
          returnTo="/orders"
        />,
      );
    });

    await click("立即支付");
    await click("我已支付");

    expect(ensureAgreement).toHaveBeenCalledTimes(1);
    expect(payBill).not.toHaveBeenCalled();
  });
});

describe("desktop payment recovery", () => {
  async function renderOrder(value: SpotOrder = order) {
    await act(async () => {
      root.render(
        <SpotOrderDetail
          dataSource="local"
          connectBaseUrl="http://127.0.0.1:1323"
          order={value}
          view="buyer"
          returnTo="/orders"
        />,
      );
    });
  }

  it("reads a submitted bill after the payment response is lost", async () => {
    ensureAgreement.mockResolvedValue(true);
    payBill.mockRejectedValue(new Error("response lost"));
    getBill.mockResolvedValue({
      ...order.bill,
      status: "submitted",
      updatedAt: "2026-07-18T02:01:00Z",
    });
    await renderOrder();
    await click("立即支付");
    await click("我已支付");
    expect(getBill).toHaveBeenCalledWith(
      "9101",
      expect.objectContaining({ dataSource: "local" }),
    );
    expect(container.textContent).toContain("补充流水号");
    expect(container.textContent).not.toContain("立即支付");
    expect(payBill).toHaveBeenCalledTimes(1);
  });

  it("locks the old bill version when payment and verification both fail", async () => {
    ensureAgreement.mockResolvedValue(true);
    payBill.mockRejectedValue(new Error("response lost"));
    getBill.mockRejectedValue(new Error("read failed"));
    await renderOrder();
    await click("立即支付");
    await click("我已支付");
    const paymentButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("立即支付"),
    );
    expect(paymentButton?.disabled).toBe(true);
    expect(container.textContent).toContain("操作结果待核实");
    expect(payBill).toHaveBeenCalledTimes(1);
  });

  it("hides a previous payee's QR while a new bill loads", async () => {
    ensureAgreement.mockResolvedValue(true);
    await renderOrder();
    await click("立即支付");
    expect(
      container.querySelector('[data-content="https://example.com/pay"]'),
    ).not.toBeNull();
    listPaymentQrCodes.mockReturnValue(new Promise(() => {}));
    const nextOrder = {
      ...order,
      bill: {
        ...order.bill!,
        payee: { id: "43", name: "另一位卖家", avatarUrl: "" },
        updatedAt: "2026-07-18T02:01:00Z",
      },
    } satisfies SpotOrder;
    await renderOrder(nextOrder);
    expect(
      container.querySelector('[data-content="https://example.com/pay"]'),
    ).toBeNull();
  });

  it("opens the saved payment channel only when its QR is available", async () => {
    window.localStorage.setItem("sast-shop.default-payment-platform", "alipay");
    listPaymentQrCodes.mockResolvedValue([
      { channel: "wechat", content: "wechat-code" },
      { channel: "alipay", content: "alipay-code" },
    ]);
    await renderOrder();
    await click("立即支付");
    expect(
      container.querySelector('[data-content="alipay-code"]'),
    ).not.toBeNull();
  });

  it("falls back to an available QR when the saved channel is missing", async () => {
    window.localStorage.setItem("sast-shop.default-payment-platform", "alipay");
    listPaymentQrCodes.mockResolvedValue([
      { channel: "wechat", content: "wechat-code" },
    ]);
    await renderOrder();
    await click("立即支付");
    expect(
      container.querySelector('[data-content="wechat-code"]'),
    ).not.toBeNull();
  });

  it("locks a submitted bill if the serial-number write cannot be verified", async () => {
    ensureAgreement.mockResolvedValue(true);
    supplementBillSerialNumber.mockRejectedValue(new Error("response lost"));
    getBill.mockRejectedValue(new Error("read failed"));
    await renderOrder({
      ...order,
      bill: { ...order.bill!, status: "submitted" },
    });
    await click("补充流水号");
    await enterSerialNumber("WX-12345");
    await click("提交");
    const supplementButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("补充流水号"));
    expect(supplementButton?.disabled).toBe(true);
    expect(supplementBillSerialNumber).toHaveBeenCalledTimes(1);
  });

  it("accepts a matching serial number read after the write response is lost", async () => {
    ensureAgreement.mockResolvedValue(true);
    supplementBillSerialNumber.mockRejectedValue(new Error("response lost"));
    getBill.mockResolvedValue({
      ...order.bill,
      status: "submitted",
      serialNumber: "WX-12345",
      updatedAt: "2026-07-18T02:01:00Z",
    });
    await renderOrder({
      ...order,
      bill: { ...order.bill!, status: "submitted" },
    });
    await click("补充流水号");
    await enterSerialNumber("WX-12345");
    await click("提交");
    expect(container.textContent).toContain("WX-12345");
    expect(
      Array.from(container.querySelectorAll("button")).some((button) =>
        button.textContent?.includes("补充流水号"),
      ),
    ).toBe(false);
    expect(supplementBillSerialNumber).toHaveBeenCalledTimes(1);
  });
});

describe("desktop order creation recovery", () => {
  it("keeps the create action locked while navigating to the created order", async () => {
    ensureAgreement.mockResolvedValue(true);
    createSpotOrders.mockResolvedValue([{ id: "5001" }]);
    await act(async () => {
      root.render(
        <SpotMarketplace
          dataSource="local"
          connectBaseUrl="http://127.0.0.1:1323"
          initialPage={initialPage}
          error={null}
        />,
      );
    });
    await click("选购矿泉水");
    await click("创建订单");
    await click("创建订单");
    expect(createSpotOrders).toHaveBeenCalledTimes(1);
    const createButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("创建订单"),
    );
    expect(createButton?.disabled).toBe(true);
  });

  it("requires order review before retrying an uncertain creation", async () => {
    ensureAgreement.mockResolvedValue(true);
    createSpotOrders.mockRejectedValue(new Error("response lost"));
    await act(async () => {
      root.render(
        <SpotMarketplace
          dataSource="local"
          connectBaseUrl="http://127.0.0.1:1323"
          initialPage={initialPage}
          error={null}
        />,
      );
    });
    await click("选购矿泉水");
    await click("创建订单");
    const createButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("创建订单"),
    );
    expect(createButton?.disabled).toBe(true);
    expect(container.textContent).toContain("请先到订单查看");
    expect(createSpotOrders).toHaveBeenCalledTimes(1);
  });
});

describe("desktop errand payment recovery", () => {
  it("locks the old errand bill after an ambiguous payment", async () => {
    ensureAgreement.mockResolvedValue(true);
    payBill.mockRejectedValue(new Error("response lost"));
    getBill.mockRejectedValue(new Error("read failed"));
    await act(async () => {
      root.render(
        <BuyerErrandOrderDetailView
          order={errandOrder}
          dataSource="local"
          connectBaseUrl="http://127.0.0.1:1323"
        />,
      );
    });
    await click("去支付");
    await click("我已支付");
    const paymentButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("去支付"),
    );
    expect(paymentButton?.disabled).toBe(true);
    expect(payBill).toHaveBeenCalledTimes(1);
  });
});

describe("desktop order list status", () => {
  it("shows only the empty state when a loaded feed has no matching orders", async () => {
    const emptyPage = {
      items: [],
      currentPage: 1,
      pageSize: 10,
      totalCount: 0,
      hasMore: false,
    };
    await act(async () => {
      root.render(
        <OrdersView
          dataSource="local"
          connectBaseUrl="http://127.0.0.1:1323"
          initialFilters={{
            type: "spot",
            view: "buyer",
            status: "processing",
            query: "",
          }}
          spotBuyerPage={{ ...emptyPage, items: [order], totalCount: 1 }}
          spotSellerPage={emptyPage}
          buyerErrandPage={emptyPage}
          errandTaskPage={emptyPage}
          errors={{
            spotBuyer: false,
            spotSeller: false,
            errandParticipant: false,
            errandCaptain: false,
          }}
        />,
      );
    });
    expect(container.textContent).toContain("没有符合条件的订单");
    expect(container.textContent).not.toContain("已经到底");
  });
});

describe("desktop lifecycle recovery", () => {
  async function renderSpot(
    value: SpotOrder = order,
    view: "buyer" | "seller" = "buyer",
  ) {
    await act(async () => {
      root.render(
        <SpotOrderDetail
          dataSource="local"
          connectBaseUrl="http://127.0.0.1:1323"
          order={value}
          view={view}
          returnTo="/orders"
        />,
      );
    });
  }

  it("locks an old spot order after cancellation and verification both fail", async () => {
    ensureAgreement.mockResolvedValue(true);
    cancelSpotOrder.mockRejectedValue(new Error("response lost"));
    getSpotOrderDetail.mockRejectedValue(new Error("read failed"));
    await renderSpot();
    await click("取消订单");
    await clickDialogButton("取消订单");
    const cancelButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "取消订单",
    );
    expect(cancelButton?.disabled).toBe(true);
    expect(cancelSpotOrder).toHaveBeenCalledTimes(1);
  });

  it("accepts a completed seller bill after a lost confirmation response", async () => {
    ensureAgreement.mockResolvedValue(true);
    confirmBill.mockRejectedValue(new Error("response lost"));
    const submitted = {
      ...order,
      bill: { ...order.bill!, status: "submitted" as const },
    };
    getSpotOrderDetail.mockResolvedValue({
      ...submitted,
      status: "paid",
      bill: {
        ...submitted.bill,
        status: "completed",
        updatedAt: "2026-07-18T02:01:00Z",
      },
    });
    await renderSpot(submitted, "seller");
    await click("确认收款");
    await clickDialogButton("确认已到账");
    expect(getSpotOrderDetail).toHaveBeenCalledWith(
      "7001",
      expect.objectContaining({ dataSource: "local" }),
    );
    expect(container.textContent).not.toContain("确认收款");
    expect(confirmBill).toHaveBeenCalledTimes(1);
  });

  it("locks an old demand after an ambiguous withdrawal until a fresh read", async () => {
    ensureAgreement.mockResolvedValue(true);
    getBuyerErrandOrderDetail
      .mockResolvedValueOnce({ ...errandOrder, status: "open" })
      .mockRejectedValueOnce(new Error("read failed"))
      .mockResolvedValue({ ...errandOrder, status: "open" });
    cancelErrandDemand.mockRejectedValue(new Error("response lost"));
    const emptyPage = {
      items: [],
      currentPage: 1,
      pageSize: 10,
      totalCount: 0,
      hasMore: false,
    };
    await act(async () => {
      root.render(
        <OrdersView
          dataSource="local"
          connectBaseUrl="http://127.0.0.1:1323"
          initialFilters={{
            type: "errand",
            view: "participant",
            status: "all",
            query: "",
          }}
          spotBuyerPage={emptyPage}
          spotSellerPage={emptyPage}
          buyerErrandPage={{
            ...emptyPage,
            items: [errandBrief],
            totalCount: 1,
          }}
          errandTaskPage={emptyPage}
          errors={{
            spotBuyer: false,
            spotSeller: false,
            errandParticipant: false,
            errandCaptain: false,
          }}
        />,
      );
    });
    await click("撤回");
    await clickDialogButton("撤回需求");
    expect(container.textContent).toContain("撤回结果待核实");
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent?.trim() === "撤回",
      ),
    ).toBe(false);
    expect(cancelErrandDemand).toHaveBeenCalledTimes(1);
    await click("重新核实");
    expect(container.textContent).not.toContain("撤回结果待核实");
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent?.trim() === "撤回",
      ),
    ).toBe(true);
  });
});
