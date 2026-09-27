import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DistributingTaskDetail } from "@sast-shop/api";

import { DistributingTaskView } from "../components/errand-purchase/distributing-task-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));
vi.mock("@sast-shop/api", () => ({}));
vi.mock("@/components/managed-image", () => ({ ManagedImage: () => null }));
vi.mock("@/lib/errand-task-route", () => ({
  buildErrandTaskPaymentHref: () => "/group/purchase/1/payment",
}));

function renderUnpurchasedItem(mode: "pending_distributing" | "distributing") {
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
            distributedQuantity: null,
            errandTaskAssignmentId: "5",
            errandDemandItemId: "6",
            assignmentUpdatedAt: null,
          },
        ],
      },
    ],
  };
  return renderToStaticMarkup(
    <DistributingTaskView dataSource="local" detail={detail} mode={mode} />,
  );
}

describe("desktop errand distribution view", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("allows starting distribution without prices for unpurchased products", () => {
    const markup = renderUnpurchasedItem("pending_distributing");
    const button = markup
      .match(/<button\b[^>]*>[\s\S]*?<\/button>/g)
      ?.find((entry) => entry.includes("确认价格并开始分发"));

    expect(button).toBeDefined();
    expect(button).not.toContain(' disabled=""');
    expect(markup).toContain("未采购");
  });

  it("requires explicit no-distribution results before generating bills", () => {
    const markup = renderUnpurchasedItem("distributing");
    const button = markup
      .match(/<button\b[^>]*>[\s\S]*?<\/button>/g)
      ?.find((entry) => entry.includes("完成分发并生成账单"));

    expect(button).toContain(' disabled=""');
  });
});
