// @vitest-environment jsdom

import React, { act, useEffect, useId, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManagedImage } from "../components/managed-image";
import {
  forgetLoadedImage,
  hasLoadedImage,
  rememberLoadedImage,
} from "@workspace/ui/lib/loaded-images";

import {
  registerDrawerHistory,
  waitForDrawerHistoryCleanup,
} from "@workspace/ui/lib/drawer-history";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
    onLoad,
    onError,
  }: {
    src: string;
    alt: string;
    className?: string;
    onLoad: React.ReactEventHandler<HTMLImageElement>;
    onError: React.ReactEventHandler<HTMLImageElement>;
  }) => React.createElement("img", { src, alt, className, onLoad, onError }),
}));

let root: Root;
let container: HTMLDivElement;
const src = "https://example.com/managed-image-primary.png";
const secondSrc = "https://example.com/managed-image-secondary.png";

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  forgetLoadedImage(src);
  forgetLoadedImage(secondSrc);
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

async function render(value: string | null = src) {
  await act(async () =>
    root.render(<ManagedImage src={value} alt="商品图片" />),
  );
}

async function imageEvent(type: "load" | "error") {
  const image = container.querySelector("img");
  expect(image).not.toBeNull();
  await act(async () => image!.dispatchEvent(new Event(type)));
}

async function remount(value = src) {
  await act(async () => root.unmount());
  root = createRoot(container);
  await render(value);
}

function expectVisibleImage() {
  expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
  expect(container.querySelector("img")?.classList.contains("opacity-0")).toBe(
    false,
  );
}

describe("ManagedImage loaded images", () => {
  it("shows a first-load skeleton, then returns to a visible successful image immediately", async () => {
    await render();
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(
      container.querySelector("img")?.classList.contains("opacity-0"),
    ).toBe(true);
    await imageEvent("load");
    expectVisibleImage();
    await remount();
    expectVisibleImage();
  });

  it("loads a new source and immediately shows a previously successful source when switching back", async () => {
    await render();
    await imageEvent("load");
    await render(secondSrc);
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    await render(src);
    expectVisibleImage();
    expect(container.querySelector("img")?.getAttribute("src")).toBe(src);
  });

  it("shows the error fallback and retries a failed source on the next visit", async () => {
    await render();
    await imageEvent("error");
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
    await remount();
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    await imageEvent("load");
    expectVisibleImage();
  });

  it("forgets a warmed source if it subsequently fails", async () => {
    await render();
    await imageEvent("load");
    await remount();
    expectVisibleImage();
    await imageEvent("error");
    expect(hasLoadedImage(src)).toBe(false);
    await remount();
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it("keeps the empty-source placeholder without a skeleton", async () => {
    await render(null);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("bounds remembered successful URLs", () => {
    const oldest = "https://example.com/oldest-cached-image.png";
    rememberLoadedImage(oldest);
    for (let index = 0; index < 1024; index += 1) {
      rememberLoadedImage(`https://example.com/bounded-image-${index}.png`);
    }
    expect(hasLoadedImage(oldest)).toBe(false);
    expect(hasLoadedImage("https://example.com/bounded-image-1023.png")).toBe(
      true,
    );
  });
});

function previewTrigger() {
  const trigger = container.querySelector<HTMLButtonElement>(
    '[aria-label="查看商品图片大图"]',
  );
  expect(trigger).not.toBeNull();
  return trigger!;
}

function previewDialog() {
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
  expect(dialog).not.toBeNull();
  return dialog!;
}

function dialogButton(name: string) {
  const button = Array.from(previewDialog().querySelectorAll("button")).find(
    (item) =>
      item.getAttribute("aria-label") === name ||
      item.textContent?.trim() === name,
  );
  expect(button).toBeDefined();
  return button!;
}

async function renderPreview(value: string | null = src) {
  await act(async () =>
    root.render(
      <ManagedImage src={value} alt="商品图片" fit="contain" preview />,
    ),
  );
}

async function openPreview() {
  await imageEvent("load");
  const trigger = previewTrigger();
  await act(async () => {
    trigger.focus();
    trigger.click();
  });
  return trigger;
}

function previewViewport() {
  const viewport = previewDialog().querySelector<HTMLElement>(
    '[role="region"][aria-label="图片查看区域"]',
  );
  expect(viewport).not.toBeNull();
  return viewport!;
}

function configurePreviewGeometry(naturalWidth = 400, naturalHeight = 600) {
  const viewport = previewViewport();
  Object.defineProperty(viewport, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(0, 0, 400, 600),
  });
  Object.defineProperties(viewport, {
    setPointerCapture: { configurable: true, value: () => {} },
    releasePointerCapture: { configurable: true, value: () => {} },
    hasPointerCapture: { configurable: true, value: () => true },
  });
  const image = viewport.querySelector("img")!;
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: naturalWidth },
    naturalHeight: { configurable: true, value: naturalHeight },
  });
  return viewport;
}

