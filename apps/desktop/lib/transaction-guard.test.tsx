// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ListSpotGoodsResult, SpotOrder } from "@sast-shop/api";
import { SpotMarketplace } from "../components/spot-marketplace";
import { SpotOrderDetail } from "../components/spot-order-detail";

const {
  createSpotOrders,
  getSpotGoods,
  listPaymentQrCodes,
  payBill,
  ensureAgreement,
} = vi.hoisted(() => ({
  createSpotOrders: vi.fn(),
  getSpotGoods: vi.fn(),
  listPaymentQrCodes: vi.fn(),
  payBill: vi.fn(),
  ensureAgreement: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
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
  listSpotGoods: vi.fn(),
  listPaymentQrCodes,
  payBill,
  cancelSpotOrder: vi.fn(),
  completeSpotOrder: vi.fn(),
  confirmBill: vi.fn(),
  supplementBillSerialNumber: vi.fn(),
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
  QRCodeCanvas: () => <div aria-label="付款二维码" />,
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

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
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
