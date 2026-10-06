// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PocketPhotoPicker,
  type SelectedPocketPhoto,
} from "../components/pocket/photo-picker";

let root: Root;
let container: HTMLDivElement;
const onChange = vi.fn();
const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();

async function mount(disabled = false, photos: SelectedPocketPhoto[] = []) {
  await act(async () =>
    root.render(
      <PocketPhotoPicker
        photos={photos}
        onChange={onChange}
        maxPhotos={3}
        disabled={disabled}
      />,
    ),
  );
}

async function choose(files: File[]) {
  const input = container.querySelectorAll("input")[1]!;
  Object.defineProperty(input, "files", { configurable: true, value: files });
  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true })),
  );
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  onChange.mockReset();
  createObjectURL.mockReset().mockReturnValue("blob:pocket-selected");
  revokeObjectURL.mockReset();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    },
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("Pocket photo picker", () => {
  it.each([
    ["拍照", 0],
    ["从相册选择", 1],
  ] as const)(
    "opens the %s file chooser from the add button",
    async (label, index) => {
      await mount();
      const input = container.querySelectorAll("input")[index]!;
      const openChooser = vi.spyOn(input, "click").mockImplementation(() => {});
      await act(async () =>
        container
          .querySelector<HTMLButtonElement>('[aria-label="添加照片"]')!
          .click(),
      );
      const dialog = document.querySelector('[role="dialog"]')!;
      expect(dialog).not.toBeNull();
      const source = Array.from(dialog.querySelectorAll("button")).find(
        (button) => button.textContent === label,
      )!;
      await act(async () => source.click());
      expect(openChooser).toHaveBeenCalledOnce();
      expect(dialog.getAttribute("data-state")).toBe("closed");
      expect(onChange).not.toHaveBeenCalled();
      openChooser.mockRestore();
    },
  );

  it("ignores an empty selection and restores adding after a photo is removed", async () => {
    await mount();
    await choose([]);
    expect(onChange).not.toHaveBeenCalled();
    createObjectURL
      .mockImplementationOnce(() => "blob:1")
      .mockImplementationOnce(() => "blob:2")
      .mockImplementationOnce(() => "blob:3");
    await choose(
      Array.from(
        { length: 3 },
        (_, index) =>
          new File(["photo"], `${index}.jpg`, { type: "image/jpeg" }),
      ),
    );
    const selected: SelectedPocketPhoto[] = onChange.mock.calls[0]![0];
    await mount(false, selected);
    expect(container.querySelector('[aria-label="添加照片"]')).toBeNull();
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="移除第 1 张照片"]')!
        .click(),
    );
    await mount(false, onChange.mock.lastCall![0]);
    expect(container.querySelector('[aria-label="添加照片"]')).not.toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:1");
  });

  it("ignores late file selection when the picker becomes disabled", async () => {
    await mount();
    await mount(true);
    await choose([new File(["photo"], "photo.jpg", { type: "image/jpeg" })]);
    expect(onChange).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("validates the full selection before allocating previews and permits another selection", async () => {
    await mount();
    await choose([
      new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
      new File(["invalid"], "photo.heic", { type: "image/heic" }),
    ]);
    expect(onChange).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
    await choose([file]);
    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      { id: expect.any(String), file, previewUrl: "blob:pocket-selected" },
    ]);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await mount(false, onChange.mock.calls[0]![0]);
    await act(async () =>
      container
        .querySelector('button[aria-label="移除第 1 张照片"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(onChange).toHaveBeenLastCalledWith([]);
    await mount();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      "blob:pocket-selected",
    );
  });
});
