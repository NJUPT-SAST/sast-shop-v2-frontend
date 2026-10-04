// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMobileKeyboard } from "../hooks/use-mobile-keyboard";

type TestViewport = EventTarget & {
  height: number;
  width: number;
  scale: number;
};

let root: Root;
let container: HTMLDivElement;
let viewport: TestViewport;

function Probe() {
  const keyboardOpen = useMobileKeyboard();

  return (
    <>
      <output aria-label="键盘状态">{String(keyboardOpen)}</output>
      <input aria-label="搜索" />
      <textarea aria-label="备注" />
      <div contentEditable tabIndex={0} aria-label="编辑内容" />
      <input aria-label="只读" readOnly />
      <button type="button">完成</button>
    </>
  );
}

function isKeyboardOpen() {
  return container.querySelector("output")?.textContent === "true";
}

async function focus(selector: string) {
  await act(async () => {
    container.querySelector<HTMLElement>(selector)!.focus();
  });
}

async function resizeViewport(
  height: number,
  width = viewport.width,
  scale = viewport.scale,
) {
  await act(async () => {
    viewport.height = height;
    viewport.width = width;
    viewport.scale = scale;
    viewport.dispatchEvent(new Event("resize"));
  });
}

async function renderProbe() {
  await act(async () => root.render(<Probe />));
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("innerWidth", 390);
  vi.stubGlobal("innerHeight", 800);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  viewport = Object.assign(new EventTarget(), {
    height: 800,
    width: 390,
    scale: 1,
  });
  vi.stubGlobal("visualViewport", viewport);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useMobileKeyboard", () => {
  it("requires a substantial viewport shrink after focusing an editable input", async () => {
    await renderProbe();
    await focus('input[aria-label="搜索"]');
    expect(isKeyboardOpen()).toBe(false);

    await resizeViewport(700);
    expect(isKeyboardOpen()).toBe(false);

    await resizeViewport(660);
    expect(isKeyboardOpen()).toBe(false);

    await resizeViewport(620);
    expect(isKeyboardOpen()).toBe(true);

    await resizeViewport(800);
    expect(isKeyboardOpen()).toBe(false);
    expect(document.activeElement?.getAttribute("aria-label")).toBe("搜索");
  });

  it.each([
    'textarea[aria-label="备注"]',
    '[contenteditable][aria-label="编辑内容"]',
  ])("detects a keyboard for %s", async (selector) => {
    await renderProbe();
    await focus(selector);
    await resizeViewport(520);
    expect(isKeyboardOpen()).toBe(true);
  });

  it("keeps the keyboard state after blur until the viewport recovers", async () => {
    await renderProbe();
    await focus('input[aria-label="搜索"]');
    await resizeViewport(500);
    expect(isKeyboardOpen()).toBe(true);

    await focus("button");
    expect(isKeyboardOpen()).toBe(true);

    await resizeViewport(800);
    expect(isKeyboardOpen()).toBe(false);
  });

  it("ignores non-editable focus and viewport changes on a fine-pointer device", async () => {
    await renderProbe();
    await focus('input[aria-label="只读"]');
    await resizeViewport(500);
    expect(isKeyboardOpen()).toBe(false);

    await act(async () => root.render(null));
    viewport.height = 800;
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    await renderProbe();
    await focus('input[aria-label="搜索"]');
    await resizeViewport(500);
    expect(isKeyboardOpen()).toBe(false);
  });

  it("ignores pinch zoom and width changes such as rotation", async () => {
    await renderProbe();
    await focus('input[aria-label="搜索"]');

    await resizeViewport(520, 390, 1.5);
    expect(isKeyboardOpen()).toBe(false);

    await resizeViewport(800, 390, 1);
    await resizeViewport(500, 700, 1);
    expect(isKeyboardOpen()).toBe(false);
  });

  it("stays open through rotation and closes when the landscape viewport recovers", async () => {
    await renderProbe();
    await focus('input[aria-label="搜索"]');
    await resizeViewport(500);
    expect(isKeyboardOpen()).toBe(true);

    await act(async () => {
      vi.stubGlobal("innerWidth", 800);
      vi.stubGlobal("innerHeight", 390);
      viewport.width = 800;
      viewport.height = 190;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(isKeyboardOpen()).toBe(true);

    await resizeViewport(390);
    expect(isKeyboardOpen()).toBe(false);
    expect(document.activeElement?.getAttribute("aria-label")).toBe("搜索");
  });

  it("keeps the keyboard state when visual and layout widths rotate in separate events", async () => {
    await renderProbe();
    await focus('input[aria-label="搜索"]');
    await resizeViewport(500);

    await resizeViewport(190, 800);
    expect(isKeyboardOpen()).toBe(true);

    await act(async () => {
      vi.stubGlobal("innerWidth", 800);
      vi.stubGlobal("innerHeight", 390);
      window.dispatchEvent(new Event("resize"));
    });
    expect(isKeyboardOpen()).toBe(true);

    await resizeViewport(390);
    expect(isKeyboardOpen()).toBe(false);
  });

  it("falls back to innerHeight when visualViewport is unavailable", async () => {
    vi.stubGlobal("visualViewport", undefined);
    await renderProbe();
    await focus('input[aria-label="搜索"]');

    await act(async () => {
      vi.stubGlobal("innerHeight", 520);
      window.dispatchEvent(new Event("resize"));
    });
    expect(isKeyboardOpen()).toBe(true);

    await act(async () => {
      vi.stubGlobal("innerHeight", 800);
      window.dispatchEvent(new Event("resize"));
    });
    expect(isKeyboardOpen()).toBe(false);
  });

  it("detects layout shrink when a WebView leaves visualViewport height stale", async () => {
    await renderProbe();
    await focus('input[aria-label="搜索"]');

    await act(async () => {
      vi.stubGlobal("innerHeight", 510);
      window.dispatchEvent(new Event("resize"));
    });
    expect(viewport.height).toBe(800);
    expect(isKeyboardOpen()).toBe(true);

    await act(async () => {
      vi.stubGlobal("innerHeight", 800);
      window.dispatchEvent(new Event("resize"));
    });
    expect(isKeyboardOpen()).toBe(false);
  });

  it("remeasures the viewport after a visualViewport scroll event", async () => {
    await renderProbe();
    await focus('input[aria-label="搜索"]');

    await act(async () => {
      viewport.height = 500;
      viewport.dispatchEvent(new Event("scroll"));
    });
    expect(isKeyboardOpen()).toBe(true);
  });

  it("removes focus and viewport listeners when unmounted", async () => {
    const addedFocus = vi.spyOn(document, "addEventListener");
    const removedFocus = vi.spyOn(document, "removeEventListener");
    const addedResize = vi.spyOn(viewport, "addEventListener");
    const removedResize = vi.spyOn(viewport, "removeEventListener");
    await renderProbe();

    const focusListener = addedFocus.mock.calls.find(
      ([type]) => type === "focusin",
    )?.[1];
    const resizeListener = addedResize.mock.calls.find(
      ([type]) => type === "resize",
    )?.[1];
    const scrollListener = addedResize.mock.calls.find(
      ([type]) => type === "scroll",
    )?.[1];
    expect(focusListener).toBeDefined();
    expect(resizeListener).toBeDefined();
    expect(scrollListener).toBeDefined();

    await act(async () => root.render(null));
    expect(removedFocus).toHaveBeenCalledWith("focusin", focusListener);
    expect(removedResize).toHaveBeenCalledWith("resize", resizeListener);
    expect(removedResize).toHaveBeenCalledWith("scroll", scrollListener);
  });
});
