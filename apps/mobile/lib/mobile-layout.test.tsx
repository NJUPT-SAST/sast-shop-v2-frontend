// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileFixedFooter } from "../components/mobile-fixed-footer";
import {
  MobileHeaderActions,
  MobileHeaderActionsProvider,
  MobileHeaderActionSlot,
} from "../components/mobile-header-actions";
import { MobileScrollArea } from "../components/mobile-scroll-area";
import { MobileScrollProvider } from "../components/mobile-scroll-context";
import { useSecondaryScrollTitle } from "../hooks/use-secondary-scroll-title";

vi.mock("next/navigation", () => ({
  usePathname: () => "/orders/spot/5001",
  useRouter: () => ({ refresh: vi.fn() }),
}));

let root: Root;
let container: HTMLDivElement;
let footerHeight: number;
let frames: (() => void)[];
let resizeCallbacks: (() => void)[];
let intersections: ((entries: { intersectionRatio: number }[]) => void)[];

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  footerHeight = 80;
  frames = [];
  resizeCallbacks = [];
  intersections = [];
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) =>
    frames.push(callback),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(
        callback: (entries: { intersectionRatio: number }[]) => void,
      ) {
        intersections.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return {
        height: this.tagName === "FOOTER" ? footerHeight : 0,
      } as DOMRect;
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Page({ footer }: { footer: boolean }) {
  return (
    <MobileScrollProvider>
      <MobileScrollArea hasBottomNav={false}>
        <h1>订单详情</h1>
      </MobileScrollArea>
      {footer ? (
        <MobileFixedFooter>
          <button>付款</button>
        </MobileFixedFooter>
      ) : null}
    </MobileScrollProvider>
  );
}

function TitleProbe() {
  const { headerRef, titleText, showTitle } = useSecondaryScrollTitle();
  return <header ref={headerRef}>{showTitle ? titleText : ""}</header>;
}

describe("mobile layout", () => {
  it("keeps the current header action and removes it when its page leaves", async () => {
    const firstAction = vi.fn();
    const latestAction = vi.fn();
    const contentTouch = vi.fn();
    const page = (disabled: boolean, onClick: () => void, visible = true) => (
      <MobileHeaderActionsProvider>
        <header>
          <MobileHeaderActionSlot />
        </header>
        <main
          onTouchStart={contentTouch}
          onTouchMove={contentTouch}
          onTouchEnd={contentTouch}
        >
          {visible ? (
            <MobileHeaderActions>
              <button type="button" disabled={disabled} onClick={onClick}>
                取消采购
              </button>
            </MobileHeaderActions>
          ) : null}
        </main>
      </MobileHeaderActionsProvider>
    );

    await act(async () => root.render(page(false, firstAction)));
    const header = container.querySelector("header")!;
    expect(header.querySelector("button")?.textContent).toBe("取消采购");
    await act(async () => {
      for (const type of ["touchstart", "touchmove", "touchend"]) {
        header
          .querySelector("button")!
          .dispatchEvent(new Event(type, { bubbles: true }));
      }
    });
    expect(contentTouch).not.toHaveBeenCalled();
    await act(async () => header.querySelector("button")!.click());
    expect(firstAction).toHaveBeenCalledTimes(1);

    await act(async () => root.render(page(true, latestAction)));
    expect(header.querySelector("button")?.disabled).toBe(true);
    await act(async () => header.querySelector("button")!.click());
    expect(latestAction).not.toHaveBeenCalled();

    await act(async () => root.render(page(false, latestAction)));
    await act(async () => header.querySelector("button")!.click());
    expect(firstAction).toHaveBeenCalledTimes(1);
    expect(latestAction).toHaveBeenCalledTimes(1);

    await act(async () => root.render(page(false, latestAction, false)));
    expect(header.querySelector("button")).toBeNull();
  });

  it("reserves the full changing action bar height and releases it when the bar disappears", async () => {
    await act(async () => root.render(<Page footer />));
    const scrollContainer = container.querySelector("main")!.parentElement!;
    expect(scrollContainer.style.marginBottom).toBe("80px");
    footerHeight = 132;
    await act(async () => resizeCallbacks.forEach((callback) => callback()));
    expect(scrollContainer.style.marginBottom).toBe("132px");
    await act(async () => root.render(<Page footer={false} />));
    expect(scrollContainer.style.marginBottom).toBe("");
  });

  it("discovers a secondary title rendered after loading without hiding the page heading", async () => {
    await act(async () =>
      root.render(
        <>
          <TitleProbe />
          <main>
            <p>正在加载</p>
          </main>
        </>,
      ),
    );
    await act(async () => frames.splice(0).forEach((callback) => callback()));
    expect(container.querySelector("header")!.textContent).toBe("");
    await act(async () =>
      root.render(
        <>
          <TitleProbe />
          <main>
            <h1>订单详情</h1>
          </main>
        </>,
      ),
    );
    await act(async () => intersections.at(-1)!([{ intersectionRatio: 0 }]));
    expect(container.querySelector("header")!.textContent).toBe("订单详情");
    expect(container.querySelector("h1")!.style.opacity).toBe("");
    await act(async () => intersections.at(-1)!([{ intersectionRatio: 1 }]));
    expect(container.querySelector("header")!.textContent).toBe("");
  });
});
