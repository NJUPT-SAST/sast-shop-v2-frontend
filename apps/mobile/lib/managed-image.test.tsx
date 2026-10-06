// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManagedImage } from "../components/managed-image";
import {
  forgetLoadedImage,
  hasLoadedImage,
  rememberLoadedImage,
} from "@workspace/ui/lib/loaded-images";

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
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
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
