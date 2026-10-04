// @vitest-environment jsdom

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TransactionAgreementProvider,
  useTransactionAgreement,
} from "../components/transaction-agreement-provider";
import { TransactionAgreementProvider as SharedTransactionAgreementProvider } from "@workspace/ui/components/transaction-agreement";

const { pathname, toastError, toastInfo } = vi.hoisted(() => ({
  pathname: { current: "/shop" },
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));
vi.mock("sonner", () => ({
  toast: { error: toastError, info: toastInfo },
}));

vi.mock("@workspace/ui/components/drawer", async () => {
  const React = await import("react");
  const DrawerContext = React.createContext<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }>({ open: false, onOpenChange: () => undefined });
  const Drawer = ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
  }) => (
    <DrawerContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DrawerContext.Provider>
  );
  const DrawerContent = ({ children }: { children: ReactNode }) => {
    const { open, onOpenChange } = React.useContext(DrawerContext);
    return open ? (
      <div role="dialog">
        {children}
        <button
          type="button"
          aria-label="关闭协议弹层"
          onClick={() => onOpenChange(false)}
        />
      </div>
    ) : null;
  };
  const Container = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Drawer,
    DrawerContent,
    DrawerPortal: Container,
    DrawerOverlay: () => null,
    DrawerHeader: Container,
    DrawerFooter: Container,
    DrawerTitle: Container,
    DrawerDescription: Container,
  };
});

vi.mock("@workspace/ui/components/dialog", async () => {
  const React = await import("react");
  const DialogContext = React.createContext<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }>({ open: false, onOpenChange: () => undefined });
  const Dialog = ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
  }) => (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
  const DialogContent = ({ children }: { children: ReactNode }) => {
    const { open, onOpenChange } = React.useContext(DialogContext);
    return open ? (
      <div role="dialog">
        {children}
        <button
          type="button"
          aria-label="关闭协议弹层"
          onClick={() => onOpenChange(false)}
        />
      </div>
    ) : null;
  };
  const Container = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog,
    DialogContent,
    DialogHeader: Container,
    DialogFooter: Container,
    DialogTitle: Container,
    DialogDescription: Container,
  };
});

const storageKey = "sast-shop:transaction-agreement";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

let root: Root;
let container: HTMLDivElement;
let storage: MemoryStorage;
let transaction: ReturnType<typeof vi.fn>;
let beforePrompt: ReturnType<typeof vi.fn>;
let outcomes: boolean[];

function Consumer() {
  const { ensureAgreement, openAgreement } = useTransactionAgreement();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void ensureAgreement(beforePrompt).then((agreed) => {
            outcomes.push(agreed);
            if (agreed) transaction();
          });
        }}
      >
        发起交易
      </button>
      <button type="button" onClick={openAgreement}>
        查看交易协议
      </button>
    </>
  );
}

async function renderProvider(requireUserIdentity = false) {
  await act(async () =>
    root.render(
      <TransactionAgreementProvider requireUserIdentity={requireUserIdentity}>
        <Consumer />
      </TransactionAgreementProvider>,
    ),
  );
}

async function renderSharedDialog() {
  await act(async () =>
    root.render(
      <SharedTransactionAgreementProvider presentation="dialog">
        <Consumer />
      </SharedTransactionAgreementProvider>,
    ),
  );
}

function dialog() {
  const element = container.querySelector<HTMLElement>('[role="dialog"]');
  expect(element).not.toBeNull();
  return element!;
}

function button(label: string) {
  const element = Array.from(container.querySelectorAll("button")).find(
    (candidate) =>
      candidate.getAttribute("aria-label") === label ||
      candidate.textContent?.trim() === label,
  );
  expect(element, `Missing button: ${label}`).toBeDefined();
  return element!;
}

async function click(label: string) {
  await act(async () => button(label).click());
}

