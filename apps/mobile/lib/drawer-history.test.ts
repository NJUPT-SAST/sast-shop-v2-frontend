// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

type Registration = {
  id: string;
  onBack: () => void;
  isOpen: () => boolean;
};
type HistoryEntry = { state: Record<string, unknown>; url: string };
let register: (registration: Registration) => () => void;
let waitForCleanup: () => Promise<void>;
let entries: HistoryEntry[];
let position: number;
let traversals: number[];
let push: MockInstance<History["pushState"]>;
let addListener: MockInstance<Window["addEventListener"]>;
let disposals: (() => void)[];
const nextState = {
  __NA: true,
  __PRIVATE_NEXTJS_INTERNALS_TREE: {
    tree: ["profile", {}],
    renderedSearch: "",
  },
  otherAppState: "preserved",
};

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  position = 1;
  traversals = [];
  disposals = [];
  entries = [
    {
      state: { ...nextState, route: "shop" },
      url: new URL("/shop", location.href).href,
    },
    {
      state: structuredClone(nextState),
      url: new URL("/profile", location.href).href,
    },
  ];
  const replace = window.history.replaceState.bind(window.history);
  replace(entries[position].state, "", entries[position].url);
  push = vi
    .spyOn(window.history, "pushState")
    .mockImplementation((state, _unused, url) => {
      const nextUrl =
        url === undefined || url === null
          ? location.href
          : new URL(String(url), location.href).href;
      entries.splice(position + 1);
      entries.push({ state: structuredClone(state), url: nextUrl });
      position += 1;
      replace(state, "", nextUrl);
    });
  vi.spyOn(window.history, "replaceState").mockImplementation(
    (state, _unused, url) => {
      const nextUrl =
        url === undefined || url === null
          ? location.href
          : new URL(String(url), location.href).href;
      entries[position] = { state: structuredClone(state), url: nextUrl };
      replace(state, "", nextUrl);
    },
  );
  vi.spyOn(window.history, "back").mockImplementation(() => {
    traversals.push(-1);
  });
  vi.spyOn(window.history, "go").mockImplementation((delta = 0) => {
    traversals.push(delta);
  });
  addListener = vi.spyOn(window, "addEventListener");
  const manager = await import("@workspace/ui/lib/drawer-history");
  register = manager.registerDrawerHistory;
  waitForCleanup = manager.waitForDrawerHistoryCleanup;
});

