// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AdminRequestError, type AdminCorrection } from "@sast-shop/api";
import { AdminCorrectionRecovery } from "../components/admin/admin-correction-recovery";

const api = vi.hoisted(() => ({
  execute: vi.fn(),
  get: vi.fn(),
  changed: vi.fn(),
}));
vi.mock("@sast-shop/api", async (original) => ({
  ...(await original<typeof import("@sast-shop/api")>()),
  executeAdminCorrection: api.execute,
  getAdminCorrection: api.get,
}));
vi.mock("../components/admin/admin-session", () => ({
  useAdminSession: () => ({
    options: {},
    identity: { id: "1", capabilities: ["corrections.execute"] },
  }),
}));
const correction: AdminCorrection = {
  id: "case-1",
  resource: "spot_order",
  resourceId: "31",
  action: "reopen",
  status: "needs_attention",
  reason: "核对历史记录",
  evidence: "凭据123",
  actorId: "1",
  round: "2",
  createdAt: null,
  updatedAt: null,
  steps: [],
  impacts: [],
  error: "",
  digest: "original-digest",
  requestId: "original-request",
};
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("resumes only the original durable request and reconciles a lost response before allowing another write", async () => {
  api.execute.mockRejectedValueOnce(new AdminRequestError("请求超时", true));
  api.get.mockRejectedValueOnce(new AdminRequestError("查询暂不可用", true));
  await act(async () =>
    root.render(
      <AdminCorrectionRecovery
        domain="spot"
        correction={correction}
        onChanged={api.changed}
      />,
    ),
  );
  const continueButton = () =>
    Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "继续此处理",
    );
  expect(continueButton()!.disabled).toBe(true);
  await act(async () =>
    container.querySelector<HTMLElement>('[role="checkbox"]')!.click(),
  );
  await act(async () => continueButton()!.click());
  expect(api.execute).toHaveBeenCalledExactlyOnceWith(
    "spot",
    {
      previewId: "case-1",
      digest: "original-digest",
      requestId: "original-request",
    },
    {},
  );
  expect(api.get).toHaveBeenCalledExactlyOnceWith("spot", "case-1", {});
  expect(continueButton()).toBeUndefined();
  expect(container.textContent).toContain("结果尚未确认");
  api.get.mockResolvedValueOnce({ ...correction, status: "completed" });
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "核实处理进度")!
      .click(),
  );
  expect(container.textContent).toContain("已完成");
  expect(api.execute).toHaveBeenCalledTimes(1);
});

it("reuses the persisted request after remount when the server still reports an unexecuted preview", async () => {
  const preview = {
    ...correction,
    id: "not-received-case",
    status: "preview",
    requestId: "",
  };
  api.execute.mockRejectedValueOnce(new AdminRequestError("连接中断", true));
  api.get.mockRejectedValueOnce(new AdminRequestError("网络不可用", true));
  async function submit() {
    await act(async () =>
      container.querySelector<HTMLElement>('[role="checkbox"]')!.click(),
    );
    await act(async () =>
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "继续此处理")!
        .click(),
    );
  }
  await act(async () =>
    root.render(
      <AdminCorrectionRecovery
        domain="spot"
        correction={preview}
        onChanged={api.changed}
      />,
    ),
  );
  await submit();
  const requestId = api.execute.mock.calls[0]![1].requestId;
  await act(async () => root.unmount());
  root = createRoot(container);
  api.execute.mockResolvedValueOnce({
    ...preview,
    requestId,
    status: "completed",
  });
  api.get.mockResolvedValueOnce({ ...preview, requestId, status: "completed" });
  await act(async () =>
    root.render(
      <AdminCorrectionRecovery
        domain="spot"
        correction={preview}
        onChanged={api.changed}
      />,
    ),
  );
  await submit();
  expect(api.execute.mock.calls[1]![1].requestId).toBe(requestId);
  expect(api.execute.mock.calls[1]![1].previewId).toBe("not-received-case");
});
