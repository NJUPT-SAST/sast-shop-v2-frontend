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
  it("ignores late file selection after consent is revoked or an upload begins", async () => {
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
        .querySelector("button[aria-label]")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(onChange).toHaveBeenLastCalledWith([]);
    await mount();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      "blob:pocket-selected",
    );
  });
});
