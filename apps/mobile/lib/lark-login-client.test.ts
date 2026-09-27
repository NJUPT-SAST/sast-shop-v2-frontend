import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LarkClientApi, LarkH5Sdk } from "@sast-shop/api";

import { waitForLarkLoginClient } from "./lark-login-client";

describe("waitForLarkLoginClient", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits for a late SDK and for its real ready callback", async () => {
    const environment: { h5sdk?: LarkH5Sdk; tt?: LarkClientApi } = {};
    let onReady: (() => void) | undefined;
    const resolved = vi.fn();
    const result = waitForLarkLoginClient(environment).then(resolved);
    await vi.advanceTimersByTimeAsync(200);
    expect(resolved).not.toHaveBeenCalled();

    environment.h5sdk = {
      ready: (callback) => {
        onReady = callback;
      },
    };
    environment.tt = { requestAccess: vi.fn() };
    await vi.advanceTimersByTimeAsync(200);
    expect(resolved).not.toHaveBeenCalled();
    onReady?.();
    await vi.advanceTimersByTimeAsync(50);
    await result;
    expect(resolved).toHaveBeenCalledWith(environment.tt);
    expect(environment.tt.requestAccess).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits for the native login API after SDK readiness", async () => {
    const environment: { h5sdk?: LarkH5Sdk; tt?: LarkClientApi } = {
      h5sdk: { ready: (callback) => callback() },
      tt: {},
    };
    const result = waitForLarkLoginClient(environment);
    await vi.advanceTimersByTimeAsync(100);
    environment.tt = { requestAuthCode: vi.fn() };
    await vi.advanceTimersByTimeAsync(50);
    await expect(result).resolves.toBe(environment.tt);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports a failed SDK load without misidentifying the client", async () => {
    const result = expect(waitForLarkLoginClient({})).rejects.toThrow(
      "飞书登录组件加载失败",
    );
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not accept login methods before the native ready callback", async () => {
    const result = expect(
      waitForLarkLoginClient({
        h5sdk: { ready: () => undefined },
        tt: { requestAccess: vi.fn() },
      }),
    ).rejects.toThrow("飞书客户端初始化超时");
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports a missing login API after SDK readiness", async () => {
    const result = expect(
      waitForLarkLoginClient({
        h5sdk: { ready: (callback) => callback() },
        tt: {},
      }),
    ).rejects.toThrow("飞书登录接口未就绪");
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("only identifies a normal browser when the loaded SDK explicitly does", async () => {
    await expect(
      waitForLarkLoginClient({
        h5sdk: {
          browser: { versions: { mobileFeishu: false, PCFeishu: false } },
          ready: vi.fn(),
        },
      }),
    ).rejects.toThrow("请在飞书客户端内打开该应用");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("allows retry after an earlier SDK timeout", async () => {
    const environment: { h5sdk?: LarkH5Sdk; tt?: LarkClientApi } = {};
    const first = expect(waitForLarkLoginClient(environment)).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(15_000);
    await first;
    environment.h5sdk = { ready: (callback) => callback() };
    environment.tt = { requestAccess: vi.fn() };
    await expect(waitForLarkLoginClient(environment)).resolves.toBe(
      environment.tt,
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up if SDK initialization throws", async () => {
    await expect(
      waitForLarkLoginClient({
        h5sdk: {
          ready: () => {
            throw new Error("bridge unavailable");
          },
        },
      }),
    ).rejects.toThrow("飞书客户端初始化失败");
    expect(vi.getTimerCount()).toBe(0);
  });
});
