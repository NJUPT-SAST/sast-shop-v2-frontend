import { describe, expect, it, vi } from "vitest";
import { getBill, payBill } from "./payment-bills";
import { getSpotOrderDetail, cancelSpotOrder } from "./spot-orders";
import { getErrandDemandDetails } from "./errand-demands";
import { createErrandTask } from "./errand-tasks";
import { getPocket, getPocketPayment, publishPocket } from "./pocket";

const timestamp = "2026-11-11T12:00:00.123456789Z";
function transport(responses: Array<{ body: unknown; status?: number }>) {
  const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push({
      path: new URL(request.url).pathname,
      body: await request.json(),
    });
    const next = responses.shift();
    if (!next) throw new Error("Unexpected retry or version lookup");
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  return {
    requests,
    options: {
      dataSource: "local" as const,
      connectBaseUrl: "https://backend.test",
      fetch,
    },
  };
}

describe("transaction lifecycle boundaries", () => {
  it("carries the observed bill round and exact timestamp, without rebasing after a rejected write", async () => {
    const { options, requests } = transport([
      {
        body: { bill: { id: "12", lifecycleRound: "2", updatedAt: timestamp } },
      },
      { status: 409, body: { code: "aborted", message: "处理轮次已更新" } },
    ]);
    const bill = await getBill("12", options);
    await expect(
      payBill(
        {
          billId: bill.id,
          lifecycleRound: bill.lifecycleRound,
          updatedAt: bill.updatedAt!,
          channel: "wechat",
        },
        options,
      ),
    ).rejects.toThrow();
    expect(requests).toHaveLength(2);
    expect(requests[1]!.body).toMatchObject({
      lifecycleRound: "2",
      updatedAt: timestamp,
    });
  });

  it("does not substitute a newer order round for a stale cancellation", async () => {
    const { options, requests } = transport([
      {
        body: {
          spotOrderDetail: {
            id: "31",
            lifecycleRound: "3",
            productSnapshot: { id: "4", title: "商品" },
          },
        },
      },
      { status: 409, body: { code: "aborted", message: "旧轮次不能操作" } },
    ]);
    const current = await getSpotOrderDetail("31", options);
    expect(current.lifecycleRound).toBe("3");
    await expect(
      cancelSpotOrder({ spotOrderId: "31", lifecycleRound: "1" }, options),
    ).rejects.toThrow();
    expect(requests[1]!.body.lifecycleRound).toBe("1");
    expect(requests).toHaveLength(2);
  });

  it("preserves each aggregated demand's own round when a captain accepts mixed requests", async () => {
    const { options, requests } = transport([
      {
        body: {
          details: [
            {
              errandDemandId: "8",
              productTemplate: { id: "4" },
              requesters: [
                {
                  errandDemandItemId: "10",
                  demandLifecycleRound: "2",
                  updatedAt: timestamp,
                },
                {
                  errandDemandItemId: "11",
                  demandLifecycleRound: "5",
                  updatedAt: timestamp,
                },
              ],
            },
          ],
        },
      },
      { body: { errandTaskId: "30" } },
    ]);
    const groups = await getErrandDemandDetails({ storeId: "4" }, options);
    await createErrandTask(
      {
        storeId: "4",
        demandItems: groups.flatMap((group) =>
          group.requesters.map((row) => ({
            errandDemandItemId: row.errandDemandItemId,
            demandLifecycleRound: row.demandLifecycleRound,
            updatedAt: row.updatedAt,
          })),
        ),
      },
      options,
    );
    expect(requests[1]!.body.demandItems).toEqual([
      {
        errandDemandItemId: "10",
        demandLifecycleRound: "2",
        updatedAt: timestamp,
      },
      {
        errandDemandItemId: "11",
        demandLifecycleRound: "5",
        updatedAt: timestamp,
      },
    ]);
  });

  it("keeps Pocket lifecycle separate from editable revision for payment and publishing", async () => {
    const pocket = { id: "8", revision: "90", lifecycleRound: "4" };
    const { options, requests } = transport([
      { body: { pocket } },
      { body: { pocket } },
      { body: { pocket } },
    ]);
    const detail = await getPocket("8", options);
    await getPocketPayment("8", {
      ...options,
      lifecycleRound: detail.pocket.lifecycleRound,
    });
    await publishPocket(
      {
        pocketId: "8",
        expectedRevision: detail.pocket.revision,
        lifecycleRound: detail.pocket.lifecycleRound,
        requestId: "stable-request",
      },
      options,
    );
    expect(requests[1]!.body.lifecycleRound).toBe("4");
    expect(requests[2]!.body).toMatchObject({
      lifecycleRound: "4",
      expectedRevision: "90",
    });
  });
});
