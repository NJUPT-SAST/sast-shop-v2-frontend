// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  window.sessionStorage.clear();
  vi.resetModules();
});
afterEach(() => {
  vi.restoreAllMocks();
});

it("keeps an unsent execution identifier through reload and isolates users, domains and cases", async () => {
  const first = await import("./admin-execution-intent");
  const requestId = first.getAdminExecutionRequestId(
    "user-1",
    "spot",
    "preview-1",
  );
  vi.resetModules();
  const reloaded = await import("./admin-execution-intent");
  expect(
    reloaded.getAdminExecutionRequestId("user-1", "spot", "preview-1"),
  ).toBe(requestId);
  expect(
    reloaded.getAdminExecutionRequestId("user-2", "spot", "preview-1"),
  ).not.toBe(requestId);
  expect(
    reloaded.getAdminExecutionRequestId("user-1", "errand", "preview-1"),
  ).not.toBe(requestId);
  expect(
    reloaded.getAdminExecutionRequestId("user-1", "spot", "preview-2"),
  ).not.toBe(requestId);
  expect(
    reloaded.getAdminExecutionRequestId(
      "user-1",
      "spot",
      "preview-1",
      "server-authoritative",
    ),
  ).toBe("server-authoritative");
  expect(
    reloaded.getAdminExecutionRequestId("user-1", "spot", "preview-1"),
  ).toBe("server-authoritative");
});

it("never returns a new execution identifier unless intent was persisted, and does not mint repeated IDs", async () => {
  const helper = await import("./admin-execution-intent");
  const uuid = vi.spyOn(crypto, "randomUUID");
  vi.spyOn(Object.getPrototypeOf(window.sessionStorage), "setItem").mockImplementation(() => {
    throw new DOMException("Storage blocked");
  });
  expect(() =>
    helper.getAdminExecutionRequestId("user-1", "spot", "blocked-case"),
  ).toThrow(helper.AdminExecutionIntentError);
  expect(() =>
    helper.getAdminExecutionRequestId("user-1", "spot", "blocked-case"),
  ).toThrow(helper.AdminExecutionIntentError);
  expect(uuid).toHaveBeenCalledOnce();
  // An already durable server request remains safely recoverable without browser storage.
  expect(
    helper.getAdminExecutionRequestId(
      "user-1",
      "spot",
      "server-case",
      "durable-request",
    ),
  ).toBe("durable-request");
});
