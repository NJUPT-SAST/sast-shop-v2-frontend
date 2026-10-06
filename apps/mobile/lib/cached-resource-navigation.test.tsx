// @vitest-environment jsdom

import React, { act, Profiler } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ListSpotGoodsResult } from "@sast-shop/api";
import {
  clearResourceCache,
  loadResource,
} from "@workspace/ui/lib/resource-cache";
import { CachedSpotMarketplace } from "../components/cached-spot-marketplace";

const { listSpotGoods } = vi.hoisted(() => ({ listSpotGoods: vi.fn() }));

vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  listSpotGoods,
}));
vi.mock("../components/spot-marketplace", () => ({
  SpotMarketplace: () => <div data-cached-catalog>缓存中的商城</div>,
}));

const props = {
  dataSource: "mock" as const,
  connectBaseUrl: "http://localhost:3001/api/connect",
};
const cacheKey = JSON.stringify([
  "mobile:shop",
  props.dataSource,
  props.connectBaseUrl,
]);
const page: ListSpotGoodsResult = {
  goods: [],
  currentPage: 1,
  pageSize: 20,
  totalCount: 0,
};
let container: HTMLDivElement;
let root: Root;
let now: number;
let frames: { loading: boolean; cached: boolean }[];

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  now = 100_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  clearResourceCache();
  listSpotGoods.mockReset().mockResolvedValue(page);
  frames = [];
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  clearResourceCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function navigate(pathname: string, refreshKey: string) {
  await act(async () =>
    root.render(
      <Profiler
        id="navigation"
        onRender={() =>
          frames.push({
            loading: Boolean(
              container.querySelector('[aria-label="正在加载商品"]'),
            ),
            cached: Boolean(container.querySelector("[data-cached-catalog]")),
          })
        }
      >
        <section key={pathname}>
          {pathname === "/shop" ? (
            <CachedSpotMarketplace {...props} refreshKey={refreshKey} />
          ) : (
            <div>其他页面</div>
          )}
        </section>
      </Profiler>,
    ),
  );
}

describe("cached page client navigation", () => {
  it("renders cached content on the first committed frame after a keyed page remount", async () => {
    await navigate("/shop", "visit-1");
    await navigate("/group", "visit-1");
    frames = [];
    await navigate("/shop", "visit-2");
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((frame) => frame.cached && !frame.loading)).toBe(true);
    expect(listSpotGoods).toHaveBeenCalledOnce();
  });

  it("keeps stale cached content visible through a background request and its failure", async () => {
    await navigate("/shop", "visit-1");
    await navigate("/group", "visit-1");
    now += 60_001;
    let reject!: (error: Error) => void;
    listSpotGoods.mockReturnValueOnce(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    frames = [];
    await navigate("/shop", "visit-2");
    expect(listSpotGoods).toHaveBeenCalledTimes(2);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((frame) => frame.cached && !frame.loading)).toBe(true);
    await act(async () => reject(new Error("offline")));
    expect(container.textContent).toContain("商品更新失败");
    expect(frames.every((frame) => frame.cached && !frame.loading)).toBe(true);
  });

  it("shows a loading placeholder only on a cold client mount", async () => {
    let resolve!: (result: ListSpotGoodsResult) => void;
    listSpotGoods.mockReturnValueOnce(
      new Promise((accept) => {
        resolve = accept;
      }),
    );
    await navigate("/shop", "visit-1");
    expect(frames[0]).toEqual({ loading: true, cached: false });
    await act(async () => resolve(page));
    expect(frames.at(-1)).toEqual({ loading: false, cached: true });
  });

  it("keeps server rendering independent of the client cache while client navigation reads it immediately", async () => {
    await loadResource(cacheKey, async () => page, 60_000);
    const markup = renderToStaticMarkup(
      <CachedSpotMarketplace {...props} refreshKey="initial-document" />,
    );
    expect(markup).toContain('aria-label="正在加载商品"');
    await navigate("/shop", "client-navigation");
    expect(frames[0]).toEqual({ loading: false, cached: true });
    expect(listSpotGoods).not.toHaveBeenCalled();
  });
});
