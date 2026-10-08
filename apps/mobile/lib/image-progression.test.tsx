// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManagedImage as MobileManagedImage } from "../components/managed-image";
import { ManagedImage as DesktopManagedImage } from "../../desktop/components/managed-image";
import {
  imageDisplayCacheKey,
  imageThumbnailSrc,
} from "@workspace/ui/lib/image-variants";
import {
  forgetLoadedImage,
  hasLoadedImage,
  rememberLoadedImage,
} from "@workspace/ui/lib/loaded-images";
import { waitForDrawerHistoryCleanup } from "@workspace/ui/lib/drawer-history";

const { loadCallbacks } = vi.hoisted(() => ({
  loadCallbacks: new Map<string, () => void>(),
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
    sizes,
    quality,
    unoptimized,
    onLoad,
    onError,
  }: {
    src: string;
    alt: string;
    className?: string;
    sizes: string;
    quality: number;
    unoptimized: boolean;
    onLoad: () => void;
    onError: () => void;
  }) => {
    loadCallbacks.set(`${unoptimized}:${src}`, onLoad);
    return React.createElement("img", {
      src,
      alt,
      className,
      "data-sizes": sizes,
      "data-quality": quality,
      "data-unoptimized": String(unoptimized),
      onLoad,
      onError,
    });
  },
}));

const src = "https://example.com/progressive-product.png";
const nextSrc = "https://example.com/progressive-product-next.png";
const blobSrc = "blob:https://example.com/local-upload";
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  for (const value of [src, nextSrc, blobSrc]) {
    forgetLoadedImage(value);
    forgetLoadedImage(imageThumbnailSrc(value));
    forgetLoadedImage(imageDisplayCacheKey(value, "96px"));
    forgetLoadedImage(imageDisplayCacheKey(value, "320px"));
  }
  loadCallbacks.clear();
  window.history.replaceState({ page: "shop" }, "", "/shop");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  await act(async () => waitForDrawerHistoryCleanup());
  container.remove();
  vi.unstubAllGlobals();
});

function image(
  source: string,
  scope: ParentNode = container,
  unoptimized?: boolean,
) {
  return Array.from(scope.querySelectorAll("img")).find(
    (element) =>
      element.getAttribute("src") === source &&
      (unoptimized === undefined ||
        element.dataset.unoptimized === String(unoptimized)),
  );
}

async function event(
  element: HTMLImageElement | undefined,
  type: "load" | "error",
) {
  expect(element).toBeDefined();
  await act(async () => element!.dispatchEvent(new Event(type)));
}

async function openPreview() {
  const trigger = container.querySelector<HTMLButtonElement>(
    '[aria-label="查看商品图片大图"]',
  )!;
  expect(trigger.disabled).toBe(false);
  await act(async () => trigger.click());
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(dialog).not.toBeNull();
  return dialog;
}