async function advance(milliseconds: number) {
  await act(async () => vi.advanceTimersByTime(milliseconds));
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-04T00:00:00.000Z"));
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
  pathname.current = "/shop";
  toastError.mockReset();
  toastInfo.mockReset();
  transaction = vi.fn();
  beforePrompt = vi.fn();
  outcomes = [];
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("transaction agreement", () => {
  it("requires five seconds of an open drawer before persisting consent and allowing a transaction", async () => {
    await renderProvider();
    await click("发起交易");

    expect(dialog().textContent).toContain("交易协议");
    expect(dialog().textContent).toContain("资金处理范围");
    expect(dialog().textContent).toContain("交易纠纷");
    expect(button("同意并继续").disabled).toBe(true);
    expect(beforePrompt).toHaveBeenCalledTimes(1);
    expect(transaction).not.toHaveBeenCalled();

    await advance(4_999);
    expect(button("同意并继续").disabled).toBe(true);
    expect(window.localStorage.getItem(storageKey)).toBeNull();

    await advance(1);
    expect(button("同意并继续").disabled).toBe(false);
    await click("同意并继续");

    expect(transaction).toHaveBeenCalledTimes(1);
    const record = JSON.parse(window.localStorage.getItem(storageKey)!);
    expect(record.version).toBe(1);
    expect(new Date(record.agreedAt).toISOString()).toBe(
      "2026-10-04T00:00:05.000Z",
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    await click("发起交易");
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(beforePrompt).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("cancels the pending action and restarts the countdown after closing", async () => {
    await renderProvider();
    await click("发起交易");

    await advance(4_000);
    await click("关闭协议弹层");
    expect(outcomes).toEqual([false]);
    expect(window.localStorage.getItem(storageKey)).toBeNull();

    await click("发起交易");
    await advance(1_000);
    expect(button("同意并继续").disabled).toBe(true);
    await advance(4_000);
    expect(button("同意并继续").disabled).toBe(false);
    await click("暂不同意");
    expect(outcomes).toEqual([false, false]);
    expect(window.localStorage.getItem(storageKey)).toBeNull();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("allows only the first concurrent request to proceed", async () => {
    await renderProvider();
    await click("发起交易");
    await click("发起交易");
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(beforePrompt).toHaveBeenCalledTimes(1);
    expect(outcomes).toEqual([false]);

    await advance(5_000);
    await click("同意并继续");
    expect(outcomes).toEqual([false, true]);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("keeps the request pending when storage fails and allows retry after storage recovers", async () => {
    const write = vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    await renderProvider();
    await click("发起交易");
    await advance(5_000);
    await click("同意并继续");

    expect(dialog()).toBeDefined();
    expect(window.localStorage.getItem(storageKey)).toBeNull();
    expect(outcomes).toEqual([]);
    expect(transaction).not.toHaveBeenCalled();

    write.mockRestore();
    await click("同意并继续");
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(storageKey)).not.toBeNull();
  });

  it("preserves consent across remounts and treats another version as unaccepted", async () => {
    await renderProvider();
    await click("发起交易");
    await advance(5_000);
    await click("同意并继续");

    await act(async () => root.unmount());
    root = createRoot(container);
    await renderProvider();
    await click("发起交易");
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    const saved = JSON.parse(window.localStorage.getItem(storageKey)!);
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ ...saved, version: 0 }),
    );
    await act(async () => root.unmount());
    root = createRoot(container);
    await renderProvider();
    await click("发起交易");
    expect(dialog()).toBeDefined();
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("lets a user view the agreement without starting a transaction or saving consent", async () => {
    await renderProvider();
    await click("查看交易协议");
    expect(dialog().textContent).toContain("交易协议");
    await advance(5_000);
    await click("关闭协议弹层");

    expect(transaction).not.toHaveBeenCalled();
    expect(beforePrompt).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });

  it("resolves a pending request as false when the provider unmounts", async () => {
    await renderProvider();
    await click("发起交易");

    await act(async () => root.unmount());
    root = createRoot(container);
    expect(outcomes).toEqual([false]);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("cancels a pending request when navigation changes the pathname", async () => {
    await renderProvider();
    await click("发起交易");

    pathname.current = "/orders";
    await renderProvider();

    expect(outcomes).toEqual([false]);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("keeps production consent separate for each authenticated user", async () => {
    let currentUser = "user-a";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ authenticated: true, user: { id: currentUser } }),
      ),
    );
    await renderProvider(true);

    await click("发起交易");
    await advance(5_000);
    await click("同意并继续");
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(`${storageKey}:user-a`)).not.toBeNull();

    currentUser = "user-b";
    await click("发起交易");
    expect(dialog()).toBeDefined();
    expect(button("同意并继续").disabled).toBe(true);
    expect(transaction).toHaveBeenCalledTimes(1);
    await advance(5_000);
    await click("同意并继续");
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem(`${storageKey}:user-b`)).not.toBeNull();

    currentUser = "user-a";
    await click("发起交易");
    expect(transaction).toHaveBeenCalledTimes(3);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("does not accept the original request if the account changes while reading", async () => {
    let currentUser = "user-a";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ authenticated: true, user: { id: currentUser } }),
      ),
    );
    await renderProvider(true);

    await click("发起交易");
    await advance(5_000);
    currentUser = "user-b";
    await click("同意并继续");

    expect(outcomes).toEqual([false]);
    expect(transaction).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(`${storageKey}:user-a`)).toBeNull();
    expect(window.localStorage.getItem(`${storageKey}:user-b`)).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("does not prompt or proceed when identity lookup fails, then allows retry", async () => {
    const fetchSession = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ authenticated: false, user: null }),
      )
      .mockResolvedValue(
        Response.json({ authenticated: true, user: { id: "user-a" } }),
      );
    vi.stubGlobal("fetch", fetchSession);
    await renderProvider(true);

    await click("发起交易");
    expect(outcomes).toEqual([false]);
    expect(transaction).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("登录"));

    await click("发起交易");
    expect(dialog()).toBeDefined();
    expect(fetchSession).toHaveBeenCalledTimes(2);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("times out a stalled identity lookup after ten seconds and permits retry", async () => {
    const fetchSession = vi
      .fn()
      .mockImplementationOnce(
        (_input: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("Request aborted", "AbortError")),
              { once: true },
            );
          }),
      )
      .mockResolvedValue(
        Response.json({ authenticated: true, user: { id: "user-a" } }),
      );
    vi.stubGlobal("fetch", fetchSession);
    await renderProvider(true);

    await click("发起交易");
    await advance(9_999);
    expect(outcomes).toEqual([]);
    expect(transaction).not.toHaveBeenCalled();

    await advance(1);
    expect(outcomes).toEqual([false]);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    await click("发起交易");
    expect(dialog()).toBeDefined();
    expect(fetchSession).toHaveBeenCalledTimes(2);
  });
});

describe("shared desktop transaction agreement", () => {
  it("shows the complete text in a dialog and waits five seconds before accepting", async () => {
    await renderSharedDialog();
    await click("发起交易");

    expect(dialog().textContent).toContain("资金处理范围");
    expect(dialog().textContent).toContain("交易纠纷");
    expect(button("同意并继续").disabled).toBe(true);
    await advance(4_999);
    expect(button("同意并继续").disabled).toBe(true);
    await advance(1);
    expect(button("同意并继续").disabled).toBe(false);

    await click("同意并继续");
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(storageKey)).not.toBeNull();
  });

  it("opens a read-only dialog without consent or a transaction", async () => {
    await renderSharedDialog();
    await click("查看交易协议");
    expect(dialog().textContent).toContain("交易协议");
    await advance(5_000);
    expect(container.querySelector('[aria-label="同意并继续"]')).toBeNull();
    await click("关闭协议弹层");

    expect(transaction).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });
});
