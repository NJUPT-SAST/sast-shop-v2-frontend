import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DistributingTaskDetail } from "@sast-shop/api";

import { DistributingTaskView } from "../components/errand-purchase/distributing-task-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));
vi.mock("@sast-shop/api", () => ({}));
vi.mock("@/components/managed-image", () => ({ ManagedImage: () => null }));
vi.mock("@/components/mobile-fixed-footer", () => ({
  MobileFixedFooter: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/errand-task-route", () => ({
  buildErrandTaskPaymentHref: () => "/group/purchase/1/payment",
}));

function renderUnpurchasedItem(distributedQuantity: number | null) {
  vi.stubGlobal("React", React);
  const detail: DistributingTaskDetail = {
    taskId: "1",
    storeId: "2",
    storeName: "测试店铺",
    taskUpdatedAt: null,
    packagingFeeCents: 0,
    items: [
      {
        errandTaskItemId: "3",
        title: "缺货商品",
        description: "",
        imageUrl: "",
        originUnitPriceCents: 100,
        actualUnitPriceCents: null,
        purchasedQuantity: 0,
        itemUpdatedAt: null,
        requesters: [
          {
            purchaserId: "4",
            purchaserName: "买家",
            purchaserAvatarUrl: "",
            quantity: 1,
            distributedQuantity,
            errandTaskAssignmentId: "5",
            errandDemandItemId: "6",
            assignmentUpdatedAt: null,
          },
        ],
      },
    ],
  };
  return renderToStaticMarkup(
    <DistributingTaskView
      dataSource="local"
      connectBaseUrl="http://localhost/api/connect"
      detail={detail}
      mode="distributing"
    />,
  );
}

describe("mobile errand distribution view", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps unpurchased products accessible until no-distribution is recorded", () => {
    const markup = renderUnpurchasedItem(null);

    expect(markup).toContain("缺货商品");
    expect(markup).toContain('aria-controls="distributing-item-3"');
    expect(markup).toContain("还有 1 种商品待分发");
  });

  it("allows completion after the unpurchased product is explicitly skipped", () => {
    const markup = renderUnpurchasedItem(0);
    const button = markup
      .match(/<button\b[^>]*>[\s\S]*?<\/button>/g)
      ?.find((entry) => entry.includes("确认分发完成"));

    expect(button).toBeDefined();
    expect(button).not.toContain(' disabled=""');
    expect(markup).toContain("已分发");
  });
});
