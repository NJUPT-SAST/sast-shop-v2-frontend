// @vitest-environment jsdom

import React, { act } from "react";
import { createPortal } from "react-dom";
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

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/orders/spot/5001",
  useRouter: () => ({ refresh }),
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
  refresh.mockClear();
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

function TouchPage({ drawerOpen = true }: { drawerOpen?: boolean }) {
  return (
    <MobileScrollProvider>
      <MobileScrollArea hasBottomNav={false}>
        <p>页面内容</p>
        {drawerOpen
          ? createPortal(
              <>
                <div data-slot="drawer-overlay" />
                <section data-slot="drawer-content">
                  <div data-slot="drawer-handle">拖拽收起</div>
                  <p>弹层内容</p>
                </section>
              </>,
              document.body,
            )
          : null}
      </MobileScrollArea>
    </MobileScrollProvider>
  );
}

async function touch(target: Element, type: string, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: type === "touchend" ? [] : [{ clientX: 100, clientY: y }],
  });
  await act(async () => target.dispatchEvent(event));
  return event;
}

describe("mobile layout", () => {
  it("clears an existing page pull when a portal gesture starts", async () => {
    await act(async () => root.render(<TouchPage />));
    const viewport = container.querySelector("main")!;
    viewport.scrollTo = vi.fn();
    await touch(viewport, "touchstart", 100);
    await touch(viewport, "touchmove", 260);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    const target = document.querySelector('[data-slot="drawer-handle"]')!;
    await touch(target, "touchstart", 100);
    await touch(target, "touchend", 260);
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(viewport.style.transform).toBe("translateY(0px)");
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each(["drawer-handle", "drawer-content", "drawer-overlay"])(
    "ignores downward gestures from portaled %s and allows page refresh after closing",
    async (slot) => {
      await act(async () => root.render(<TouchPage />));
      const viewport = container.querySelector("main")!;
      viewport.scrollTo = vi.fn();
      const target = document.querySelector(`[data-slot="${slot}"]`)!;
      expect(viewport.contains(target)).toBe(false);
      await touch(target, "touchstart", 100);
      const move = await touch(target, "touchmove", 260);
      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(viewport.style.transform).toBe("translateY(0px)");
      expect(move.defaultPrevented).toBe(false);

      await act(async () => root.render(<TouchPage drawerOpen={false} />));
      await touch(viewport, "touchend", 260);
      expect(refresh).not.toHaveBeenCalled();

      const content = viewport.querySelector("p")!;
      await touch(content, "touchstart", 100);
      await touch(content, "touchmove", 260);
      expect(container.querySelector('[role="status"]')?.textContent).toContain(
        "下拉刷新",
      );
      await touch(content, "touchend", 260);
      expect(refresh).toHaveBeenCalledTimes(1);
    },
  );

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