describe.each([
  ["mobile", MobileManagedImage],
  ["desktop", DesktopManagedImage],
] as const)("%s image progression", (_name, ManagedImage) => {
  async function render(value = src, sizes = "96px", preview = false) {
    await act(async () =>
      root.render(
        <ManagedImage
          src={value}
          alt="商品图片"
          sizes={sizes}
          preview={preview}
        />,
      ),
    );
  }

  it("requests the thumbnail first, then displays the optimized image and removes the thumbnail", async () => {
    await render(src, "320px");
    const thumbnail = image(imageThumbnailSrc(src))!;
    expect(thumbnail).toBeDefined();
    expect(thumbnail.dataset.unoptimized).toBe("true");
    expect(image(src)).toBeUndefined();
    expect(container.querySelectorAll("img")).toHaveLength(1);

    await event(thumbnail, "load");
    expect(thumbnail.classList.contains("opacity-0")).toBe(false);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
    const display = image(src)!;
    expect(display.dataset.unoptimized).toBe("false");
    expect(display.dataset.sizes).toBe("320px");
    expect(display.dataset.quality).toBe("75");
    expect(display.classList.contains("opacity-0")).toBe(true);

    await event(display, "load");
    expect(display.classList.contains("opacity-0")).toBe(false);
    expect(image(imageThumbnailSrc(src))).toBeUndefined();
    expect(hasLoadedImage(imageDisplayCacheKey(src, "320px"))).toBe(true);
    expect(hasLoadedImage(src)).toBe(false);
  });

  it("loads the display image even when the thumbnail fails", async () => {
    await render();
    await event(image(imageThumbnailSrc(src)), "error");
    expect(image(imageThumbnailSrc(src))).toBeUndefined();
    expect(image(src)?.dataset.unoptimized).toBe("false");
    await event(image(src), "load");
    expect(image(src)?.classList.contains("opacity-0")).toBe(false);
  });

  it("keeps the loaded thumbnail visible when the display image fails", async () => {
    await render();
    await event(image(imageThumbnailSrc(src)), "load");
    await event(image(src), "error");
    expect(image(src)).toBeUndefined();
    expect(image(imageThumbnailSrc(src))?.classList.contains("opacity-0")).toBe(
      false,
    );
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
    expect(hasLoadedImage(imageDisplayCacheKey(src, "96px"))).toBe(false);
  });

  it("ignores old thumbnail and display completions after switching sources", async () => {
    await render();
    const oldThumbnailLoad = loadCallbacks.get(
      `true:${imageThumbnailSrc(src)}`,
    )!;
    await event(image(imageThumbnailSrc(src)), "load");
    const oldDisplayLoad = loadCallbacks.get(`false:${src}`)!;
    await render(nextSrc);
    await act(async () => {
      oldThumbnailLoad();
      oldDisplayLoad();
    });
    expect(image(src)).toBeUndefined();
    expect(image(nextSrc)).toBeUndefined();
    expect(
      image(imageThumbnailSrc(nextSrc))?.classList.contains("opacity-0"),
    ).toBe(true);
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(hasLoadedImage(imageDisplayCacheKey(nextSrc, "96px"))).toBe(false);
    await event(image(imageThumbnailSrc(nextSrc)), "load");
    await event(image(nextSrc), "load");
    expect(image(nextSrc)?.classList.contains("opacity-0")).toBe(false);
  });

  it("skips thumbnails for a loaded display size and separates other display sizes", async () => {
    rememberLoadedImage(imageDisplayCacheKey(src, "96px"));
    await render();
    expect(image(imageThumbnailSrc(src))).toBeUndefined();
    expect(image(src)?.classList.contains("opacity-0")).toBe(false);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
    await render(src, "320px");
    expect(image(imageThumbnailSrc(src))).toBeDefined();
    expect(image(src)).toBeUndefined();
  });

  it("mounts the original only in preview, independently of the loaded display cache", async () => {
    rememberLoadedImage(imageDisplayCacheKey(src, "96px"));
    await render(src, "96px", true);
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(image(src, container, true)).toBeUndefined();
    expect(hasLoadedImage(src)).toBe(false);

    const dialog = await openPreview();
    const original = image(src, dialog, true)!;
    expect(original).toBeDefined();
    expect(original.classList.contains("opacity-0")).toBe(true);
    expect(image(src, dialog, false)?.classList.contains("opacity-0")).toBe(
      false,
    );
    await event(original, "load");
    expect(original.classList.contains("opacity-0")).toBe(false);
    expect(image(src, dialog, false)).toBeUndefined();
    expect(hasLoadedImage(src)).toBe(true);
  });

  it("preserves a display fallback when the original fails and retries it on reopening", async () => {
    rememberLoadedImage(imageDisplayCacheKey(src, "96px"));
    await render(src, "96px", true);
    let dialog = await openPreview();
    await event(image(src, dialog, true), "error");
    expect(image(src, dialog, true)).toBeUndefined();
    expect(image(src, dialog, false)?.classList.contains("opacity-0")).toBe(
      false,
    );
    expect(dialog.querySelector('[role="status"]')?.textContent).toContain(
      "原图加载失败",
    );
    expect(hasLoadedImage(imageDisplayCacheKey(src, "96px"))).toBe(true);
    expect(hasLoadedImage(src)).toBe(false);
    await act(async () =>
      dialog
        .querySelector<HTMLButtonElement>('[aria-label="关闭图片预览"]')!
        .click(),
    );
    dialog = await openPreview();
    expect(image(src, dialog, true)).toBeDefined();
    await event(image(src, dialog, true), "load");
    expect(dialog.querySelector('[role="status"]')).toBeNull();
  });

  it("leaves a local blob upload source untransformed", async () => {
    await render(blobSrc);
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(image(blobSrc)?.dataset.unoptimized).toBe("true");
    expect(image(imageThumbnailSrc(blobSrc))).toBeUndefined();
    await event(image(blobSrc), "load");
    expect(image(blobSrc)?.classList.contains("opacity-0")).toBe(false);
    expect(hasLoadedImage(blobSrc)).toBe(true);
  });
});