afterEach(async () => {
  disposals.forEach((dispose) => dispose());
  await flush();
  for (const [event, listener, options] of addListener.mock.calls) {
    window.removeEventListener(event, listener, options);
  }
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function traverse(delta: number) {
  const destination = position + delta;
  if (destination < 0 || destination >= entries.length) return;
  position = destination;
  const current = entries[position];
  window.history.replaceState(current.state, "", current.url);
  window.dispatchEvent(new PopStateEvent("popstate", { state: current.state }));
}

async function flush() {
  for (let step = 0; step < 50; step += 1) {
    await vi.runAllTimersAsync();
    const delta = traversals.shift();
    if (delta === undefined) return;
    traverse(delta);
  }
  throw new Error("Drawer history did not settle");
}

async function back() {
  window.history.back();
  await flush();
}

function drawer(id: string, dismissible = true) {
  let open = true;
  let cleanup = () => {};
  const onBack = vi.fn(() => {
    if (!dismissible) return;
    open = false;
    cleanup();
  });
  cleanup = register({ id, onBack, isOpen: () => open });
  const close = () => {
    open = false;
    cleanup();
  };
  disposals.push(close);
  return { onBack, close, isOpen: () => open };
}

describe("drawer system back history", () => {
  it("waits for the asynchronous cleanup popstate before allowing route navigation", async () => {
    const panel = drawer("publish");
    await flush();
    panel.close();
    const navigate = vi.fn(() => {
      window.history.pushState(
        { ...nextState, route: "publish" },
        "",
        "/publish/spot",
      );
    });
    const cleanup = waitForCleanup().then(navigate);
    await vi.runAllTimersAsync();
    expect(traversals).toEqual([-1]);
    expect(navigate).not.toHaveBeenCalled();
    expect(location.pathname).toBe("/profile");
    traverse(traversals.shift()!);
    expect(navigate).not.toHaveBeenCalled();
    await flush();
    await cleanup;
    expect(navigate).toHaveBeenCalledOnce();
    expect(location.pathname).toBe("/publish/spot");
    expect(traversals).toEqual([]);
    await flush();
    expect(location.pathname).toBe("/publish/spot");
    await back();
    expect(location.pathname).toBe("/profile");
    expect(window.history.state).toEqual(nextState);
  });

  it("keeps cleanup waiters pending when a replacement drawer opens during traversal", async () => {
    const first = drawer("first");
    await flush();
    first.close();
    const resolved = vi.fn();
    const cleanup = waitForCleanup().then(resolved);
    await vi.runAllTimersAsync();
    const second = drawer("second");
    await flush();
    expect(resolved).not.toHaveBeenCalled();
    second.close();
    await flush();
    await cleanup;
    expect(resolved).toHaveBeenCalledOnce();
    expect(traversals).toEqual([]);
  });

  it("resolves cleanup when no drawer has registered without traversing history", async () => {
    const resolved = vi.fn();
    const cleanup = waitForCleanup().then(resolved);
    await flush();
    await cleanup;
    expect(resolved).toHaveBeenCalledOnce();
    expect(traversals).toEqual([]);
    expect(location.pathname).toBe("/profile");
  });

  it("resolves a closing child's waiter while its original parent retains back protection", async () => {
    const parent = drawer("template-editor");
    const child = drawer("store-create");
    await flush();
    const state = window.history.state;
    const resolved = vi.fn();
    const cleanup = waitForCleanup().then(resolved);
    child.close();
    await flush();
    await cleanup;
    expect(resolved).toHaveBeenCalledOnce();
    expect(parent.isOpen()).toBe(true);
    expect(traversals).toEqual([]);
    expect(window.history.state).toEqual(state);
    await back();
    expect(parent.onBack).toHaveBeenCalledOnce();
    expect(child.onBack).not.toHaveBeenCalled();
    expect(location.pathname).toBe("/profile");
    await back();
    expect(location.pathname).toBe("/shop");
  });

  it("allows a closed child to navigate away without waiting for its parent to close", async () => {
    const parent = drawer("template-editor");
    const child = drawer("store-create");
    await flush();
    const navigate = vi.fn(() => {
      window.history.pushState(
        { ...nextState, route: "new-store" },
        "",
        "/shop/store/new-store",
      );
      parent.close();
    });
    const cleanup = waitForCleanup().then(navigate);
    child.close();
    await flush();
    await cleanup;
    await flush();
    expect(navigate).toHaveBeenCalledOnce();
    expect(location.pathname).toBe("/shop/store/new-store");
    expect(traversals).toEqual([]);
    await back();
    expect(location.pathname).toBe("/profile");
    expect(window.history.state).toEqual(nextState);
    expect(parent.onBack).not.toHaveBeenCalled();
    expect(child.onBack).not.toHaveBeenCalled();
  });

  it("adopts an existing sentinel after reload instead of adding another history entry", async () => {
    window.history.pushState(
      { ...nextState, __sastDrawerHistory: "before-reload" },
      "",
      "/profile?dialog=address",
    );
    const pushes = push.mock.calls.length;
    const panel = drawer("address");
    await flush();
    expect(push).toHaveBeenCalledTimes(pushes);
    expect(window.history.state.__sastDrawerHistory).toBe("before-reload");
    await back();
    expect(panel.onBack).toHaveBeenCalledOnce();
    expect(location.pathname).toBe("/profile");
    expect(window.history.state).toEqual(nextState);
    await back();
    expect(location.pathname).toBe("/shop");
    expect(panel.onBack).toHaveBeenCalledOnce();
  });

  it("closes the drawer before the next back navigation leaves the page", async () => {
    const panel = drawer("profile");
    await flush();
    await back();
    expect(panel.onBack).toHaveBeenCalledOnce();
    expect(location.pathname).toBe("/profile");
    await back();
    expect(location.pathname).toBe("/shop");
    expect(panel.onBack).toHaveBeenCalledOnce();
  });

  it("closes only the top nested drawer on each system back", async () => {
    const parent = drawer("address");
    const child = drawer("edit-address");
    await flush();
    await back();
    expect(child.onBack).toHaveBeenCalledOnce();
    expect(parent.onBack).not.toHaveBeenCalled();
    expect(parent.isOpen()).toBe(true);
    await back();
    expect(parent.onBack).toHaveBeenCalledOnce();
    expect(location.pathname).toBe("/profile");
    await back();
    expect(location.pathname).toBe("/shop");
  });

  it("cleans the sentinel after a button or drag closes the last drawer", async () => {
    const panel = drawer("profile");
    await flush();
    panel.close();
    await flush();
    expect(panel.onBack).not.toHaveBeenCalled();
    expect(location.pathname).toBe("/profile");
    await back();
    expect(location.pathname).toBe("/shop");
  });

  it("cleans a manually closed drawer after its profile query is removed without restoring the old query", async () => {
    window.history.replaceState(nextState, "", "/profile?dialog=address");
    const panel = drawer("address");
    await flush();
    panel.close();
    window.history.replaceState(window.history.state, "", "/profile");
    await flush();
    expect(location.pathname).toBe("/profile");
    expect(location.search).toBe("");
    await back();
    expect(location.pathname).toBe("/shop");
    expect(location.search).toBe("");
    expect(panel.onBack).not.toHaveBeenCalled();
  });

  it("keeps the parent's back protection after its child is closed manually", async () => {
    const parent = drawer("address");
    const child = drawer("edit-address");
    await flush();
    child.close();
    await flush();
    await back();
    expect(parent.onBack).toHaveBeenCalledOnce();
    expect(child.onBack).not.toHaveBeenCalled();
    expect(location.pathname).toBe("/profile");
  });

  it("re-arms the sentinel when a pending operation rejects dismissal", async () => {
    const panel = drawer("payment", false);
    await flush();
    await back();
    expect(panel.onBack).toHaveBeenCalledOnce();
    expect(panel.isOpen()).toBe(true);
    expect(location.pathname).toBe("/profile");
    await back();
    expect(panel.onBack).toHaveBeenCalledTimes(2);
    expect(location.pathname).toBe("/profile");
    panel.close();
    await flush();
    await back();
    expect(location.pathname).toBe("/shop");
  });

  it("coalesces Strict Mode cleanup and re-registration without another history entry", async () => {
    const first = drawer("same-drawer");
    await flush();
    const pushes = push.mock.calls.length;
    first.close();
    const replacement = drawer("same-drawer");
    await flush();
    expect(push.mock.calls.length).toBe(pushes);
    await back();
    expect(first.onBack).not.toHaveBeenCalled();
    expect(replacement.onBack).toHaveBeenCalledOnce();
    await back();
    expect(location.pathname).toBe("/shop");
  });

  it("coalesces closing the parent and opening a replacement form in one render", async () => {
    const parent = drawer("address-book");
    await flush();
    parent.close();
    const child = drawer("address-form");
    await flush();
    await back();
    expect(child.onBack).toHaveBeenCalledOnce();
    expect(parent.onBack).not.toHaveBeenCalled();
    expect(location.pathname).toBe("/profile");
  });

  it("queues a newly opened drawer while cleanup is waiting for its asynchronous popstate", async () => {
    const first = drawer("first");
    await flush();
    first.close();
    await vi.runAllTimersAsync();
    expect(traversals).toEqual([-1]);
    const second = drawer("second");
    await flush();
    expect(second.onBack).not.toHaveBeenCalled();
    expect(location.pathname).toBe("/profile");
    await back();
    expect(second.onBack).toHaveBeenCalledOnce();
    await back();
    expect(location.pathname).toBe("/shop");
  });

  it("preserves Next history state and suppresses unrelated listeners only for drawer events", async () => {
    const pagePop = vi.fn();
    window.addEventListener("popstate", pagePop);
    const panel = drawer("profile");
    await flush();
    expect(window.history.state).toEqual(expect.objectContaining(nextState));
    expect(location.pathname).toBe("/profile");
    await back();
    expect(panel.onBack).toHaveBeenCalledOnce();
    expect(pagePop).not.toHaveBeenCalled();
    expect(window.history.state).toEqual(nextState);
    await back();
    expect(pagePop).toHaveBeenCalledOnce();
    expect(location.pathname).toBe("/shop");
  });

  it("skips a stale sentinel left behind by real route navigation", async () => {
    const panel = drawer("publish");
    await flush();
    window.history.pushState(
      { ...nextState, route: "publish" },
      "",
      "/publish/spot",
    );
    panel.close();
    await flush();
    expect(location.pathname).toBe("/publish/spot");
    await back();
    expect(location.pathname).toBe("/profile");
    expect(window.history.state).toEqual(nextState);
    expect(panel.onBack).not.toHaveBeenCalled();
    await back();
    expect(location.pathname).toBe("/shop");
  });
});
