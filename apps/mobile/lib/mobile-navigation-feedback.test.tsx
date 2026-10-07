// @vitest-environment jsdom

import React, { act, Suspense, use, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MobileNavigationProvider,
  useMobileRouter,
  useMobileNavigation,
  useMobilePathname,
} from "../components/mobile-navigation-feedback";
import MobileLink from "../components/mobile-link";
import {
  clearResourceCache,
  loadResource,
} from "@workspace/ui/lib/resource-cache";
import { hasCachedMobilePage } from "./mobile-page-cache";

const navigation = vi.hoisted(() => ({
  pathname: "/shop",
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
  usePathname: () => navigation.pathname,
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    onNavigate,
    onClick,
    href,
  }: React.ComponentProps<"a"> & {
    onNavigate?: (event: { preventDefault: () => void }) => void;
    replace?: boolean;
    scroll?: boolean;
    transitionTypes?: string[];
  }) => (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented)
          onNavigate?.({ preventDefault: () => event.preventDefault() });
        event.preventDefault();
      }}
    >
      {children}
    </a>
  ),
}));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  navigation.pathname = "/shop";
  clearResourceCache();
  window.history.replaceState(null, "", "/shop");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  clearResourceCache();
  vi.unstubAllGlobals();
});

function Destination({ ready }: { ready: Promise<void> }) {
  use(ready);
  return <h1>新页面</h1>;
}

function NavigationProbe({
  ready,
  href = "/profile/face",
}: {
  ready: Promise<void>;
  href?: string;
}) {
  const [destination, setDestination] = useState(false);
  const router = useMobileRouter();
  const pendingPath = useMobileNavigation()?.pendingPath;
  const displayPath = useMobilePathname();
  navigation.router.push.mockImplementation(() => setDestination(true));
  return (
    <>
      <button onClick={() => router.push(href, { scroll: false })}>
        前往页面
      </button>
      <button onClick={() => router.back()}>返回</button>
      <output>{displayPath}</output>
      {pendingPath ? <p role="status">目标页面骨架</p> : null}
      <Suspense fallback={<p>内容加载中</p>}>
        {destination ? <Destination ready={ready} /> : <h1>原页面</h1>}
      </Suspense>
    </>
  );
}