function previewTransform() {
  const canvas = previewViewport().querySelector<HTMLElement>(
    '[data-slot="image-preview-canvas"]',
  );
  expect(canvas).not.toBeNull();
  const transform = canvas!.style.transform;
  const translation = transform.match(
    /translate3d\(\s*([-\d.e]+)px,\s*([-\d.e]+)px,\s*0(?:px)?\s*\)/,
  );
  const scale = transform.match(/scale\(([-\d.e]+)\)/);
  expect(translation).not.toBeNull();
  expect(scale).not.toBeNull();
  return {
    x: Number(translation![1]),
    y: Number(translation![2]),
    scale: Number(scale![1]),
  };
}

async function doubleClick(viewport: HTMLElement) {
  await act(async () =>
    viewport.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        cancelable: true,
        clientX: 200,
        clientY: 300,
      }),
    ),
  );
}

async function pointerEvent(
  viewport: HTMLElement,
  type: string,
  pointerId: number,
  clientX: number,
  clientY: number,
  pointerType: "touch" | "mouse" = "touch",
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    button: 0,
  });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
  });
  await act(async () => viewport.dispatchEvent(event));
}

async function wheel(viewport: HTMLElement, deltaY: number) {
  await act(async () =>
    viewport.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY,
        clientX: 200,
        clientY: 300,
      }),
    ),
  );
}

async function gestureKey(viewport: HTMLElement, key: string) {
  await act(async () =>
    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    ),
  );
}

