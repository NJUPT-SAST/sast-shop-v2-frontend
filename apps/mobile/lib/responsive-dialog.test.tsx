// @vitest-environment jsdom

import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@workspace/ui/components/responsive-dialog";

let root: Root;
let container: HTMLDivElement;
let desktop: boolean;
let listeners: Set<() => void>;

function DialogProbe({ forceDrawer = false }: { forceDrawer?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      forceDrawer={forceDrawer}
    >
      <ResponsiveDialogTrigger>打开</ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>确认操作</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            查看操作内容
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogFooter>
          <ResponsiveDialogClose>取消</ResponsiveDialogClose>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  desktop = true;
  listeners = new Set();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query === "(min-width: 768px)" && desktop;
    },
    addEventListener: (_event: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) =>
      listeners.delete(listener),
  }));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function openDialog(forceDrawer = false) {
  await act(async () => root.render(<DialogProbe forceDrawer={forceDrawer} />));
  await act(async () => container.querySelector("button")!.click());
}

describe("responsive dialog", () => {
  it("shares one viewport subscription across real dialog children and switches to a drawer", async () => {
    await openDialog();
    expect(
      document.querySelector('[data-slot="dialog-content"]'),
    ).not.toBeNull();
    expect(listeners.size).toBe(1);

    await act(async () => {
      desktop = false;
      listeners.forEach((listener) => listener());
    });
    expect(
      document.querySelector('[data-slot="drawer-content"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-slot="drawer-title"]')!.textContent,
    ).toBe("确认操作");
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
    expect(listeners.size).toBe(1);
    await act(async () => {
      document
        .querySelector<HTMLButtonElement>('[data-slot="drawer-close"]')!
        .click();
    });
    expect(
      document
        .querySelector('[data-slot="drawer-content"]')
        ?.getAttribute("data-state"),
    ).toBe("closed");
  });

  it("keeps forced drawer children consistent in a desktop viewport", async () => {
    await openDialog(true);
    expect(
      document.querySelector('[data-slot="drawer-content"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-slot="drawer-header"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-slot="drawer-footer"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
    expect(listeners.size).toBe(1);
  });
});
