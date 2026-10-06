// @vitest-environment jsdom

import React, { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  usePocketAction,
  usePocketResource,
} from "../components/west-pocket/shared";

const { ensureAgreement } = vi.hoisted(() => ({ ensureAgreement: vi.fn() }));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement }),
}));

let root: Root;
let container: HTMLDivElement;
let action: ReturnType<typeof usePocketAction>;
let resource: ReturnType<typeof usePocketResource<string>>;

function ActionHarness({ reconcile }: { reconcile?: () => Promise<boolean> }) {
  const current = usePocketAction({ transaction: true, reconcile });
  useEffect(() => {
    action = current;
  });
  return <span>{current.busy ? "busy" : "ready"}</span>;
}

function ResourceHarness({ load }: { load: () => Promise<string> }) {
  const current = usePocketResource(load);
  useEffect(() => {
    resource = current;
  });
  return <span>{current.data}</span>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  ensureAgreement.mockReset().mockResolvedValue(true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("Pocket transaction action recovery", () => {
  it("waits for agreement and blocks repeated clicks while it is pending", async () => {
    const consent = deferred<boolean>();
    ensureAgreement.mockReturnValue(consent.promise);
    await act(async () => root.render(<ActionHarness />));
    const write = vi.fn(async () => {});
    let pending!: Promise<void>;
    await act(async () => {
      pending = action.run("publish:1", write);
      await action.run("publish:1", write);
    });
    expect(write).not.toHaveBeenCalled();
    expect(ensureAgreement).toHaveBeenCalledOnce();
    await act(async () => {
      consent.resolve(false);
      await pending;
    });
    expect(write).not.toHaveBeenCalled();
    expect(action.busy).toBe(false);
  });

  it("keeps writes locked after an unknown result until a successful refresh", async () => {
    const reconcile = vi.fn().mockResolvedValue(false);
    await act(async () => root.render(<ActionHarness reconcile={reconcile} />));
    const write = vi.fn().mockRejectedValue(new Error("response lost"));
    await act(async () => {
      await action.run("pay:1", write);
    });
    const requestId = write.mock.calls[0]![0];
    expect(reconcile).toHaveBeenCalledOnce();
    expect(action.pending).toBe(true);
    expect(action.busy).toBe(true);
    await act(async () => {
      await action.run("pay:1", write);
    });
    expect(write).toHaveBeenCalledOnce();
    reconcile.mockResolvedValue(true);
    await act(async () => {
      await action.recover();
    });
    expect(action.pending).toBe(false);
    expect(action.busy).toBe(false);
    write.mockResolvedValue(undefined);
    await act(async () => {
      await action.run("pay:1", write);
    });
    expect(write.mock.calls[1]![0]).toBe(requestId);
  });

  it("does not inherit transaction recovery when a read explicitly overrides it", async () => {
    const reconcile = vi.fn().mockResolvedValue(false);
    await act(async () => root.render(<ActionHarness reconcile={reconcile} />));
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error("网络连接失败"))
      .mockResolvedValue(undefined);
    const options = { transaction: false, reconcile: undefined };
    await act(async () => {
      await action.run("search:next-page", read, options);
    });
    expect(read).toHaveBeenCalledOnce();
    expect(ensureAgreement).not.toHaveBeenCalled();
    expect(reconcile).not.toHaveBeenCalled();
    expect(action.error).toBe("网络连接失败");
    expect(action.pending).toBe(false);
    expect(action.busy).toBe(false);
    await act(async () => {
      await action.run("search:next-page", read, options);
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(action.error).toBe("");
    expect(action.pending).toBe(false);
    expect(action.busy).toBe(false);
  });

  it("does not start a write if its page was closed while requesting agreement", async () => {
    const consent = deferred<boolean>();
    ensureAgreement.mockReturnValue(consent.promise);
    await act(async () => root.render(<ActionHarness />));
    const write = vi.fn(async () => {});
    let pending!: Promise<void>;
    await act(async () => {
      pending = action.run("publish:1", write);
    });
    await act(async () => root.unmount());
    await act(async () => {
      consent.resolve(true);
      await pending;
    });
    expect(write).not.toHaveBeenCalled();
  });

  it("does not refresh a closed page when a write fails after leaving it", async () => {
    const response = deferred<void>();
    const reconcile = vi.fn().mockResolvedValue(true);
    await act(async () => root.render(<ActionHarness reconcile={reconcile} />));
    let pending!: Promise<void>;
    await act(async () => {
      pending = action.run("update:1", () => response.promise);
    });
    await act(async () => root.render(null));
    await act(async () => {
      response.reject(new Error("response lost"));
      await pending;
    });
    expect(reconcile).not.toHaveBeenCalled();
  });
});

describe("Pocket resource refresh", () => {
  it("shares slow refreshes instead of restarting them on every poll", async () => {
    const response = deferred<string>();
    const load = vi.fn(() => response.promise);
    await act(async () => root.render(<ResourceHarness load={load} />));
    const first = resource.refresh();
    const second = resource.refresh();
    expect(first).toBe(second);
    expect(load).toHaveBeenCalledOnce();
    await act(async () => {
      response.resolve("fresh");
      await first;
    });
    expect(resource.data).toBe("fresh");
  });

  it("does not overwrite a mutation response with an earlier pending read", async () => {
    const response = deferred<string>();
    const load = () => response.promise;
    await act(async () => root.render(<ResourceHarness load={load} />));
    await act(async () => resource.setData("written"));
    await act(async () => {
      response.resolve("old");
      await response.promise;
    });
    expect(resource.data).toBe("written");
  });

  it("starts a new read for recovery even if a pre-write poll is still pending", async () => {
    const oldResponse = deferred<string>();
    const freshResponse = deferred<string>();
    const load = vi
      .fn()
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(freshResponse.promise);
    await act(async () => root.render(<ResourceHarness load={load} />));
    const recovery = resource.refreshFresh();
    await act(async () => {
      freshResponse.resolve("submitted");
      await recovery;
    });
    await act(async () => {
      oldResponse.resolve("unpaid");
      await oldResponse.promise;
    });
    expect(load).toHaveBeenCalledTimes(2);
    expect(resource.data).toBe("submitted");
  });

  it("does not apply the previous route's response after its loader changes", async () => {
    const response = deferred<string>();
    const oldLoad = () => response.promise;
    const newLoad = async () => "new route";
    await act(async () => root.render(<ResourceHarness load={oldLoad} />));
    await act(async () => root.render(<ResourceHarness load={newLoad} />));
    await act(async () => {
      response.resolve("old route");
      await response.promise;
    });
    expect(resource.data).toBe("new route");
  });
});