describe("ManagedImage original image preview", () => {
  it("opens the original source after loading, zooms, and restores focus after Escape", async () => {
    await renderPreview();
    const trigger = await openPreview();
    const image = previewDialog().querySelector("img");
    expect(image?.getAttribute("src")).toBe(src);
    expect(image?.getAttribute("alt")).toBe("商品图片");
    const viewport = configurePreviewGeometry();
    expect(previewTransform().scale).toBe(1);
    await doubleClick(viewport);
    expect(previewTransform().scale).toBe(2.5);
    await doubleClick(viewport);
    expect(previewTransform().scale).toBe(1);
    expect(previewDialog().querySelectorAll("button")).toHaveLength(1);
    await act(async () => {
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(document.activeElement).toBe(trigger);
  });

  it("closes an open preview when the source changes and resets zoom for the new source", async () => {
    await renderPreview();
    await openPreview();
    await doubleClick(configurePreviewGeometry());
    await renderPreview(secondSrc);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(previewTrigger().disabled).toBe(true);
    await openPreview();
    expect(previewDialog().querySelector("img")?.getAttribute("src")).toBe(
      secondSrc,
    );
    expect(previewTransform().scale).toBe(1);
  });

  it("cannot preview loading, failed, or empty images", async () => {
    await renderPreview();
    expect(previewTrigger().disabled).toBe(true);
    await act(async () => previewTrigger().click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await imageEvent("error");
    expect(previewTrigger().disabled).toBe(true);
    await act(async () => previewTrigger().click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await renderPreview(null);
    expect(previewTrigger().disabled).toBe(true);
    await act(async () => previewTrigger().click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("closes an image preview without activating the surrounding card", async () => {
    const onCardClick = vi.fn();
    await act(async () =>
      root.render(
        <div onClick={onCardClick}>
          <ManagedImage src={src} alt="商品图片" preview />
        </div>,
      ),
    );
    const trigger = await openPreview();
    expect(onCardClick).not.toHaveBeenCalled();
    await doubleClick(configurePreviewGeometry());
    expect(onCardClick).not.toHaveBeenCalled();
    onCardClick.mockClear();
    await act(async () => dialogButton("关闭图片预览").click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(onCardClick).not.toHaveBeenCalled();
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(document.activeElement).toBe(trigger);
  });
});

function PurchaseHistoryProbe({ onBack }: { onBack: () => void }) {
  const [open, setOpen] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const openRef = useRef(open);
  const id = useId();

  useEffect(
    () =>
      registerDrawerHistory({
        id,
        isOpen: () => openRef.current,
        onBack: () => {
          openRef.current = false;
          onBack();
          setOpen(false);
        },
      }),
    [id, onBack],
  );

  return (
    <section data-purchase-open={open}>
      <output aria-label="购买数量">{quantity}</output>
      <button onClick={() => setQuantity((value) => value + 1)}>
        增加数量
      </button>
      {open ? <ManagedImage src={src} alt="商品图片" preview /> : null}
    </section>
  );
}

async function settleHistory() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
}

async function browserBack() {
  await act(async () => {
    window.history.back();
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  await settleHistory();
}

describe("ManagedImage preview with real drawer history", () => {
  it("closes only the image on the first Back, preserves quantity, then closes the purchase layer on the next Back", async () => {
    const onParentBack = vi.fn();
    await act(async () =>
      root.render(<PurchaseHistoryProbe onBack={onParentBack} />),
    );
    await settleHistory();
    const quantity = () =>
      container.querySelector('[aria-label="购买数量"]')?.textContent;
    const purchaseIsOpen = () =>
      container
        .querySelector("[data-purchase-open]")
        ?.getAttribute("data-purchase-open");
    const increase = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "增加数量",
    )!;
    await act(async () => {
      increase.click();
      increase.click();
    });
    expect(quantity()).toBe("3");
    await openPreview();
    await settleHistory();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    await browserBack();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(onParentBack).not.toHaveBeenCalled();
    expect(purchaseIsOpen()).toBe("true");
    expect(quantity()).toBe("3");
    expect(window.location.pathname).toBe("/shop");

    await browserBack();
    expect(onParentBack).toHaveBeenCalledTimes(1);
    expect(purchaseIsOpen()).toBe("false");
    expect(quantity()).toBe("3");
    expect(window.location.pathname).toBe("/shop");
  });

  it("keeps the purchase layer and quantity when the image is closed by its button, then closes the parent on Back", async () => {
    const onParentBack = vi.fn();
    await act(async () =>
      root.render(<PurchaseHistoryProbe onBack={onParentBack} />),
    );
    await settleHistory();
    const increase = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "增加数量",
    )!;
    await act(async () => increase.click());
    await openPreview();
    await settleHistory();
    await act(async () => dialogButton("关闭图片预览").click());
    await settleHistory();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(onParentBack).not.toHaveBeenCalled();
    expect(
      container
        .querySelector("[data-purchase-open]")
        ?.getAttribute("data-purchase-open"),
    ).toBe("true");
    expect(
      container.querySelector('[aria-label="购买数量"]')?.textContent,
    ).toBe("2");

    await browserBack();
    expect(onParentBack).toHaveBeenCalledTimes(1);
    expect(
      container
        .querySelector("[data-purchase-open]")
        ?.getAttribute("data-purchase-open"),
    ).toBe("false");
    expect(
      container.querySelector('[aria-label="购买数量"]')?.textContent,
    ).toBe("2");
    expect(window.location.pathname).toBe("/shop");
  });
});

describe("ManagedImage preview gestures", () => {
  it("pinches to zoom, clamps dragging to the image edges, and resets on double tap without a synthetic double-click zoom", async () => {
    await renderPreview();
    await openPreview();
    const viewport = configurePreviewGeometry();
    await pointerEvent(viewport, "pointerdown", 1, 150, 300);
    await pointerEvent(viewport, "pointerdown", 2, 250, 300);
    await pointerEvent(viewport, "pointermove", 1, 100, 300);
    await pointerEvent(viewport, "pointermove", 2, 300, 300);
    expect(previewTransform().scale).toBeCloseTo(2);
    await pointerEvent(viewport, "pointerup", 1, 100, 300);
    await pointerEvent(viewport, "pointerup", 2, 300, 300);

    await pointerEvent(viewport, "pointerdown", 3, 200, 300);
    await pointerEvent(viewport, "pointermove", 3, 1200, 1800);
    expect(previewTransform().x).toBeCloseTo(200);
    expect(previewTransform().y).toBeCloseTo(300);
    await pointerEvent(viewport, "pointerup", 3, 1200, 1800);
    await pointerEvent(viewport, "pointerdown", 4, 200, 300);
    await pointerEvent(viewport, "pointerup", 4, 200, 300);
    await pointerEvent(viewport, "pointerdown", 5, 200, 300);
    await pointerEvent(viewport, "pointerup", 5, 200, 300);
    expect(previewTransform()).toEqual({ x: 0, y: 0, scale: 1 });
    await doubleClick(viewport);
    expect(previewTransform()).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it("zooms with the wheel within its limits and supports keyboard zoom, pan, and reset", async () => {
    await renderPreview();
    await openPreview();
    const viewport = configurePreviewGeometry();
    expect(viewport.tabIndex).toBe(0);
    await wheel(viewport, -200);
    expect(previewTransform().scale).toBeGreaterThan(1);
    await wheel(viewport, -100000);
    expect(previewTransform().scale).toBe(5);
    await wheel(viewport, 100000);
    await wheel(viewport, 100000);
    expect(previewTransform()).toEqual({ x: 0, y: 0, scale: 1 });

    await gestureKey(viewport, "+");
    const enlarged = previewTransform().scale;
    expect(enlarged).toBeGreaterThan(1);
    await gestureKey(viewport, "ArrowRight");
    expect(previewTransform().x).not.toBe(0);
    await gestureKey(viewport, "-");
    expect(previewTransform().scale).toBeLessThan(enlarged);
    await gestureKey(viewport, "0");
    expect(previewTransform()).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it("stops a cancelled drag and starts the next gesture without stale pointers", async () => {
    await renderPreview();
    await openPreview();
    const viewport = configurePreviewGeometry();
    await doubleClick(viewport);
    await pointerEvent(viewport, "pointerdown", 1, 200, 300);
    await pointerEvent(viewport, "pointermove", 1, 260, 340);
    const beforeCancel = previewTransform();
    expect(beforeCancel.x).toBe(60);
    expect(beforeCancel.y).toBe(40);
    await pointerEvent(viewport, "pointercancel", 1, 260, 340);
    await pointerEvent(viewport, "pointermove", 1, 800, 900);
    expect(previewTransform()).toEqual(beforeCancel);
    await pointerEvent(viewport, "pointerdown", 2, 200, 300);
    await pointerEvent(viewport, "pointermove", 2, 230, 330);
    expect(previewTransform()).toEqual({ x: 90, y: 70, scale: 2.5 });
    await pointerEvent(viewport, "lostpointercapture", 2, 230, 330);
    await pointerEvent(viewport, "pointermove", 2, -800, -900);
    expect(previewTransform()).toEqual({ x: 90, y: 70, scale: 2.5 });
  });

  it.each([
    { naturalWidth: 800, naturalHeight: 200, x: 300, y: 0 },
    { naturalWidth: 100, naturalHeight: 1200, x: 0, y: 450 },
  ])(
    "keeps a $naturalWidth x $naturalHeight image within its actual contained edges",
    async ({ naturalWidth, naturalHeight, x, y }) => {
      await renderPreview();
      await openPreview();
      const viewport = configurePreviewGeometry(naturalWidth, naturalHeight);
      await doubleClick(viewport);
      await pointerEvent(viewport, "pointerdown", 1, 200, 300);
      await pointerEvent(viewport, "pointermove", 1, 1200, 1800);
      expect(previewTransform()).toEqual({ x, y, scale: 2.5 });
      await pointerEvent(viewport, "pointerup", 1, 1200, 1800);
    },
  );

  it("continues an active mouse drag from the latest wheel and keyboard transform", async () => {
    await renderPreview();
    await openPreview();
    const viewport = configurePreviewGeometry();
    await doubleClick(viewport);
    await pointerEvent(viewport, "pointerdown", 1, 200, 300, "mouse");
    await pointerEvent(viewport, "pointermove", 1, 220, 320, "mouse");
    expect(previewTransform()).toEqual({ x: 20, y: 20, scale: 2.5 });

    await wheel(viewport, -10);
    const afterWheel = previewTransform();
    expect(afterWheel.scale).toBeGreaterThan(2.5);
    await pointerEvent(viewport, "pointermove", 1, 230, 330, "mouse");
    expect(previewTransform().scale).toBe(afterWheel.scale);
    expect(previewTransform().x).toBeCloseTo(afterWheel.x + 10);
    expect(previewTransform().y).toBeCloseTo(afterWheel.y + 10);

    await gestureKey(viewport, "+");
    const afterPlus = previewTransform();
    expect(afterPlus.scale).toBeGreaterThan(afterWheel.scale);
    await pointerEvent(viewport, "pointermove", 1, 240, 340, "mouse");
    expect(previewTransform().scale).toBe(afterPlus.scale);
    expect(previewTransform().x).toBeCloseTo(afterPlus.x + 10);
    expect(previewTransform().y).toBeCloseTo(afterPlus.y + 10);

    await gestureKey(viewport, "-");
    const afterMinus = previewTransform();
    expect(afterMinus.scale).toBeLessThan(afterPlus.scale);
    await pointerEvent(viewport, "pointermove", 1, 250, 350, "mouse");
    expect(previewTransform().scale).toBe(afterMinus.scale);
    expect(previewTransform().x).toBeCloseTo(afterMinus.x + 10);
    expect(previewTransform().y).toBeCloseTo(afterMinus.y + 10);

    await gestureKey(viewport, "ArrowLeft");
    const afterArrow = previewTransform();
    await pointerEvent(viewport, "pointermove", 1, 260, 360, "mouse");
    expect(previewTransform().scale).toBe(afterArrow.scale);
    expect(previewTransform().x).toBeCloseTo(afterArrow.x + 10);
    expect(previewTransform().y).toBeCloseTo(afterArrow.y + 10);
    await pointerEvent(viewport, "pointerup", 1, 260, 360, "mouse");
  });
});
