// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobilePageTransition } from "../components/mobile-page-transition";
import { getPageTransitionDirection } from "./page-transition";

const navigation = vi.hoisted(() => ({ pathname: "/shop" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

let root: Root;
let container: HTMLDivElement;
let media: MediaQueryList;
const animations: { cancel: ReturnType<typeof vi.fn> }[] = [];
const animate = vi.fn<HTMLElement["animate"]>(() => {
  const animation = { cancel: vi.fn() };
  animations.push(animation);
  return animation as unknown as Animation;
});

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  navigation.pathname = "/shop";
  animations.length = 0;
  animate.mockClear();
  media = Object.assign(new EventTarget(), {
    matches: false,
  }) as MediaQueryList;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media),
  );
  Object.defineProperty(HTMLElement.prototype, "animate", {
    value: animate,
    configurable: true,
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  vi.unstubAllGlobals();
});

async function render(pathname: string) {
  navigation.pathname = pathname;
  await act(async () =>
    root.render(
      <MobilePageTransition>
        <main style={{ transform: "translateY(48px)" }}>{pathname}</main>
      </MobilePageTransition>,
    ),
  );
}

describe("mobile page transitions", () => {
  it.each([
    ["/shop", "/orders/spot/1", "forward"],
    ["/orders/spot/1", "/orders", "backward"],
    ["/pocket/1", "/pocket/1/capture", "forward"],
    ["/pocket/1/capture", "/pocket/1", "backward"],
    ["/pocket/new", "/pocket/1/capture", "forward"],
    ["/shop", "/group", null],
    ["/orders", "/orders", null],
    ["/pocket/1", "/pocket/10", null],
    ["/group/shop/1", "/group/errand/1", null],
    ["/", "/shop", null],
  ] as const)("classifies %s → %s", (previous, next, expected) => {
    expect(getPageTransitionDirection(previous, next)).toBe(expected);
  });

  it("animates entering and returning without changing the pull transform or history", async () => {
    const historyLength = window.history.length;
    await render("/shop");
    expect(animate).not.toHaveBeenCalled();
    await render("/orders/spot/1");
    expect(animate.mock.calls[0]?.[0]).toEqual([
      { transform: "translateX(24px)", opacity: 0.8 },
      { transform: "translateX(0)", opacity: 1 },
    ]);
    expect(container.querySelector("main")!.style.transform).toBe(
      "translateY(48px)",
    );
    await render("/orders");
    expect(animate.mock.calls[1]?.[0]).toEqual([
      { transform: "translateX(-24px)", opacity: 0.8 },
      { transform: "translateX(0)", opacity: 1 },
    ]);
    expect(animations[0]!.cancel).toHaveBeenCalledTimes(1);
    expect(window.history.length).toBe(historyLength);
  });

  it("does not replay on primary tabs, content refresh or Drawer back events", async () => {
    await render("/shop");
    await render("/group");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await render("/group");
    expect(animate).not.toHaveBeenCalled();
  });

  it("skips reduced motion and cancels immediately when the preference changes", async () => {
    await render("/shop");
    Object.assign(media, { matches: true });
    await render("/orders/spot/1");
    expect(animate).not.toHaveBeenCalled();
    Object.assign(media, { matches: false });
    await render("/orders");
    Object.assign(media, { matches: true });
    media.dispatchEvent(new Event("change"));
    expect(animations[0]!.cancel).toHaveBeenCalledTimes(1);
  });

  it("shows content when the browser has no animation API", async () => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
    await render("/shop");
    await render("/orders/spot/1");
    expect(container.textContent).toBe("/orders/spot/1");
  });
});
