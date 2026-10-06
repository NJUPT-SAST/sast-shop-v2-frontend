// @vitest-environment jsdom

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PocketFaceProfile } from "@sast-shop/api";
import type { PocketUpload } from "./pocket-upload";
import { PocketFacePage } from "../components/pocket/pocket-face";

const rpc = vi.hoisted(() => ({
  getMyPocketFace: vi.fn(),
  getPocketCapabilities: vi.fn(),
  enrollPocketFace: vi.fn(),
  uploadPocketPhoto: vi.fn(),
}));
vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  getMyPocketFace: rpc.getMyPocketFace,
  getPocketCapabilities: rpc.getPocketCapabilities,
  enrollPocketFace: rpc.enrollPocketFace,
}));
vi.mock("./pocket-upload", () => ({
  uploadPocketPhoto: rpc.uploadPocketPhoto,
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement: vi.fn() }),
}));
vi.mock("../components/brand-illustration", () => ({
  BrandIllustration: () => null,
}));
vi.mock("../components/managed-image", () => ({
  ManagedImage: ({ alt }: { alt: string }) => <span aria-label={alt} />,
}));
vi.mock("@workspace/ui/components/drawer", () => {
  const Section = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Drawer: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? <section role="dialog">{children}</section> : null,
    DrawerContent: Section,
    DrawerDescription: Section,
    DrawerHeader: Section,
    DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    DrawerFooter: Section,
  };
});

let root: Root;
let container: HTMLDivElement;
const photo = new File(["photo"], "face.jpg", { type: "image/jpeg" });
const upload: PocketUpload = {
  uploadId: "55",
  previewUrl: "https://images.test/face.jpg",
  expiresAt: "2099-01-01T00:00:00Z",
};
const profile: PocketFaceProfile = {
  id: "1",
  status: "active",
  revision: "1",
  sampleCount: 1,
  consentVersion: "face-v1",
  consentedAt: "2026-10-07T00:00:00Z",
  consentExpiresAt: "2027-10-07T00:00:00Z",
  revokedAt: null,
  jobId: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function enrollButton() {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "录入",
  );
}

function consent() {
  return container.querySelector<HTMLButtonElement>('[role="checkbox"]')!;
}

async function choose(file = photo) {
  const input = container.querySelector<HTMLInputElement>(
    'input[type="file"][multiple]',
  )!;
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true })),
  );
}

beforeEach(async () => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:face-selected");
      static revokeObjectURL = vi.fn();
    },
  );
  rpc.getMyPocketFace.mockResolvedValue(null);
  rpc.getPocketCapabilities.mockResolvedValue({
    faceRecognitionAvailable: true,
    photoUploadAvailable: true,
    notificationsAvailable: false,
    faceConsentVersion: "face-v1",
    photoConsentVersion: "photo-v1",
    maxPhotos: 10,
    maxMembers: 50,
    maxUploadBytes: 10 * 1024 * 1024,
  });
  rpc.uploadPocketPhoto.mockResolvedValue(upload);
  rpc.enrollPocketFace.mockResolvedValue({ profile, job: null });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<PocketFacePage />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("permits local photo selection before consent without uploading or enrolling", async () => {
  expect(enrollButton()).toBeUndefined();
  expect(consent().getAttribute("aria-checked")).toBe("false");
  expect(
    container.querySelector<HTMLInputElement>('input[type="file"][multiple]')!
      .disabled,
  ).toBe(false);
  await choose();
  expect(container.querySelector('[aria-label="待上传照片 1"]')).not.toBeNull();
  expect(enrollButton()).toBeDefined();
  expect(enrollButton()!.disabled).toBe(true);
  await act(async () => enrollButton()!.click());
  expect(rpc.uploadPocketPhoto).not.toHaveBeenCalled();
  expect(rpc.enrollPocketFace).not.toHaveBeenCalled();
});

it("hides enrollment when the selected photos are cleared", async () => {
  await choose();
  await act(async () => consent().click());
  expect(enrollButton()!.disabled).toBe(false);
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('[aria-label="移除第 1 张照片"]')!
      .click(),
  );
  expect(enrollButton()).toBeUndefined();
  expect(container.querySelector('[aria-label="待上传照片 1"]')).toBeNull();
  expect(rpc.uploadPocketPhoto).not.toHaveBeenCalled();
  expect(rpc.enrollPocketFace).not.toHaveBeenCalled();
});

it("uploads and enrolls only after consent, locking photo changes and repeated submission while busy", async () => {
  const uploaded = deferred<PocketUpload>();
  const enrolled = deferred<{ profile: PocketFaceProfile; job: null }>();
  rpc.uploadPocketPhoto.mockReturnValue(uploaded.promise);
  rpc.enrollPocketFace.mockReturnValue(enrolled.promise);
  await choose();
  await act(async () => consent().click());
  const button = enrollButton()!;
  expect(button.disabled).toBe(false);
  await act(async () => {
    button.click();
    button.click();
  });
  expect(rpc.uploadPocketPhoto).toHaveBeenCalledExactlyOnceWith(photo, {
    purpose: "face_sample",
    consentVersion: "face-v1",
    requestId: expect.any(String),
  });
  expect(rpc.enrollPocketFace).not.toHaveBeenCalled();
  expect(button.disabled).toBe(true);
  expect(consent().disabled).toBe(true);
  const remove = container.querySelector<HTMLButtonElement>(
    '[aria-label="移除第 1 张照片"]',
  )!;
  expect(remove.disabled).toBe(true);
  expect(
    [
      ...container.querySelectorAll<HTMLInputElement>('input[type="file"]'),
    ].every((input) => input.disabled),
  ).toBe(true);
  await choose(new File(["another"], "other.jpg", { type: "image/jpeg" }));
  await act(async () => remove.click());
  expect(container.querySelector('[aria-label="待上传照片 2"]')).toBeNull();
  expect(container.querySelector('[aria-label="待上传照片 1"]')).not.toBeNull();
  await act(async () => {
    uploaded.resolve(upload);
    await uploaded.promise;
  });
  expect(rpc.enrollPocketFace).toHaveBeenCalledExactlyOnceWith(
    {
      uploadIds: ["55"],
      consentVersion: "face-v1",
      requestId: expect.any(String),
      expectedRevision: undefined,
    },
    {},
  );
  expect(button.disabled).toBe(true);
  await act(async () => button.click());
  expect(rpc.uploadPocketPhoto).toHaveBeenCalledOnce();
  expect(rpc.enrollPocketFace).toHaveBeenCalledOnce();
  await act(async () => {
    enrolled.resolve({ profile, job: null });
    await enrolled.promise;
  });
  expect(enrollButton()).toBeUndefined();
  expect(container.querySelector('[aria-label="待上传照片 1"]')).toBeNull();
  expect(consent().getAttribute("aria-checked")).toBe("false");
});
