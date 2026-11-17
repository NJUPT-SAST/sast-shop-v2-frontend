// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminRequestError, type AdminRecord } from "@sast-shop/api";
import { AdminActionDialog } from "../components/admin/admin-action";

const api = vi.hoisted(() => ({
  mutate: vi.fn(),
  preview: vi.fn(),
  execute: vi.fn(),
  correction: vi.fn(),
  audit: vi.fn(),
  changed: vi.fn(),
  close: vi.fn(),
}));
vi.mock("@sast-shop/api", async (original) => ({
  ...(await original<typeof import("@sast-shop/api")>()),
  mutateAdminRecord: api.mutate,
  previewAdminCorrection: api.preview,
  executeAdminCorrection: api.execute,
  getAdminCorrection: api.correction,
  listAdminAudit: api.audit,
}));
vi.mock("../components/admin/admin-session", () => ({
  useAdminSession: () => ({
    options: { connectBaseUrl: "https://shop.test/api/admin/connect" },
    identity: {
      id: "1",
      role: "superadmin",
      capabilities: ["corrections.execute"],
    },
  }),
}));
const record: AdminRecord = {
  resource: "bill",
  id: "12",
  title: "测试账单",
  status: "submitted",
  ownerId: "1",
  createdAt: null,
  updatedAt: "2026-11-11T01:02:03Z",
  round: "2",
  amountCents: 990,
  fields: [],
  allowedActions: ["confirm_payment"],
};
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  api.preview.mockResolvedValue({
    id: "preview-1",
    digest: "digest",
    expiresAt: "2099-01-01T00:00:00Z",
    record,
    impacts: [],
    warnings: [],
    restorationFields: [],
  });
  api.audit.mockResolvedValue({ entries: [], total: 0 });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
async function render(action = "confirm_payment", target = record) {
  await act(async () =>
    root.render(
      <AdminActionDialog
        record={target}
        action={action}
        onChanged={api.changed}
        onClose={api.close}
      />,
    ),
  );
  await fill("admin-reason", "已核查订单");
  await fill("admin-evidence", "核查流水 123");
}
async function fill(id: string, value: string) {
  const input = document.getElementById(id) as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => {
    document
      .getElementById("admin-action-form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
function button(text: string) {
  const found = Array.from(document.querySelectorAll("button")).find(
    (item) => item.textContent === text,
  );
  if (!found) throw new Error(`Missing button ${text}`);
  return found;
}
describe("admin action safety and recovery", () => {
  it.each(["errand_task", "pocket"] as const)(
    "requires an explicit mixed-payment verification for %s",
    async (resource) => {
      await render("cancel", {
        ...record,
        resource,
        fields: [
          { key: "funds_handling", label: "资金处理", value: "refunded" },
          {
            key: "submitted_unreceived_confirmed",
            label: "历史核实",
            value: "true",
          },
        ],
      });
      const checkbox = document.getElementById(
        "admin-submitted_unreceived_confirmed",
      )!;
      expect(checkbox.getAttribute("aria-checked")).toBe("false");
      await submit();
      expect(api.preview.mock.calls[0][0].values).toMatchObject({
        submitted_unreceived_confirmed: "",
      });
      await act(async () => checkbox.click());
      expect(document.body.textContent).not.toContain("按此预览执行");
      await submit();
      expect(api.preview.mock.calls[1][0].values).toMatchObject({
        submitted_unreceived_confirmed: "true",
      });
    },
  );
  it("requires a reviewed preview and invalidates it when the evidence changes", async () => {
    await render();
    await submit();
    expect(api.preview).toHaveBeenCalledOnce();
    expect(api.execute).not.toHaveBeenCalled();
    expect(button("按此预览执行").disabled).toBe(false);
    await fill("admin-evidence", "更正后的核查流水 456");
    expect(document.body.textContent).not.toContain("按此预览执行");
  });
  it("locks an uncertain mutation and queries the original request instead of resubmitting", async () => {
    api.mutate.mockRejectedValueOnce(new AdminRequestError("连接已断开", true));
    await render("block");
    await submit();
    expect(api.mutate).toHaveBeenCalledOnce();
    const requestId = api.mutate.mock.calls[0][0].requestId;
    expect(button("关闭").disabled).toBe(true);
    await act(async () => button("核实执行结果").click());
    expect(api.audit.mock.calls[0][1]).toMatchObject({
      requestId,
      resourceId: "12",
    });
    expect(api.mutate).toHaveBeenCalledOnce();
    expect(api.changed).not.toHaveBeenCalled();
  });
  it("resolves a lost execution response by its persisted preview identifier", async () => {
    api.execute.mockRejectedValueOnce(new AdminRequestError("请求超时", true));
    api.correction.mockResolvedValueOnce({
      id: "preview-1",
      resource: "bill",
      resourceId: "12",
      action: "confirm_payment",
      status: "completed",
      reason: "已核查",
      evidence: "123",
      actorId: "1",
      round: "2",
      createdAt: null,
      updatedAt: null,
      steps: [],
      impacts: [],
      error: "",
    });
    await render();
    await submit();
    await act(async () => button("按此预览执行").click());
    expect(api.correction.mock.calls[0].slice(0, 2)).toEqual([
      "payment",
      "preview-1",
    ]);
    expect(api.execute).toHaveBeenCalledOnce();
    expect(api.changed).toHaveBeenCalledOnce();
  });
  it("prevents duplicate writes while a request is pending", async () => {
    let complete!: () => void;
    api.mutate.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    await render("block");
    await submit();
    await submit();
    expect(api.mutate).toHaveBeenCalledOnce();
    await act(async () => complete());
    expect(api.changed).toHaveBeenCalledOnce();
  });
});

it("does not execute or regenerate a request when browser intent storage is unavailable", async () => {
  await render();
  await submit();
  const storage = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new DOMException("Storage blocked");
    });
  try {
    await act(async () => button("按此预览执行").click());
    expect(api.execute).not.toHaveBeenCalled();
    expect(button("按此预览执行").disabled).toBe(true);
    expect(document.body.textContent).toContain("尚未提交执行");
    await act(async () => button("按此预览执行").click());
    expect(api.execute).not.toHaveBeenCalled();
  } finally {
    storage.mockRestore();
  }
});
