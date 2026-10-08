// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IllustrationFrame } from "@workspace/ui/components/illustration-frame";
import {
  forgetLoadedImage,
  hasLoadedImage,
} from "@workspace/ui/lib/loaded-images";

const src = "/_next/static/media/illustration.abc123.webp";
const nextSrc = "/_next/static/media/illustration.def456.webp";
let root: Root;
let container: HTMLDivElement;
let callbacks: { onLoad: () => void; onError: () => void };

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  forgetLoadedImage(src);
  forgetLoadedImage(nextSrc);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(value = src, size = 48) {
  await act(async () =>
    root.render(
      <IllustrationFrame
        src={value}
        size={size}
        fallback={<svg data-testid="semantic-fallback" />}
        renderImage={(props) => {
          callbacks = props;
          return React.createElement("img", { ...props, src: value, alt: "" });
        }}
      />,
    ),
  );
}

function frame() {
  return container.querySelector<HTMLElement>(
    '[data-slot="illustration-frame"]',
  )!;
}

function image() {
  return container.querySelector("img");
}

async function imageEvent(type: "load" | "error") {
  const element = image();
  expect(element).not.toBeNull();
  await act(async () => element!.dispatchEvent(new Event(type)));
}

async function remount(value = src, size = 48) {
  await act(async () => root.unmount());
  root = createRoot(container);
  await render(value, size);
}

describe("brand illustration loading", () => {
  it("shows a same-size skeleton and reveals the decoration after load without changing its frame", async () => {
    await render();
    const initialFrame = frame();
    expect(initialFrame.style.getPropertyValue("--illustration-size")).toBe(
      "48px",
    );
    expect(initialFrame.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="semantic-fallback"]'),
    ).toBeNull();
    expect(image()?.classList.contains("opacity-0")).toBe(true);
    expect(image()?.getAttribute("alt")).toBe("");

    await imageEvent("load");
    expect(frame()).toBe(initialFrame);
    expect(initialFrame.style.getPropertyValue("--illustration-size")).toBe(
      "48px",
    );
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
    expect(image()?.classList.contains("opacity-0")).toBe(false);
    expect(hasLoadedImage(src)).toBe(true);
  });

  it("returns to a loaded hash without a loading flash and keeps size changes", async () => {
    await render();
    await imageEvent("load");
    await remount(src, 112);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
    expect(image()?.classList.contains("opacity-0")).toBe(false);
    expect(frame().style.getPropertyValue("--illustration-size")).toBe("112px");
    await render(src, 32);
    expect(frame().style.getPropertyValue("--illustration-size")).toBe("32px");
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
  });

  it("replaces a failed illustration with its semantic fallback, distinct from loading", async () => {
    await render();
    const initialFrame = frame();
    await imageEvent("error");
    expect(frame()).toBe(initialFrame);
    expect(frame().style.getPropertyValue("--illustration-size")).toBe("48px");
    expect(image()).toBeNull();
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="semantic-fallback"]'),
    ).not.toBeNull();
    expect(hasLoadedImage(src)).toBe(false);
    await remount();
    expect(image()).not.toBeNull();
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="semantic-fallback"]'),
    ).toBeNull();
  });

  it("evicts a loaded hash when its next request fails", async () => {
    await render();
    await imageEvent("load");
    await remount();
    await imageEvent("error");
    expect(hasLoadedImage(src)).toBe(false);
    await remount();
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it("starts loading a new hash and ignores callbacks from the previous source", async () => {
    await render();
    const oldCallbacks = callbacks;
    await render(nextSrc);
    await act(async () => {
      oldCallbacks.onLoad();
      oldCallbacks.onError();
    });
    expect(image()?.getAttribute("src")).toBe(nextSrc);
    expect(image()?.classList.contains("opacity-0")).toBe(true);
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(hasLoadedImage(src)).toBe(false);
    expect(hasLoadedImage(nextSrc)).toBe(false);
    await imageEvent("load");
    await act(async () => oldCallbacks.onError());
    expect(image()?.classList.contains("opacity-0")).toBe(false);
    expect(hasLoadedImage(nextSrc)).toBe(true);
    expect(
      container.querySelector('[data-testid="semantic-fallback"]'),
    ).toBeNull();
  });

  it("loads a changed hash while remembering the previous successful illustration", async () => {
    await render();
    await imageEvent("load");
    await render(nextSrc);
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    await render(src);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
    expect(image()?.classList.contains("opacity-0")).toBe(false);
  });
});
