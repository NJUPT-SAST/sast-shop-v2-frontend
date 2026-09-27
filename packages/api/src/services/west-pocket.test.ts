import { afterEach, describe, expect, it, vi } from "vitest";
import { Code, ConnectError } from "@connectrpc/connect";
import {
  AuthRequiredError,
  FeatureUnavailableError,
  ValidationError,
} from "../errors";
import {
  createPocket,
  getPocket,
  getPocketPayment,
  previewPocketSplit,
  publishPocket,
  replacePocketMembers,
  rejectPocketPayment,
  revokePocketFace,
} from "./west-pocket";

const options = {
  dataSource: "local" as const,
  connectBaseUrl: "https://backend.test",
};
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function stub(body: unknown) {
  const fetch = vi.fn(async () => response(body));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
async function requestBody(fetch: ReturnType<typeof vi.fn>) {
  const [input, init] = fetch.mock.calls[0] as [
    RequestInfo | URL,
    RequestInit | undefined,
  ];
  return new Request(input, init).json();
}
const pocket = {
  id: "9007199254740993",
  ownerId: "10",
  title: "聚餐",
  totalCents: 10000,
  status: "draft",
  revision: "9007199254740994",
  isOwner: true,
  owner: { id: "10", name: "收款人" },
};

afterEach(() => vi.unstubAllGlobals());
describe("West Pocket facade boundaries", () => {
  it("returns a mistaken submission to unpaid using the exact latest bill version", async () => {
    const fetch = stub({
      bill: {
        id: "20",
        status: "BILL_STATUS_UNPAID",
        amountCents: 3333,
        updatedAt: "2026-09-23T12:00:01.123456789Z",
      },
    });
    const result = await rejectPocketPayment(
      { billId: "20", updatedAt: "2026-09-23T12:00:00.123456789Z" },
      options,
    );
    expect(result.status).toBe("unpaid");
    expect(await requestBody(fetch)).toEqual({
      billId: "20",
      targetStatus: "BILL_STATUS_UNPAID",
      updatedAt: "2026-09-23T12:00:00.123456789Z",
    });
    const [input, init] = fetch.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    expect(new Request(input, init).url).toContain(".BillService/TransitionBill");
  });
  it("preserves large IDs, authoritative ownership and exact bill versions", async () => {
    stub({
      pocket,
      isOwner: true,
      members: [
        {
          id: "11",
          userId: "12",
          user: { id: "12", name: "同学" },
          paymentBillId: "13",
          billStatus: "submitted",
          billUpdatedAt: "2026-09-23T01:02:03.123456789Z",
        },
      ],
    });
    const detail = await getPocket(pocket.id, options);
    expect(detail.pocket.id).toBe(pocket.id);
    expect(detail.pocket.revision).toBe(pocket.revision);
    expect(detail.isOwner).toBe(true);
    expect(detail.members[0]?.billUpdatedAt).toBe(
      "2026-09-23T01:02:03.123456789Z",
    );
  });
  it("uses server remainder allocations without recalculating or losing cents", async () => {
    stub({
      pocketId: "1",
      revision: "4",
      totalCents: 10000,
      participantCount: 3,
      ownerShareCents: 3334,
      receivableCents: 6666,
      members: [
        { userId: "10", shareCents: 3334, isOwner: true },
        { userId: "11", shareCents: 3333 },
        { userId: "12", shareCents: 3333 },
      ],
    });
    const split = await previewPocketSplit(
      { pocketId: "1", expectedRevision: "4" },
      options,
    );
    expect(
      split.members.reduce((sum, member) => sum + member.shareCents, 0),
    ).toBe(split.totalCents);
    expect(split.ownerShareCents + split.receivableCents).toBe(10000);
  });
  it("publishes only identity, revision and stable request key", async () => {
    const fetch = stub({ pocket: { ...pocket, status: "publishing" } });
    await publishPocket(
      {
        pocketId: pocket.id,
        expectedRevision: pocket.revision,
        requestId: "retry-key",
      },
      options,
    );
    expect(await requestBody(fetch)).toEqual({
      pocketId: pocket.id,
      expectedRevision: pocket.revision,
      requestId: "retry-key",
    });
  });
  it("rejects duplicate membership and invalid amounts before sending", async () => {
    const fetch = stub({});
    await expect(
      replacePocketMembers(
        {
          pocketId: "1",
          expectedRevision: "1",
          requestId: "r",
          members: [
            { userId: "2", selectionSource: "search" },
            { userId: "2", selectionSource: "face" },
          ],
        },
        options,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createPocket({ title: "", totalCents: 0.01, requestId: "r" }, options),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      getPocket("9223372036854775808", options),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses published QR snapshot and does not fetch mutable profile QR codes", async () => {
    const fetch = stub({
      pocket: { ...pocket, status: "collecting" },
      qrContent: "wxp://snapshot",
      bill: {
        id: "50",
        amountCents: 3333,
        status: "BILL_STATUS_UNPAID",
        updatedAt: "2026-09-23T01:02:03.123456789Z",
      },
    });
    const payment = await getPocketPayment(pocket.id, options);
    expect(payment.qrContent).toBe("wxp://snapshot");
    expect(payment.bill?.updatedAt).toBe("2026-09-23T01:02:03.123456789Z");
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("does not report cloud deletion complete when revoke is merely queued", async () => {
    stub({
      faceProfile: { id: "1", status: "revoking", revision: "3" },
      job: { id: "2", status: "queued", kind: "revoke" },
    });
    const result = await revokePocketFace(
      { expectedRevision: "2", requestId: "delete-key" },
      options,
    );
    expect(result.profile.status).toBe("revoking");
    expect(result.job?.status).toBe("queued");
  });
  it("fails explicitly for unsupported data sources and expired sessions", async () => {
    await expect(
      getPocket("1", { ...options, dataSource: "remote" }),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new ConnectError("请先登录", Code.Unauthenticated);
      }),
    );
    await expect(getPocket("1", options)).rejects.toBeInstanceOf(
      AuthRequiredError,
    );
  });
});
