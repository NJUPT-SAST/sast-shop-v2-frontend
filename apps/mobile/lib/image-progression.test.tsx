// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManagedImage as MobileManagedImage } from "../components/managed-image";
import { ManagedImage as DesktopManagedImage } from "../../desktop/components/managed-image";
import {
  imageDisplayCacheKey,
  imageOptimizationSrc,
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
    src: string | { src: string };
    alt: string;
    className?: string;
    sizes: string;
    quality: number;
    unoptimized: boolean;
    onLoad?: () => void;
    onError?: () => void;
  }) => {
    const source = typeof src === "string" ? src : src.src;
    if (onLoad) loadCallbacks.set(`${unoptimized}:${source}`, onLoad);
    return React.createElement("img", {
      src: source,
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
const productSrc = `https://api.sast.fun/images/sast-shop/products/${"a".repeat(64)}.png`;
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  for (const value of [src, nextSrc, blobSrc, productSrc]) {
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
  async function render(
    value = src,
    sizes = "96px",
    preview = false,
    soldOut = false,
  ) {
    await act(async () =>
      root.render(
        <ManagedImage
          src={value}
          alt="商品图片"
          sizes={sizes}
          preview={preview}
          soldOut={soldOut}
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

  it("optimizes stored product images through the same origin and previews their original URL", async () => {
    await render(productSrc, "320px", true);
    await event(image(imageThumbnailSrc(productSrc)), "load");
    const display = image(imageOptimizationSrc(productSrc))!;
    expect(display.dataset.unoptimized).toBe("false");
    await event(display, "load");
    const dialog = await openPreview();
    expect(image(productSrc, dialog, true)).toBeDefined();
    await event(image(productSrc, dialog, true), "load");
    expect(
      image(productSrc, dialog, true)?.classList.contains("opacity-0"),
    ).toBe(false);
  });

  it("loads the display image even when the thumbnail fails", async () => {
    await render();
    await event(image(imageThumbnailSrc(src)), "error");
    expect(image(imageThumbnailSrc(src))).toBeUndefined();
    expect(image(src)?.dataset.unoptimized).toBe("false");
    await event(image(src), "load");
    expect(image(src)?.classList.contains("opacity-0")).toBe(false);
  });

  it("keeps the thumbnail visible while falling back to the original after an optimization failure", async () => {
    await render();
    await event(image(imageThumbnailSrc(src)), "load");
    await event(image(src), "error");
    expect(image(src)?.dataset.unoptimized).toBe("true");
    expect(image(src)?.classList.contains("opacity-0")).toBe(false);
    expect(image(imageThumbnailSrc(src))?.classList.contains("opacity-0")).toBe(
      false,
    );
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
    expect(hasLoadedImage(imageDisplayCacheKey(src, "96px"))).toBe(false);
    await event(image(src), "load");
    expect(image(src)?.classList.contains("opacity-0")).toBe(false);
    expect(image(imageThumbnailSrc(src))).toBeUndefined();
    expect(hasLoadedImage(src)).toBe(true);
  });

  it("loads the original when both optimized requests fail and preserves sold-out and preview behavior", async () => {
    await render(src, "96px", true, true);
    await event(image(imageThumbnailSrc(src)), "error");
    await event(image(src), "error");
    expect(image(src)?.dataset.unoptimized).toBe("true");
    expect(container.querySelector('[aria-label="图片加载失败"]')).toBeNull();
    await event(image(src), "load");
    expect(image(src)?.classList.contains("opacity-0")).toBe(false);
    expect(container.querySelector('[aria-label="已售罄"]')).not.toBeNull();
    expect(hasLoadedImage(imageDisplayCacheKey(src, "96px"))).toBe(false);
    expect(hasLoadedImage(src)).toBe(true);
    const dialog = await openPreview();
    expect(image(src, dialog, true)?.classList.contains("opacity-0")).toBe(
      false,
    );
    expect(image(src, dialog, true)).toBeDefined();
    await event(image(src, dialog, true), "load");
    expect(dialog.querySelector('[aria-label="已售罄"]')).toBeNull();
  });

  it("stops after an original failure and clears fallback when the source changes", async () => {
    await render(src, "96px", true);
    await event(image(imageThumbnailSrc(src)), "error");
    await event(image(src), "error");
    await event(image(src), "error");
    expect(image(src)).toBeUndefined();
    expect(
      container.querySelector('[aria-label="图片加载失败"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="查看商品图片大图"]'),
    ).toBeNull();
    await render(nextSrc, "96px", true);
    expect(image(imageThumbnailSrc(nextSrc))).toBeDefined();
    await event(image(imageThumbnailSrc(nextSrc)), "load");
    expect(image(nextSrc)?.dataset.unoptimized).toBe("false");
    await event(image(nextSrc), "load");
    expect(image(nextSrc)?.classList.contains("opacity-0")).toBe(false);
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
    expect(original.classList.contains("opacity-0")).toBe(false);
    expect(image(src, dialog, false)?.classList.contains("opacity-0")).toBe(
      false,
    );
    for (const layer of dialog.querySelectorAll("img")) {
      expect(layer.classList.contains("object-contain")).toBe(true);
    }
    await event(original, "load");
    expect(original.classList.contains("opacity-0")).toBe(false);
    expect(image(src, dialog, false)).toBeUndefined();
    expect(hasLoadedImage(src)).toBe(true);
  });

  it("progressively overlays the original while keeping the display image despite a previous original load", async () => {
    rememberLoadedImage(src);
    rememberLoadedImage(imageDisplayCacheKey(src, "96px"));
    await render(src, "96px", true, true);

    const dialog = await openPreview();
    const original = image(src, dialog, true)!;
    expect(original.classList.contains("opacity-0")).toBe(false);
    expect(Array.from(dialog.querySelectorAll("img")).at(-1)).toBe(original);
    expect(image(src, dialog, false)?.classList.contains("opacity-0")).toBe(
      false,
    );
    expect(dialog.querySelector('[aria-label="已售罄"]')).toBeNull();

    await event(original, "load");
    expect(original.classList.contains("opacity-0")).toBe(false);
    expect(image(src, dialog, false)).toBeUndefined();
  });

  it("keeps the thumbnail during an original retry despite a previous successful original load", async () => {
    rememberLoadedImage(src);
    await render();
    await event(image(imageThumbnailSrc(src)), "load");
    const optimized = image(src)!;
    await event(optimized, "error");

    expect(optimized.isConnected).toBe(false);
    expect(image(src)?.dataset.unoptimized).toBe("true");
    expect(image(src)?.classList.contains("opacity-0")).toBe(false);
    expect(image(imageThumbnailSrc(src))?.classList.contains("opacity-0")).toBe(
      false,
    );

    await event(image(src), "load");
    expect(image(src)?.classList.contains("opacity-0")).toBe(false);
    expect(image(imageThumbnailSrc(src))).toBeUndefined();
  });

  it("preserves a display fallback after an original failure and removes preview until the source changes", async () => {
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
    expect(
      container.querySelector('[aria-label="查看商品图片大图"]'),
    ).toBeNull();
    await render(nextSrc, "96px", true);
    dialog = await openPreview();
    expect(image(nextSrc, dialog, true)).toBeDefined();
    await event(image(nextSrc, dialog, true), "load");
    expect(dialog.querySelector('[role="status"]')).toBeNull();
  });

  it("removes the preview entry after optimized and original failures even when its thumbnail remains visible", async () => {
    await render(src, "96px", true);
    await event(image(imageThumbnailSrc(src)), "load");
    await event(image(src), "error");
    await event(image(src), "error");
    expect(image(imageThumbnailSrc(src))?.classList.contains("opacity-0")).toBe(
      false,
    );
    expect(
      container.querySelector('[aria-label="查看商品图片大图"]'),
    ).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("shows sold-out on the display image and omits it from every preview fallback stage", async () => {
    await render(src, "96px", true, true);
    expect(container.querySelector('[aria-label="已售罄"]')).not.toBeNull();
    await event(image(imageThumbnailSrc(src)), "load");
    const dialog = await openPreview();
    expect(image(src, dialog, true)?.classList.contains("opacity-0")).toBe(
      false,
    );
    expect(
      image(imageThumbnailSrc(src), dialog)?.classList.contains("opacity-0"),
    ).toBe(false);
    expect(dialog.querySelector('[aria-label="已售罄"]')).toBeNull();
    await event(image(src, dialog, true), "error");
    expect(
      image(imageThumbnailSrc(src), dialog)?.classList.contains("opacity-0"),
    ).toBe(false);
    expect(dialog.querySelector('[aria-label="已售罄"]')).toBeNull();
    expect(container.querySelector('[aria-label="已售罄"]')).not.toBeNull();
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
