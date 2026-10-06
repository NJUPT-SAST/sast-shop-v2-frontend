// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PocketCreate } from "../components/west-pocket/pocket-create";

const { createPocket, getPocketCapabilities, ensureAgreement, replace } =
  vi.hoisted(() => ({
    createPocket: vi.fn(),
    getPocketCapabilities: vi.fn(),
    ensureAgreement: vi.fn(),
    replace: vi.fn(),
  }));

vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  createPocket,
  getPocketCapabilities,
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

let root: Root;
let container: HTMLDivElement;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function mount() {
  await act(async () => root.render(<PocketCreate />));
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    const amount = container.querySelector<HTMLInputElement>("#pocket-total")!;
    setValue.call(amount, "100.01");
    amount.dispatchEvent(new Event("input", { bubbles: true }));
    const title = container.querySelector<HTMLInputElement>("#pocket-title")!;
    setValue.call(title, "  周五晚饭  ");
    title.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function submit() {
  container
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  createPocket.mockReset().mockResolvedValue({ id: "12" });
  ensureAgreement.mockReset().mockResolvedValue(true);
  getPocketCapabilities.mockReset().mockResolvedValue({
    faceRecognitionAvailable: false,
    photoUploadAvailable: false,
    notificationsAvailable: false,
    faceConsentVersion: "face-v1",
    photoConsentVersion: "photo-v1",
    maxPhotos: 10,
    maxMembers: 50,
    maxUploadBytes: 10 * 1024 * 1024,
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("Pocket create transaction flow", () => {
  it("does not create an activity when the transaction agreement is rejected", async () => {
    ensureAgreement.mockResolvedValue(false);
    await mount();
    await act(async () => submit());
    expect(ensureAgreement).toHaveBeenCalledOnce();
    expect(createPocket).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')!
        .disabled,
    ).toBe(false);
  });

  it("locks repeated form submissions until the create response arrives", async () => {
    const response = deferred<{ id: string }>();
    createPocket.mockReturnValue(response.promise);
    await mount();
    await act(async () => {
      submit();
      submit();
    });
    await act(async () => submit());
    expect(createPocket).toHaveBeenCalledOnce();
    expect(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')!
        .disabled,
    ).toBe(true);
    await act(async () => {
      response.resolve({ id: "12" });
      await response.promise;
    });
    expect(replace).toHaveBeenCalledExactlyOnceWith("/west-pocket/12/capture");
  });

  it("reconciles a lost response with the same UUID and payload before unlocking", async () => {
    type CreateInput = { title: string; totalCents: number; requestId: string };
    const activities = new Map<string, { input: CreateInput; id: string }>();
    let responsesLost = 2;
    createPocket.mockImplementation(async (input: CreateInput) => {
      const existing = activities.get(input.requestId);
      if (existing) expect(input).toEqual(existing.input);
      else activities.set(input.requestId, { input: { ...input }, id: "12" });
      if (responsesLost-- > 0) throw new Error("response lost");
      return { id: activities.get(input.requestId)!.id };
    });
    await mount();
    await act(async () => submit());
    expect(createPocket).toHaveBeenCalledTimes(2);
    expect(activities.size).toBe(1);
    expect(replace).not.toHaveBeenCalled();
    expect(
      container.querySelector<HTMLInputElement>("#pocket-total")!.disabled,
    ).toBe(true);
    await act(async () => submit());
    expect(createPocket).toHaveBeenCalledTimes(2);
    const retry = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "重新加载",
    )!;
    await act(async () => retry.click());
    expect(createPocket).toHaveBeenCalledTimes(3);
    expect(activities.size).toBe(1);
    const inputs = createPocket.mock.calls.map(
      ([input]) => input as CreateInput,
    );
    expect(
      inputs.every((input) => input.requestId === inputs[0]!.requestId),
    ).toBe(true);
    expect(inputs[0]).toEqual({
      title: "周五晚饭",
      totalCents: 10001,
      requestId: expect.any(String),
    });
    expect(replace).toHaveBeenCalledExactlyOnceWith("/west-pocket/12/capture");
  });

  it("does not redirect after the page was left while creation was pending", async () => {
    const response = deferred<{ id: string }>();
    createPocket.mockReturnValue(response.promise);
    await mount();
    await act(async () => submit());
    expect(createPocket).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
    await act(async () => {
      response.resolve({ id: "12" });
      await response.promise;
    });
    expect(replace).not.toHaveBeenCalled();
  });
});
