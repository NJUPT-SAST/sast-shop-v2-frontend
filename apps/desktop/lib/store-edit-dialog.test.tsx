// @vitest-environment jsdom

import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "@sast-shop/api";
import { StoreEditDialog } from "../components/store-edit-dialog";

const { listStores, updateStore, uploadProductImage, onSaved, onOpenChange } =
  vi.hoisted(() => ({
    listStores: vi.fn(),
    updateStore: vi.fn(),
    uploadProductImage: vi.fn(),
    onSaved: vi.fn(),
    onOpenChange: vi.fn(),
  }));
vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  listStores,
  updateStore,
}));
vi.mock("./product-image-upload", () => ({ uploadProductImage }));
const store = {
  id: "3",
  name: "最新店铺",
  address: "仙林校区",
  logoUrl: "https://example.com/logo.png",
  themeColor: "#123456",
};
const options = {
  dataSource: "local",
  connectBaseUrl: "http://localhost/api/connect",
};
let root: Root;
let container: HTMLDivElement;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function render(open = true) {
  await act(async () =>
    root.render(
      <StoreEditDialog
        open={open}
        onOpenChange={onOpenChange}
        onSaved={onSaved}
        storeId="3"
        dataSource="local"
        connectBaseUrl={options.connectBaseUrl}
      />,
    ),
  );
}
async function change(id: string, value: string) {
  await act(async () => {
    const input = document.body.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >(`#${id}`)!;
    const prototype =
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
      input,
      value,
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () =>
    document.body.querySelector<HTMLFormElement>("form")!.requestSubmit(),
  );
}
function button(text: string) {
  return Array.from(document.body.querySelectorAll("button")).find(
    (item) => item.textContent === text,
  )!;
}
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  listStores.mockReset().mockResolvedValue([store]);
  updateStore.mockReset().mockResolvedValue({ ...store, name: "改名店铺" });
  uploadProductImage
    .mockReset()
    .mockResolvedValue("https://example.com/new.png");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("store editor", () => {
  it("shows the form skeleton while loading and replaces it with fresh fields", async () => {
    const response = deferred<(typeof store)[]>();
    listStores.mockReturnValue(response.promise);
    await render();
    const loading = document.body.querySelector(
      '[role="status"][aria-label="正在加载店铺资料"]',
    );
    expect(loading).not.toBeNull();
    expect(loading!.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(document.body.querySelector("form")).toBeNull();
    expect(button("保存修改").disabled).toBe(true);
    expect(button("取消").disabled).toBe(true);
    await act(async () => response.resolve([store]));
    expect(
      document.body.querySelector(
        '[role="status"][aria-label="正在加载店铺资料"]',
      ),
    ).toBeNull();
    expect(
      document.body.querySelector<HTMLInputElement>("#desktop-edit-store-name")!
        .value,
    ).toBe(store.name);
    expect(
      document.body.querySelector<HTMLTextAreaElement>(
        "#desktop-edit-store-address",
      )!.value,
    ).toBe(store.address);
    expect(button("取消").disabled).toBe(false);
  });

  it("loads fresh data every time the editor opens and sends only changed fields", async () => {
    await render();
    expect(listStores).toHaveBeenCalledExactlyOnceWith(options);
    expect(
      document.body.querySelector<HTMLInputElement>("#desktop-edit-store-name")!
        .value,
    ).toBe(store.name);
    expect(button("保存修改").disabled).toBe(true);
    await change("desktop-edit-store-name", "  改名店铺  ");
    await submit();
    expect(updateStore).toHaveBeenCalledExactlyOnceWith(
      { id: "3", patch: { name: "改名店铺" } },
      options,
    );
    expect(onSaved).toHaveBeenCalledWith({ ...store, name: "改名店铺" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await render(false);
    listStores.mockResolvedValue([{ ...store, address: "三牌楼校区" }]);
    await render();
    expect(
      document.body.querySelector<HTMLTextAreaElement>(
        "#desktop-edit-store-address",
      )!.value,
    ).toBe("三牌楼校区");
    expect(listStores).toHaveBeenCalledTimes(2);
  });

  it("allows retrying an initial read failure before editing", async () => {
    listStores.mockRejectedValueOnce(new Error("offline"));
    await render();
    expect(document.body.querySelector("form")).toBeNull();
    expect(updateStore).not.toHaveBeenCalled();
    await act(async () => button("重新加载").click());
    expect(
      document.body.querySelector<HTMLInputElement>("#desktop-edit-store-name")!
        .value,
    ).toBe(store.name);
  });

  it("shows associated field errors, keeps input and prevents invalid writes", async () => {
    await render();
    await change("desktop-edit-store-name", " ");
    await submit();
    const input = document.body.querySelector<HTMLInputElement>(
      "#desktop-edit-store-name",
    )!;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(
      "desktop-edit-store-name-error",
    );
    expect(
      document.body.querySelector("#desktop-edit-store-name-error")!
        .textContent,
    ).toBe("请输入店铺名称");
    expect(document.activeElement).toBe(input);
    expect(updateStore).not.toHaveBeenCalled();
    await change("desktop-edit-store-name", "改名店铺");
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(
      document.body.querySelector("#desktop-edit-store-name-error"),
    ).toBeNull();
    await submit();
    expect(updateStore).toHaveBeenCalledOnce();
  });

  it("locks duplicate submissions and closing while the write is pending", async () => {
    const response = deferred<typeof store>();
    updateStore.mockReturnValue(response.promise);
    await render();
    await change("desktop-edit-store-name", "改名店铺");
    await submit();
    await submit();
    await act(async () => button("取消").click());
    expect(updateStore).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(
      document.body.querySelector<HTMLInputElement>("#desktop-edit-store-name")!
        .disabled,
    ).toBe(true);
    await act(async () => response.resolve({ ...store, name: "改名店铺" }));
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("keeps the draft after a definite validation failure and allows correction", async () => {
    updateStore.mockRejectedValueOnce(new ValidationError("店铺名称过长"));
    await render();
    await change("desktop-edit-store-name", "改名店铺");
    await submit();
    expect(document.body.textContent).toContain("店铺名称过长");
    expect(listStores).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
    expect(
      document.body.querySelector<HTMLInputElement>("#desktop-edit-store-name")!
        .value,
    ).toBe("改名店铺");
    expect(button("保存修改").disabled).toBe(false);
    await submit();
    expect(updateStore).toHaveBeenCalledTimes(2);
  });

  it("reconciles a lost write response without rewriting", async () => {
    updateStore.mockRejectedValue(new Error("response lost"));
    listStores
      .mockResolvedValueOnce([store])
      .mockResolvedValue([
        { ...store, name: "改名店铺", themeColor: "#abcdef" },
      ]);
    await render();
    await change("desktop-edit-store-name", "改名店铺");
    await submit();
    expect(updateStore).toHaveBeenCalledOnce();
    expect(listStores).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenCalledWith({
      ...store,
      name: "改名店铺",
      themeColor: "#abcdef",
    });
  });

  it("locks an unknown result until reading succeeds and preserves the pending patch", async () => {
    updateStore.mockRejectedValue(new Error("response lost"));
    listStores
      .mockResolvedValueOnce([store])
      .mockRejectedValueOnce(new Error("offline"));
    await render();
    await change("desktop-edit-store-name", "改名店铺");
    await submit();
    expect(button("取消").disabled).toBe(true);
    expect(
      document.body.querySelector<HTMLInputElement>("#desktop-edit-store-name")!
        .value,
    ).toBe("改名店铺");
    expect(onSaved).not.toHaveBeenCalled();
    await submit();
    expect(updateStore).toHaveBeenCalledOnce();
    listStores.mockResolvedValue([{ ...store, name: "改名店铺" }]);
    await act(async () => button("重新核实").click());
    expect(onSaved).toHaveBeenCalledOnce();
    expect(updateStore).toHaveBeenCalledOnce();
  });

  it("preserves edits after a nonmatching read and retries only dirty fields against fresh data", async () => {
    updateStore.mockRejectedValueOnce(new Error("write failed"));
    listStores
      .mockResolvedValueOnce([store])
      .mockResolvedValue([{ ...store, address: "新地址" }]);
    await render();
    await change("desktop-edit-store-name", "改名店铺");
    await change("desktop-edit-store-address", "新地址");
    await submit();
    expect(onSaved).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("请核对输入后重新保存");
    expect(
      document.body.querySelector<HTMLInputElement>("#desktop-edit-store-name")!
        .value,
    ).toBe("改名店铺");
    expect(button("保存修改").disabled).toBe(false);
    await submit();
    expect(updateStore.mock.calls[1]).toEqual([
      { id: "3", patch: { name: "改名店铺" } },
      options,
    ]);
  });

  it("removes a logo with an explicit empty patch value", async () => {
    await render();
    const remove = document.body.querySelector<HTMLButtonElement>(
      '[aria-label="移除店铺 Logo"]',
    )!;
    expect(remove).not.toBeNull();
    await act(async () => remove.click());
    expect(
      document.body.querySelector('[aria-label="移除店铺 Logo"]'),
    ).toBeNull();
    expect(button("上传 Logo")).toBeDefined();
    await submit();
    expect(updateStore).toHaveBeenCalledExactlyOnceWith(
      { id: "3", patch: { logoUrl: "" } },
      options,
    );
  });

  it("refreshes untouched fields after reconciliation to avoid overwriting concurrent edits", async () => {
    updateStore.mockRejectedValueOnce(new Error("write failed"));
    listStores.mockResolvedValueOnce([store]).mockResolvedValue([
      {
        ...store,
        address: "另一位用户的新地址",
        logoUrl: "https://example.com/concurrent.png",
      },
    ]);
    await render();
    await change("desktop-edit-store-name", "改名店铺");
    await submit();
    expect(
      document.body.querySelector<HTMLTextAreaElement>(
        "#desktop-edit-store-address",
      )!.value,
    ).toBe("另一位用户的新地址");
    await submit();
    expect(updateStore.mock.calls[1]).toEqual([
      { id: "3", patch: { name: "改名店铺" } },
      options,
    ]);
  });

  it("prevents saving during upload and sends the uploaded logo", async () => {
    const upload = deferred<string>();
    uploadProductImage.mockReturnValue(upload.promise);
    await render();
    const input =
      document.body.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["image"], "logo.png", { type: "image/png" });
    Object.defineProperty(input, "files", { value: [file] });
    await act(async () =>
      input.dispatchEvent(new Event("change", { bubbles: true })),
    );
    expect(button("更改").disabled).toBe(true);
    const remove = document.body.querySelector<HTMLButtonElement>(
      '[aria-label="移除店铺 Logo"]',
    )!;
    expect(remove.disabled).toBe(true);
    await act(async () => remove.click());
    await submit();
    expect(updateStore).not.toHaveBeenCalled();
    expect(button("取消").disabled).toBe(true);
    await act(async () => upload.resolve("https://example.com/new.png"));
    await submit();
    expect(updateStore).toHaveBeenCalledExactlyOnceWith(
      { id: "3", patch: { logoUrl: "https://example.com/new.png" } },
      options,
    );
  });

  it("ignores late writes after the editor unmounts", async () => {
    const response = deferred<typeof store>();
    updateStore.mockReturnValue(response.promise);
    await render();
    await change("desktop-edit-store-name", "改名店铺");
    await submit();
    await act(async () => root.render(null));
    await act(async () => response.resolve({ ...store, name: "改名店铺" }));
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("focuses the name field after loading and uses a footer submit button", async () => {
    await render();
    const input = document.body.querySelector<HTMLInputElement>(
      "#desktop-edit-store-name",
    )!;
    expect(document.activeElement).toBe(input);
    const save = button("保存修改");
    expect(save.getAttribute("form")).toBe("desktop-store-edit-form");
    await change("desktop-edit-store-name", "改名店铺");
    await act(async () => save.click());
    expect(updateStore).toHaveBeenCalledExactlyOnceWith(
      { id: "3", patch: { name: "改名店铺" } },
      options,
    );
  });

  it("prevents Escape dismissal during a write and during uncertain recovery", async () => {
    const response = deferred<typeof store>();
    updateStore.mockReturnValueOnce(response.promise);
    await render();
    await change("desktop-edit-store-name", "改名店铺");
    await submit();
    await act(async () =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => response.resolve({ ...store, name: "改名店铺" }));
  });

  it("prevents Escape dismissal while an unknown write awaits read verification", async () => {
    updateStore.mockRejectedValue(new Error("response lost"));
    listStores
      .mockResolvedValueOnce([store])
      .mockRejectedValueOnce(new Error("offline"));
    await render();
    await change("desktop-edit-store-name", "改名店铺");
    await submit();
    await act(async () =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(button("重新核实")).toBeDefined();
    expect(updateStore).toHaveBeenCalledOnce();
  });

  it("closes with Escape and restores focus to the initiating button", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>编辑店铺入口</button>
          <StoreEditDialog
            open={open}
            onOpenChange={setOpen}
            onSaved={onSaved}
            storeId="3"
            dataSource="local"
            connectBaseUrl={options.connectBaseUrl}
          />
        </>
      );
    }
    await act(async () => root.render(<Harness />));
    const trigger = button("编辑店铺入口");
    await act(async () => {
      trigger.focus();
      trigger.click();
    });
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
