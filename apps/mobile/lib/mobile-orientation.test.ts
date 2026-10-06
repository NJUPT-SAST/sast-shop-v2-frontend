// @vitest-environment jsdom

import { runInNewContext } from "node:vm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import {
  installMobileOrientationPolicy,
  mobileOrientationBeforeSdkScript,
} from "./mobile-orientation";

let meta: HTMLMetaElement;
let screenWidth: number;
let screenHeight: number;
let orientation: EventTarget;
let addWindowListener: MockInstance<Window["addEventListener"]>;

beforeEach(() => {
  screenWidth = 390;
  screenHeight = 844;
  orientation = new EventTarget();
  vi.spyOn(window, "screen", "get").mockReturnValue({
    get width() {
      return screenWidth;
    },
    get height() {
      return screenHeight;
    },
    orientation,
  } as unknown as Screen);
  addWindowListener = vi.spyOn(window, "addEventListener");
  meta = document.createElement("meta");
  meta.name = "orientation";
  meta.content = "portrait";
  meta.setAttribute("lk-config", "");
  document.head.append(meta);
});

afterEach(() => {
  for (const [name, listener, options] of addWindowListener.mock.calls) {
    window.removeEventListener(name, listener, options);
  }
  meta.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function resizeScreen(width: number, height: number) {
  screenWidth = width;
  screenHeight = height;
  window.dispatchEvent(new Event("resize"));
}

describe.each([
  ["installed policy", installMobileOrientationPolicy],
  [
    "serialized bootstrap without module scope",
    () =>
      runInNewContext(mobileOrientationBeforeSdkScript, { window, document }),
  ],
] as const)("mobile orientation: %s", (_name, install) => {
  it.each([
    [390, 844],
    [844, 390],
    [599, 960],
    [960, 599],
  ])(
    "locks phone screens %i by %i to portrait regardless of rotation",
    (width, height) => {
      screenWidth = width;
      screenHeight = height;
      meta.content = "default";
      install();
      expect(meta.content).toBe("portrait");
      resizeScreen(height, width);
      orientation.dispatchEvent(new Event("change"));
      expect(meta.content).toBe("portrait");
    },
  );

  it.each([
    [600, 960],
    [960, 600],
    [768, 1024],
    [1024, 768],
  ])("allows system orientation on large screens %i by %i", (width, height) => {
    screenWidth = width;
    screenHeight = height;
    install();
    expect(meta.content).toBe("default");
    resizeScreen(height, width);
    orientation.dispatchEvent(new Event("change"));
    expect(meta.content).toBe("default");
  });

  it("updates the configuration as a foldable screen unfolds and folds again", () => {
    install();
    expect(meta.content).toBe("portrait");
    resizeScreen(720, 960);
    expect(meta.content).toBe("default");
    resizeScreen(390, 844);
    expect(meta.content).toBe("portrait");
  });

  it("rechecks actual screen size on the screen orientation event", () => {
    install();
    screenWidth = 840;
    screenHeight = 600;
    orientation.dispatchEvent(new Event("change"));
    expect(meta.content).toBe("default");
  });

  it("does not classify keyboard or viewport-only resizing as a screen size change", () => {
    const visualViewport = new EventTarget();
    vi.stubGlobal("visualViewport", visualViewport);
    screenWidth = 600;
    screenHeight = 960;
    install();
    vi.stubGlobal("innerWidth", 390);
    vi.stubGlobal("innerHeight", 280);
    window.dispatchEvent(new Event("resize"));
    visualViewport.dispatchEvent(new Event("resize"));
    expect(meta.content).toBe("default");

    resizeScreen(390, 844);
    vi.stubGlobal("innerWidth", 1200);
    vi.stubGlobal("innerHeight", 800);
    window.dispatchEvent(new Event("resize"));
    visualViewport.dispatchEvent(new Event("resize"));
    expect(meta.content).toBe("portrait");
  });

  it("restores the correct setting when the page returns from the browser page cache", () => {
    install();
    screenWidth = 768;
    screenHeight = 1024;
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
    expect(meta.content).toBe("default");
    screenWidth = 390;
    screenHeight = 844;
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
    expect(meta.content).toBe("portrait");
  });

  it.each([
    [NaN, 1024],
    [1024, NaN],
    [Infinity, 600],
    [600, Infinity],
    [0, 1024],
    [-1, 1024],
  ])(
    "keeps invalid screen dimensions %s by %s locked to portrait",
    (width, height) => {
      screenWidth = width;
      screenHeight = height;
      meta.content = "default";
      install();
      expect(meta.content).toBe("portrait");
    },
  );

  it("only mutates the SDK configuration when its value actually changes", () => {
    const setContent = vi.spyOn(meta, "content", "set");
    install();
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("pageshow"));
    orientation.dispatchEvent(new Event("change"));
    expect(setContent).not.toHaveBeenCalled();
    resizeScreen(600, 960);
    expect(setContent).toHaveBeenCalledExactlyOnceWith("default");
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("pageshow"));
    orientation.dispatchEvent(new Event("change"));
    expect(setContent).toHaveBeenCalledOnce();
  });

  it("ignores an unmarked meta tag and does not register listeners without SDK configuration", () => {
    meta.removeAttribute("lk-config");
    screenWidth = 600;
    screenHeight = 960;
    const addOrientationListener = vi.spyOn(orientation, "addEventListener");
    install();
    expect(meta.content).toBe("portrait");
    expect(addWindowListener).not.toHaveBeenCalled();
    expect(addOrientationListener).not.toHaveBeenCalled();
  });

  it("works when the browser does not expose screen.orientation", () => {
    vi.spyOn(window, "screen", "get").mockReturnValue({
      width: 600,
      height: 960,
    } as Screen);
    expect(install).not.toThrow();
    expect(meta.content).toBe("default");
  });
});
