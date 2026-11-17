import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AdminAccessError,
  AdminRequestError,
  getAdminContext,
  listAdminAudit,
  mutateAdminRecord,
  previewAdminCorrection,
  type AdminMutation,
} from "./admin";

const base = "https://shop.test/api/admin/connect";
const input: AdminMutation = {
  resource: "spot_order",
  id: "12",
  action: "reopen",
  updatedAt: "2026-11-11T01:02:03.123456789Z",
  round: "3",
  reason: "核查完成",
  evidence: "流水 123 已核实",
  values: { funds_handling: "refunded" },
};
const record = {
  resource: "RESOURCE_KIND_SPOT_ORDER",
  id: "12",
  title: "订单",
  status: "cancelled",
  lifecycleRound: "3",
  updatedAt: input.updatedAt,
};
function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}
afterEach(() => vi.unstubAllGlobals());

describe("admin API boundaries", () => {
  it("preserves nanosecond concurrency tokens and rounds in correction previews", async () => {
    const fetch = vi.fn(async () =>
      response({
        previewId: "preview-1",
        digest: "digest",
        record,
        expiresAt: "2026-11-11T01:17:03Z",
        impacts: [],
      }),
    );
    const result = await previewAdminCorrection(input, {
      connectBaseUrl: base,
      fetch,
    });
    expect(result.record?.updatedAt).toBe(input.updatedAt);
    expect(result.record?.round).toBe("3");
    const call = fetch.mock.calls[0] as unknown as [RequestInfo, RequestInit];
    const request = new Request(call[0], call[1]);
    const body = await request.json();
    expect(body.expectedUpdatedAt).toBe(input.updatedAt);
    expect(body.expectedRound).toBe("3");
    expect(request.url).toContain("SpotAdminService/PreviewCorrection");
  });
  it("requires evidence before any management mutation is sent", async () => {
    const fetch = vi.fn();
    await expect(
      mutateAdminRecord(
        { ...input, action: "block", evidence: "", requestId: "request" },
        { connectBaseUrl: base, fetch },
      ),
    ).rejects.toThrow("依据");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects a reason exceeding the backend limit before sending a write or preview", async () => {
    const fetch = vi.fn();
    const options = { connectBaseUrl: base, fetch };
    const tooLong = { ...input, reason: "核".repeat(1001) };
    await expect(previewAdminCorrection(tooLong, options)).rejects.toThrow(
      "1 至 1000 字",
    );
    await expect(
      mutateAdminRecord({ ...tooLong, requestId: "request" }, options),
    ).rejects.toThrow("1 至 1000 字");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("sends a reason at the backend limit without truncating it", async () => {
    const fetch = vi.fn(async () => response({ record }));
    const reason = "核".repeat(1000);
    await mutateAdminRecord(
      { ...input, reason, requestId: "request" },
      { connectBaseUrl: base, fetch },
    );
    const call = fetch.mock.calls[0] as unknown as [RequestInfo, RequestInit];
    expect(await new Request(call[0], call[1]).json()).toMatchObject({
      reason,
    });
  });
  it("rejects a non-admin context even if the endpoint returns 200", async () => {
    await expect(
      getAdminContext({
        connectBaseUrl: base,
        fetch: async () =>
          response({ userId: "1", role: "user", status: "active" }),
      }),
    ).rejects.toBeInstanceOf(AdminAccessError);
  });
  it("distinguishes permission denial from an uncertain write", async () => {
    await expect(
      mutateAdminRecord(
        { ...input, requestId: "request" },
        {
          connectBaseUrl: base,
          fetch: async () =>
            response({ code: "permission_denied", message: "denied" }, 403),
        },
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      mutateAdminRecord(
        { ...input, requestId: "request" },
        {
          connectBaseUrl: base,
          fetch: async () => {
            throw new TypeError("network lost");
          },
        },
      ),
    ).rejects.toBeInstanceOf(AdminRequestError);
    await expect(
      mutateAdminRecord(
        { ...input, requestId: "request" },
        {
          connectBaseUrl: base,
          fetch: async () => {
            throw new TypeError("network lost");
          },
        },
      ),
    ).rejects.toMatchObject({ uncertain: true });
  });
  it("queries the exact request identifier when reconciling a lost mutation response", async () => {
    const fetch = vi.fn(async () => response({ entries: [], totalCount: "0" }));
    await listAdminAudit(
      "spot",
      { resource: "spot_order", resourceId: "12", requestId: "exact-request" },
      { connectBaseUrl: base, fetch },
    );
    const call = fetch.mock.calls[0] as unknown as [RequestInfo, RequestInit];
    expect(await new Request(call[0], call[1]).json()).toMatchObject({
      requestId: "exact-request",
      resourceId: "12",
    });
  });
});
