// @vitest-environment jsdom

import React, { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Drawer } from "@workspace/ui/components/drawer";

vi.mock("../../../packages/ui/node_modules/vaul/dist/index.mjs", () => ({
  Drawer: {
    Root: ({
      open,
      onOpenChange,
      children,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      children?: ReactNode;
    }) => (
      <section data-open={String(open)}>
        <button onClick={() => onOpenChange(!open)}>
          {open ? "Primitive close" : "Primitive open"}
        </button>
        {children}
      </section>
    ),
  },
}));

type Entry = { state: Record<string, unknown>; url: string };
let root: Root;
let container: HTMLDivElement;
let entries: Entry[];
let position: number;
let traversals: number[];
const nextState = {
  __NA: true,
  __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: ["profile", {}] },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("React", React);
  traversals = [];
  position = 1;
  entries = [
    { state: nextState, url: new URL("/shop", location.href).href },
    { state: nextState, url: new URL("/profile", location.href).href },
  ];
  const replace = window.history.replaceState.bind(window.history);
  replace(nextState, "", entries[position].url);
  vi.spyOn(window.history, "pushState").mockImplementation(
    (state, _unused, url) => {
      const href =
        url === null || url === undefined
          ? location.href
          : new URL(String(url), location.href).href;
      entries.splice(position + 1);
      entries.push({ state: structuredClone(state), url: href });
      position += 1;
      replace(state, "", href);
    },
  );
  vi.spyOn(window.history, "replaceState").mockImplementation(
    (state, _unused, url) => {
      const href =
        url === null || url === undefined
          ? location.href
          : new URL(String(url), location.href).href;
      entries[position] = { state: structuredClone(state), url: href };
      replace(state, "", href);
    },
  );
  vi.spyOn(window.history, "back").mockImplementation(() => {
    traversals.push(-1);
  });
  vi.spyOn(window.history, "go").mockImplementation((delta = 0) => {
    traversals.push(delta);
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  await flush();
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function flush() {
  for (let step = 0; step < 50; step += 1) {
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    const delta = traversals.shift();
    if (delta === undefined && vi.getTimerCount() === 0) return;
    if (delta !== undefined) {
      const next = position + delta;
      if (next < 0 || next >= entries.length) continue;
      position = next;
      const entry = entries[position];
      window.history.replaceState(entry.state, "", entry.url);
      await act(async () =>
        window.dispatchEvent(
          new PopStateEvent("popstate", { state: entry.state }),
        ),
      );
    }
  }
  throw new Error("Drawer component history did not settle");
}

async function render(children: ReactNode) {
  await act(async () => root.render(children));
  await flush();
}

async function back() {
  window.history.back();
  await flush();
}

async function click() {
  await act(async () => container.querySelector("button")!.click());
  await flush();
}

function isOpen() {
  return (
    container.querySelector("[data-open]")?.getAttribute("data-open") === "true"
  );
}

describe("Drawer system back integration", () => {
  it("opens an uncontrolled drawer through the primitive and closes it on system back", async () => {
    const onOpenChange = vi.fn();
    await render(<Drawer onOpenChange={onOpenChange}>Uncontrolled</Drawer>);
    expect(isOpen()).toBe(false);
    await click();
    expect(isOpen()).toBe(true);
    await back();
    expect(isOpen()).toBe(false);
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    expect(location.pathname).toBe("/profile");
    await back();
    expect(location.pathname).toBe("/shop");
  });

  it("registers and closes an initially open uncontrolled drawer", async () => {
    const onOpenChange = vi.fn();
    await render(
      <Drawer defaultOpen onOpenChange={onOpenChange}>
        Default open
      </Drawer>,
    );
    expect(isOpen()).toBe(true);
    await back();
    expect(isOpen()).toBe(false);
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("asks the controlled owner to close and cleans history after the owner accepts", async () => {
    const changed = vi.fn();
    function Controlled() {
      const [open, setOpen] = useState(true);
      return (
        <Drawer
          open={open}
          onOpenChange={(next) => {
            changed(next);
            setOpen(next);
          }}
        >
          Controlled
        </Drawer>
      );
    }
    await render(<Controlled />);
    await back();
    expect(isOpen()).toBe(false);
    expect(changed).toHaveBeenCalledExactlyOnceWith(false);
    expect(location.pathname).toBe("/profile");
    await back();
    expect(location.pathname).toBe("/shop");
  });

  it("keeps a controlled drawer and re-arms history when the owner rejects closing", async () => {
    const onOpenChange = vi.fn();
    await render(
      <Drawer open onOpenChange={onOpenChange}>
        Pending action
      </Drawer>,
    );
    await back();
    expect(isOpen()).toBe(true);
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(location.pathname).toBe("/profile");
    await back();
    expect(isOpen()).toBe(true);
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(location.pathname).toBe("/profile");
    await render(
      <Drawer open={false} onOpenChange={onOpenChange}>
        Finished action
      </Drawer>,
    );
    await back();
    expect(location.pathname).toBe("/shop");
  });

  it("respects dismissible=false and uses the latest dismissible prop when pending work finishes", async () => {
    const onOpenChange = vi.fn();
    await render(
      <Drawer defaultOpen dismissible={false} onOpenChange={onOpenChange}>
        Pending action
      </Drawer>,
    );
    await back();
    expect(isOpen()).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(location.pathname).toBe("/profile");
    await render(
      <Drawer defaultOpen dismissible onOpenChange={onOpenChange}>
        Finished action
      </Drawer>,
    );
    await back();
    expect(isOpen()).toBe(false);
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("removes its sentinel after a primitive drag or close action without an empty back step", async () => {
    const onOpenChange = vi.fn();
    await render(
      <Drawer defaultOpen onOpenChange={onOpenChange}>
        Dismissible
      </Drawer>,
    );
    await click();
    expect(isOpen()).toBe(false);
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(location.pathname).toBe("/profile");
    await back();
    expect(location.pathname).toBe("/shop");
  });
});
