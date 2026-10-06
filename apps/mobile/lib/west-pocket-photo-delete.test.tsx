// @vitest-environment jsdom

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PocketPhotoDeleteDialog } from "../components/west-pocket/photo-delete-dialog";

const { deletePocketPhoto, getPocket, ensureAgreement, onClose, onDeleted } =
  vi.hoisted(() => ({
    deletePocketPhoto: vi.fn(),
    getPocket: vi.fn(),
    ensureAgreement: vi.fn(),
    onClose: vi.fn(),
    onDeleted: vi.fn(),
  }));

vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  deletePocketPhoto,
  getPocket,
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement }),
}));
vi.mock("@workspace/ui/components/drawer", () => {
  const Section = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Drawer: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? <div>{children}</div> : null,
    DrawerContent: Section,
    DrawerDescription: Section,
    DrawerFooter: Section,
    DrawerHeader: Section,
    DrawerTitle: Section,
  };
});

let root: Root;
let container: HTMLDivElement;

async function mount() {
  await act(async () =>
    root.render(
      <PocketPhotoDeleteDialog
        pocketId="12"
        photoId="25"
        onClose={onClose}
        onDeleted={onDeleted}
      />,
    ),
  );
}

function button(text: string) {
  const result = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text,
  );
  expect(result).toBeDefined();
  return result!;
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  deletePocketPhoto.mockReset().mockResolvedValue(undefined);
  getPocket
    .mockReset()
    .mockResolvedValue({ photos: [{ id: "25", status: "ready" }] });
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

describe("Pocket photo deletion confirmation", () => {
  it("does not delete merely by opening the confirmation", async () => {
    await mount();
    expect(button("确认删除").disabled).toBe(false);
    expect(deletePocketPhoto).not.toHaveBeenCalled();
    expect(getPocket).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the photo and closes when retention is chosen", async () => {
    await mount();
    await act(async () => button("保留照片").click());
    expect(deletePocketPhoto).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("prevents repeated confirmations while a deletion is pending", async () => {
    let finish!: () => void;
    const response = new Promise<void>((resolve) => {
      finish = resolve;
    });
    deletePocketPhoto.mockReturnValue(response);
    await mount();
    const confirm = button("确认删除");
    await act(async () => {
      confirm.click();
      confirm.click();
    });
    expect(deletePocketPhoto).toHaveBeenCalledOnce();
    expect(confirm.disabled).toBe(true);
    expect(button("保留照片").disabled).toBe(true);
    expect(ensureAgreement).not.toHaveBeenCalled();
    await act(async () => {
      finish();
      await response;
    });
    expect(onDeleted).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("checks actual photo state after a lost response and closes without resending deletion", async () => {
    const photos = new Set(["25"]);
    deletePocketPhoto.mockImplementation(
      async ({ photoId }: { photoId: string }) => {
        photos.delete(photoId);
        throw new Error("response lost");
      },
    );
    getPocket.mockImplementation(async () => ({
      photos: [...photos].map((id) => ({ id, status: "ready" })),
    }));
    await mount();
    await act(async () => button("确认删除").click());
    expect(deletePocketPhoto).toHaveBeenCalledOnce();
    expect(getPocket).toHaveBeenCalledExactlyOnceWith("12", {});
    expect(photos.size).toBe(0);
    expect(onDeleted).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