describe("mobile navigation feedback", () => {
  it("keeps content visible throughout navigation to a page with stale cached data", async () => {
    const options = {
      dataSource: "mock" as const,
      connectBaseUrl: "http://localhost:3001/api/connect",
      authRequired: false,
    };
    const cacheKey = JSON.stringify([
      "mobile:shop",
      options.dataSource,
      options.connectBaseUrl,
    ]);
    await loadResource(cacheKey, async () => ({ goods: [] }), 0);
    navigation.pathname = "/group";
    window.history.replaceState(null, "", "/group");
    let finish!: () => void;
    const ready = new Promise<void>((resolve) => {
      finish = resolve;
    });
    await act(async () =>
      root.render(
        <MobileNavigationProvider
          hasCachedPage={(path) => hasCachedMobilePage(path, options)}
        >
          <NavigationProbe ready={ready} href="/shop" />
        </MobileNavigationProvider>,
      ),
    );
    await act(async () => container.querySelector("button")!.click());
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector("h1")!.textContent).toBe("原页面");
    expect(container.textContent).not.toContain("内容加载中");
    expect(container.querySelector("output")!.textContent).toBe("/group");
    await act(async () => finish());
    expect(container.querySelector("h1")!.textContent).toBe("新页面");
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("shows cold navigation feedback after cache clearing or when the cached data belongs to another source", async () => {
    const options = {
      dataSource: "mock" as const,
      connectBaseUrl: "http://localhost:3001/api/connect",
      authRequired: false,
    };
    const cacheKey = JSON.stringify([
      "mobile:shop",
      options.dataSource,
      options.connectBaseUrl,
    ]);
    await loadResource(cacheKey, async () => ({ goods: [] }), 60_000);
    expect(hasCachedMobilePage("/shop", options)).toBe(true);
    expect(
      hasCachedMobilePage("/shop", { ...options, dataSource: "local" }),
    ).toBe(false);
    expect(
      hasCachedMobilePage("/shop", {
        ...options,
        connectBaseUrl: "http://other.example/api/connect",
      }),
    ).toBe(false);
    clearResourceCache();
    expect(hasCachedMobilePage("/shop", options)).toBe(false);
    navigation.pathname = "/group";
    await act(async () =>
      root.render(
        <MobileNavigationProvider
          hasCachedPage={(path) => hasCachedMobilePage(path, options)}
        >
          <NavigationProbe ready={new Promise<void>(() => {})} href="/shop" />
        </MobileNavigationProvider>,
      ),
    );
    await act(async () => container.querySelector("button")!.click());
    expect(container.querySelector('[role="status"]')!.textContent).toBe(
      "目标页面骨架",
    );
  });

  it("keeps native href and click cancellation", async () => {
    const onClick = vi.fn((event: React.MouseEvent<HTMLAnchorElement>) =>
      event.preventDefault(),
    );
    await act(async () =>
      root.render(
        <MobileNavigationProvider>
          <MobileLink href="/profile/face" onClick={onClick}>
            人脸录入
          </MobileLink>
        </MobileNavigationProvider>,
      ),
    );
    const link = container.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("/profile/face");
    await act(async () => link.click());
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(navigation.router.push).not.toHaveBeenCalled();
  });

  it("routes links through the provider while retaining replace and scroll options", async () => {
    await act(async () =>
      root.render(
        <MobileNavigationProvider>
          <MobileLink href="/orders" replace scroll={false}>
            订单
          </MobileLink>
        </MobileNavigationProvider>,
      ),
    );
    await act(async () => container.querySelector("a")!.click());
    expect(navigation.router.replace).toHaveBeenCalledExactlyOnceWith(
      "/orders",
      { scroll: false, transitionTypes: undefined },
    );
  });

  it("respects onNavigate cancellation", async () => {
    await act(async () =>
      root.render(
        <MobileNavigationProvider>
          <MobileLink
            href="/orders"
            onNavigate={(event) => event.preventDefault()}
          >
            订单
          </MobileLink>
        </MobileNavigationProvider>,
      ),
    );
    await act(async () => container.querySelector("a")!.click());
    expect(navigation.router.push).not.toHaveBeenCalled();
  });

  it("shows the destination path and skeleton immediately while content is suspended", async () => {
    let resolve!: () => void;
    const ready = new Promise<void>((done) => {
      resolve = done;
    });
    await act(async () =>
      root.render(
        <MobileNavigationProvider>
          <NavigationProbe ready={ready} />
        </MobileNavigationProvider>,
      ),
    );
    await act(async () => container.querySelector("button")!.click());
    expect(navigation.router.push).toHaveBeenCalledExactlyOnceWith(
      "/profile/face",
      { scroll: false },
    );
    expect(container.querySelector("output")!.textContent).toBe(
      "/profile/face",
    );
    expect(container.querySelector('[role="status"]')!.textContent).toBe(
      "目标页面骨架",
    );
    expect(container.textContent).not.toContain("正在打开");
    await act(async () => resolve());
    expect(container.querySelector("h1")!.textContent).toBe("新页面");
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("does not hide content for query-only navigations", async () => {
    const ready = new Promise<void>(() => {});
    await act(async () =>
      root.render(
        <MobileNavigationProvider>
          <NavigationProbe ready={ready} href="/shop?view=seller" />
        </MobileNavigationProvider>,
      ),
    );
    await act(async () => container.querySelector("button")!.click());
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector("output")!.textContent).toBe("/shop");
  });

  it("cancels an uncommitted destination on Back without traversing browser history", async () => {
    const ready = new Promise<void>(() => {});
    await act(async () =>
      root.render(
        <MobileNavigationProvider>
          <NavigationProbe ready={ready} />
        </MobileNavigationProvider>,
      ),
    );
    await act(async () => container.querySelector("button")!.click());
    await act(async () => container.querySelectorAll("button")[1]!.click());
    expect(navigation.router.back).not.toHaveBeenCalled();
    expect(navigation.router.replace).toHaveBeenCalledExactlyOnceWith("/shop");
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
