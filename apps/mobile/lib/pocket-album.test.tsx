// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PocketAlbum } from "../components/pocket/pocket-album";

const { listPocketAlbum, setPocketAlbumAccess, ensureAgreement } = vi.hoisted(
  () => ({
    listPocketAlbum: vi.fn(),
    setPocketAlbumAccess: vi.fn(),
    ensureAgreement: vi.fn(),
  }),
);

vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  listPocketAlbum,
  setPocketAlbumAccess,
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement }),
}));

let root: Root;
let container: HTMLDivElement;

function photo(id: string) {
  return {
    id,
    pocketId: "12",
    previewUrl: `https://example.com/${id}.jpg`,
    retentionUntil: "2026-11-01T00:00:00Z",
  };
}

async function mount({
  initiallyAccepted = false,
  isOwner = false,
  ownerParticipates = true,
} = {}) {
  await act(async () =>
    root.render(
      <PocketAlbum
        pocketId="12"
        initiallyAccepted={initiallyAccepted}
        isOwner={isOwner}
        ownerParticipates={ownerParticipates}
      />,
    ),
  );
}

function button(text: string) {
  const result = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text,
  );
  expect(result).toBeDefined();
  return result!;
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  listPocketAlbum.mockReset().mockResolvedValue({
    photos: [photo("25")],
    nextPageToken: "",
  });
  setPocketAlbumAccess.mockReset().mockResolvedValue(undefined);
  ensureAgreement.mockReset().mockResolvedValue(true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("Pocket album access and pagination", () => {
  it("waits for access consent before loading and permits revocation without affecting payment", async () => {
    await mount();
    expect(listPocketAlbum).not.toHaveBeenCalled();
    await act(async () => button("同意并查看合照").click());
    expect(setPocketAlbumAccess).toHaveBeenCalledExactlyOnceWith(
      { pocketId: "12", accepted: true, requestId: expect.any(String) },
      {},
    );
    expect(listPocketAlbum).toHaveBeenCalledExactlyOnceWith(
      { pocketId: "12" },
      {},
    );
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(button("刷新合照")).toBeDefined();
    await act(async () => button("撤回相册访问同意").click());
    expect(setPocketAlbumAccess).toHaveBeenLastCalledWith(
      { pocketId: "12", accepted: false, requestId: expect.any(String) },
      {},
    );
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(button("同意并查看合照")).toBeDefined();
    expect(ensureAgreement).not.toHaveBeenCalled();
  });

  it("shows the first load in progress, prevents duplicate clicks, and appends the next page", async () => {
    let resolvePage!: (value: {
      photos: ReturnType<typeof photo>[];
      nextPageToken: string;
    }) => void;
    const firstPage = new Promise<{
      photos: ReturnType<typeof photo>[];
      nextPageToken: string;
    }>((resolve) => {
      resolvePage = resolve;
    });
    listPocketAlbum.mockReturnValueOnce(firstPage);
    await mount({ initiallyAccepted: true });
    await act(async () => {
      button("查看合照").click();
      button("查看合照").click();
    });
    expect(listPocketAlbum).toHaveBeenCalledOnce();
    expect(button("查看合照").disabled).toBe(true);
    expect(
      container.querySelector('[role="status"][aria-label="正在加载合照"]'),
    ).not.toBeNull();
    await act(async () =>
      resolvePage({ photos: [photo("25")], nextPageToken: "next-1" }),
    );
    listPocketAlbum.mockResolvedValueOnce({
      photos: [photo("26")],
      nextPageToken: "",
    });
    await act(async () => button("更多合照").click());
    expect(listPocketAlbum).toHaveBeenLastCalledWith(
      { pocketId: "12", pageToken: "next-1" },
      {},
    );
    expect(
      Array.from(container.querySelectorAll("a")).map((link) => link.href),
    ).toEqual(["https://example.com/25.jpg", "https://example.com/26.jpg"]);
  });

  it("retains loaded photos when a refresh fails and allows another refresh", async () => {
    await mount({ initiallyAccepted: true });
    await act(async () => button("查看合照").click());
    listPocketAlbum.mockRejectedValueOnce(new Error("network offline"));
    await act(async () => button("刷新合照").click());
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(button("刷新合照").disabled).toBe(false);
    listPocketAlbum.mockResolvedValueOnce({ photos: [], nextPageToken: "" });
    await act(async () => button("刷新合照").click());
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain("暂无可查看的合照");
  });

  it("lets a nonparticipating owner view their uploaded photos without granting member consent", async () => {
    await mount({ isOwner: true, ownerParticipates: false });
    await act(async () => button("查看我上传的合照").click());
    expect(listPocketAlbum).toHaveBeenCalledOnce();
    expect(setPocketAlbumAccess).not.toHaveBeenCalled();
    expect(button("删除照片")).toBeDefined();
    expect(container.textContent).not.toContain("撤回相册访问同意");
  });

  it("retries a failed first page without repeating accepted access consent", async () => {
    listPocketAlbum.mockRejectedValueOnce(new Error("network offline"));
    await mount();
    await act(async () => button("同意并查看合照").click());
    expect(setPocketAlbumAccess).toHaveBeenCalledOnce();
    expect(container.querySelectorAll("a")).toHaveLength(0);
    await act(async () => button("重新加载").click());
    expect(setPocketAlbumAccess).toHaveBeenCalledOnce();
    expect(listPocketAlbum).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll("a")).toHaveLength(1);
  });

  it("retries only the failed next page and keeps its token and loaded photos", async () => {
    listPocketAlbum.mockResolvedValueOnce({
      photos: [photo("25")],
      nextPageToken: "next-1",
    });
    await mount({ initiallyAccepted: true });
    await act(async () => button("查看合照").click());
    listPocketAlbum.mockRejectedValueOnce(new Error("network offline"));
    await act(async () => button("更多合照").click());
    expect(container.querySelectorAll("a")).toHaveLength(1);
    listPocketAlbum.mockResolvedValueOnce({
      photos: [photo("26")],
      nextPageToken: "",
    });
    await act(async () => button("重新加载").click());
    expect(listPocketAlbum).toHaveBeenLastCalledWith(
      { pocketId: "12", pageToken: "next-1" },
      {},
    );
    expect(container.querySelectorAll("a")).toHaveLength(2);
    expect(container.textContent).not.toContain("更多合照");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("does not load or accept a new album after an old consent response arrives", async () => {
    let resolveConsent!: () => void;
    setPocketAlbumAccess.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveConsent = resolve;
      }),
    );
    await mount();
    await act(async () => button("同意并查看合照").click());
    await act(async () =>
      root.render(
        <PocketAlbum
          key="99"
          pocketId="99"
          initiallyAccepted={false}
          isOwner={false}
          ownerParticipates
        />,
      ),
    );
    await act(async () => resolveConsent());
    expect(listPocketAlbum).not.toHaveBeenCalled();
    expect(button("同意并查看合照")).toBeDefined();
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });
});
