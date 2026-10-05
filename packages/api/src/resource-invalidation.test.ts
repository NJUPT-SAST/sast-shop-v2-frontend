import { Code, ConnectError } from "@connectrpc/connect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, AuthRequiredError } from "./errors";
import { requestLocal } from "./local-connect";

const dispatchEvent = vi.fn<(event: Event) => boolean>(() => true);

beforeEach(() => {
  dispatchEvent.mockClear();
  vi.stubGlobal("window", { dispatchEvent });
});

afterEach(() => vi.unstubAllGlobals());

describe("RPC resource invalidation", () => {
  it.each([
    "getCurrentUser",
    "getBill",
    "listSpotGoods",
    "listAddresses",
    "validateSessionUser",
  ])("keeps cached data fresh after the read operation %s", async (feature) => {
    await requestLocal(feature, async () => "data");
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it.each([
    "createSpotOrders",
    "updateAddress",
    "deleteAddress",
    "payBill",
    "confirmBill",
    "supplementBillSerialNumber",
    "transitionToCompleted",
    "cancelTask",
  ])("invalidates resources after the write operation %s", async (feature) => {
    const result = await requestLocal(feature, async () => "written");
    expect(result).toBe("written");
    expect(dispatchEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ type: "sast-shop:data-changed" }),
    );
  });

  it("invalidates after an uncertain write timeout before returning the error", async () => {
    await expect(
      requestLocal("createSpotOrders", () =>
        Promise.reject(
          new ConnectError("response lost", Code.DeadlineExceeded),
        ),
      ),
    ).rejects.toBeInstanceOf(ApiRequestError);
    expect(dispatchEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ type: "sast-shop:data-changed" }),
    );
  });

  it("does not invalidate resources on read failures", async () => {
    await expect(
      requestLocal("listAddresses", () =>
        Promise.reject(new ConnectError("offline", Code.Unavailable)),
      ),
    ).rejects.toBeInstanceOf(ApiRequestError);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it("signals session expiration on an unauthenticated read", async () => {
    await expect(
      requestLocal("getCurrentUser", () =>
        Promise.reject(new ConnectError("expired", Code.Unauthenticated)),
      ),
    ).rejects.toBeInstanceOf(AuthRequiredError);
    expect(dispatchEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ type: AuthRequiredError.browserEventName }),
    );
  });

  it("signals session expiration and invalidation on an unauthenticated write", async () => {
    await expect(
      requestLocal("payBill", () =>
        Promise.reject(new ConnectError("expired", Code.Unauthenticated)),
      ),
    ).rejects.toBeInstanceOf(AuthRequiredError);
    expect(dispatchEvent.mock.calls.map(([event]) => event.type)).toEqual([
      AuthRequiredError.browserEventName,
      "sast-shop:data-changed",
    ]);
  });
});
