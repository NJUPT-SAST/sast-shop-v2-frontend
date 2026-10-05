// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCachedResource } from "@workspace/ui/hooks/use-cached-resource";
import {
  clearResourceCache,
  getResourceSnapshot,
  loadResource,
} from "@workspace/ui/lib/resource-cache";

type ProbeProps = Parameters<typeof useCachedResource<string>>[0] & {
  name?: string;
};

function Probe({ name = "resource", ...props }: ProbeProps) {
  const resource = useCachedResource(props);
  return (
    <section data-name={name}>
      <span data-value>{resource.data ?? "empty"}</span>
      <span data-loading>{String(resource.loading)}</span>
      <span data-error>{resource.error ? "failed" : "ok"}</span>
      <button onClick={() => void resource.refresh()}>Retry</button>
    </section>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

let container: HTMLDivElement;
let root: Root;
let now: number;
let nextKey = 0;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("React", React);
  now = 100_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  clearResourceCache();
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

function key() {
  return `resource-test:${++nextKey}`;
}

async function render(props: ProbeProps) {
  await act(async () => root.render(<Probe {...props} />));
}

function value() {
  return container.querySelector("[data-value]")?.textContent;
}

describe("cached resources", () => {
  it("retains session data across long absences, writes, and focus until explicit refresh or session changes", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const cacheKey = key();
    const load = vi
      .fn()
      .mockResolvedValueOnce("saved")
      .mockResolvedValueOnce("manual")
      .mockResolvedValueOnce("router")
      .mockResolvedValueOnce("new-user");
    const props = {
      cacheKey,
      load,
      staleTime: Infinity,
      invalidateOnWrite: false,
    };
    await render({ ...props, refreshKey: "visit-1" });
    await act(async () => root.render(null));
    now += 24 * 60 * 60_000;
    await loadResource(key(), async () => "another-page", 60_000);
    await render({ ...props, refreshKey: "visit-2" });
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("sast-shop:data-changed"));
    });
    expect(value()).toBe("saved");
    expect(load).toHaveBeenCalledOnce();

    await act(async () => container.querySelector("button")!.click());
    expect(value()).toBe("manual");
    expect(load).toHaveBeenCalledTimes(2);
    await render({ ...props, refreshKey: "refresh-1" });
    expect(value()).toBe("router");
    expect(load).toHaveBeenCalledTimes(3);

    await act(async () =>
      window.dispatchEvent(new Event("sast-shop:session-changing")),
    );
    expect(value()).toBe("empty");
    expect(load).toHaveBeenCalledTimes(3);
    await act(async () =>
      window.dispatchEvent(new Event("sast-shop:session-changed")),
    );
    expect(value()).toBe("new-user");
    expect(load).toHaveBeenCalledTimes(4);
  });

  it("reuses data on repeat page mounts within the freshness window", async () => {
    const load = vi.fn().mockResolvedValue("saved");
    const props = { cacheKey: key(), load, staleTime: 60_000 };
    await render(props);
    await act(async () => root.render(null));
    now += 30_000;
    await render(props);
    expect(value()).toBe("saved");
    expect(load).toHaveBeenCalledOnce();
    expect(container.querySelector("[data-loading]")?.textContent).toBe(
      "false",
    );
  });

  it("shows stale data immediately, preserves it after refresh failure, and allows retry", async () => {
    const refresh = deferred<string>();
    const load = vi
      .fn()
      .mockResolvedValueOnce("saved")
      .mockReturnValueOnce(refresh.promise)
      .mockResolvedValue("new");
    const props = { cacheKey: key(), load, staleTime: 60_000 };
    await render(props);
    await act(async () => root.render(null));
    now += 60_001;
    await render(props);
    expect(value()).toBe("saved");
    expect(container.querySelector("[data-loading]")?.textContent).toBe("true");
    await act(async () => refresh.reject(new Error("offline")));
    expect(value()).toBe("saved");
    expect(container.querySelector("[data-error]")?.textContent).toBe("failed");
    await act(async () => container.querySelector("button")!.click());
    expect(value()).toBe("new");
    expect(load).toHaveBeenCalledTimes(3);
    expect(container.querySelector("[data-error]")?.textContent).toBe("ok");
  });

  it("deduplicates simultaneous consumers of the same resource", async () => {
    const pending = deferred<string>();
    const load = vi.fn().mockReturnValue(pending.promise);
    const props = { cacheKey: key(), load, staleTime: 60_000 };
    await act(async () =>
      root.render(
        <>
          <Probe {...props} name="first" />
          <Probe {...props} name="second" />
        </>,
      ),
    );
    expect(load).toHaveBeenCalledOnce();
    await act(async () => pending.resolve("shared"));
    expect(
      [...container.querySelectorAll("[data-value]")].map(
        (node) => node.textContent,
      ),
    ).toEqual(["shared", "shared"]);
  });

  it("isolates different keys and updates the loader when the key changes", async () => {
    const firstKey = key();
    const secondKey = key();
    const firstLoad = vi.fn().mockResolvedValue("first");
    const secondLoad = vi.fn().mockResolvedValue("second");
    await render({ cacheKey: firstKey, load: firstLoad, staleTime: 60_000 });
    await render({ cacheKey: secondKey, load: secondLoad, staleTime: 60_000 });
    expect(value()).toBe("second");
    expect(getResourceSnapshot<string>(firstKey).data).toBe("first");
    await act(async () => container.querySelector("button")!.click());
    expect(firstLoad).toHaveBeenCalledOnce();
    expect(secondLoad).toHaveBeenCalledTimes(2);
  });

  it("forces refresh when the refresh key changes on the same page", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce("before")
      .mockResolvedValue("after");
    const props = { cacheKey: key(), load, staleTime: 60_000 };
    await render({ ...props, refreshKey: "0" });
    await render({ ...props, refreshKey: "1" });
    expect(load).toHaveBeenCalledTimes(2);
    expect(value()).toBe("after");
  });

  it("refreshes mounted resources after writes even inside their freshness window", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce("before")
      .mockResolvedValue("after");
    await render({ cacheKey: key(), load, staleTime: 60_000 });
    await act(async () =>
      window.dispatchEvent(new Event("sast-shop:data-changed")),
    );
    expect(value()).toBe("after");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("discards an old in-flight response after a write invalidates its resource", async () => {
    const cacheKey = key();
    const old = deferred<string>();
    const load = vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue("current");
    await render({ cacheKey, load, staleTime: 60_000 });
    await act(async () =>
      window.dispatchEvent(new Event("sast-shop:data-changed")),
    );
    expect(value()).toBe("current");
    await act(async () => old.resolve("outdated"));
    expect(value()).toBe("current");
  });

  it.each([
    "sast-shop:session-expired",
    "sast-shop:session-changing",
    "sast-shop:session-changed",
  ])(
    "clears private data and discards old responses on %s",
    async (eventName) => {
      const cacheKey = key();
      await loadResource(cacheKey, async () => "old-user", 60_000);
      const old = deferred<string>();
      const late = loadResource(cacheKey, () => old.promise, 60_000, true);
      await act(async () => window.dispatchEvent(new Event(eventName)));
      expect(getResourceSnapshot<string>(cacheKey).data).toBeUndefined();
      window.dispatchEvent(new Event("sast-shop:session-changed"));
      await loadResource(cacheKey, async () => "new-user", 60_000);
      old.resolve("old-user-late");
      await late;
      expect(getResourceSnapshot<string>(cacheKey).data).toBe("new-user");
    },
  );

  it("does not repeatedly reload mounted resources while the session remains expired", async () => {
    const load = vi.fn<() => Promise<string>>(async () => {
      if (load.mock.calls.length <= 4) {
        window.dispatchEvent(new Event("sast-shop:session-expired"));
      }
      throw new Error("session expired");
    });
    await render({ cacheKey: key(), load, staleTime: 60_000 });
    expect(load).toHaveBeenCalledOnce();
    expect(value()).toBe("empty");
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("sast-shop:data-changed"));
      container.querySelector("button")!.click();
    });
    expect(load).toHaveBeenCalledOnce();
    load.mockResolvedValue("new-user");
    await act(async () =>
      window.dispatchEvent(new Event("sast-shop:session-changed")),
    );
    expect(load).toHaveBeenCalledTimes(2);
    expect(value()).toBe("new-user");
  });

  it("only refreshes stale data when the page becomes visible again", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const load = vi
      .fn()
      .mockResolvedValueOnce("before")
      .mockResolvedValue("after");
    await render({ cacheKey: key(), load, staleTime: 60_000 });
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(load).toHaveBeenCalledOnce();
    now += 60_001;
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    expect(value()).toBe("after");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
