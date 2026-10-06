// @vitest-environment jsdom

import React, { act, Profiler } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSecondaryScrollTitle } from "../hooks/use-secondary-scroll-title";

vi.mock("next/navigation", () => ({
  usePathname: () => "/orders/spot/5001",
}));

let root: Root;
let container: HTMLDivElement;
let main: HTMLElement;
let commits: number;
let intersect: (entries: { intersectionRatio: number }[]) => void;

function TitleProbe() {
  const { headerRef, titleText, showTitle } = useSecondaryScrollTitle();
  return <header ref={headerRef}>{showTitle ? titleText : ""}</header>;
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: typeof intersect) {
        intersect = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  commits = 0;
  container = document.createElement("div");
  main = document.createElement("main");
  main.innerHTML = "<h1>订单详情</h1><p>商品数量 1</p>";
  document.body.append(container, main);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  main.remove();
  vi.unstubAllGlobals();
});

describe("secondary scroll title", () => {
  it("ignores unrelated page mutations while keeping heading text and visibility current", async () => {
    await act(async () =>
      root.render(
        <Profiler
          id="secondary-title"
          onRender={() => {
            commits += 1;
          }}
        >
          <TitleProbe />
        </Profiler>,
      ),
    );
    await act(async () => intersect([{ intersectionRatio: 0 }]));
    expect(container.querySelector("header")!.textContent).toBe("订单详情");

    // React may commit the first equal-state bailout after a changed title.
    await act(async () => {
      main.querySelector("p")!.textContent = "商品数量 2";
    });
    const settledCommits = commits;
    await act(async () => {
      main.querySelector("p")!.textContent = "商品数量 3";
    });
    await act(async () => {
      main.append(document.createElement("div"));
    });
    expect(commits).toBe(settledCommits);

    await act(async () => {
      main.querySelector("h1")!.textContent = "支付详情";
    });
    expect(container.querySelector("header")!.textContent).toBe("支付详情");
    await act(async () => intersect([{ intersectionRatio: 1 }]));
    expect(container.querySelector("header")!.textContent).toBe("");
  });
});
