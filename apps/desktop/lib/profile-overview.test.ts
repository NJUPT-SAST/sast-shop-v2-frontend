import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadDesktopProfileOverview } from "./profile-overview";

const { getCurrentUser, listAddresses, listPaymentQrCodes } = vi.hoisted(
  () => ({
    getCurrentUser: vi.fn(),
    listAddresses: vi.fn(),
    listPaymentQrCodes: vi.fn(),
  }),
);
vi.mock("@sast-shop/api", () => ({
  getCurrentUser,
  listAddresses,
  listPaymentQrCodes,
}));

const user = { id: "10001", name: "同学", avatarUrl: "" };
beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue(user);
  listAddresses.mockReset().mockResolvedValue([]);
  listPaymentQrCodes.mockReset().mockResolvedValue([]);
});

describe("desktop profile loading", () => {
  it("keeps the account and addresses available when QR loading fails", async () => {
    const address = { id: "1", isDefault: true };
    listAddresses.mockResolvedValue([address]);
    listPaymentQrCodes.mockRejectedValue(new Error("QR unavailable"));
    const result = await loadDesktopProfileOverview({ dataSource: "mock" });
    expect(result.overview?.user).toEqual(user);
    expect(result.overview?.addresses).toEqual([address]);
    expect(result.overview?.defaultAddress).toEqual(address);
    expect(result.addressError).toBeNull();
    expect(result.qrError).toContain("加载失败");
  });

  it("keeps QR status available when address loading fails", async () => {
    const qr = { channel: "wechat", content: "wxp://test" };
    listPaymentQrCodes.mockResolvedValue([qr]);
    listAddresses.mockRejectedValue(new Error("Address unavailable"));
    const result = await loadDesktopProfileOverview({ dataSource: "mock" });
    expect(result.overview?.paymentQrCodes).toEqual([qr]);
    expect(result.addressError).toContain("加载失败");
    expect(result.qrError).toBeNull();
  });

  it("does not present a successful profile when user loading fails", async () => {
    getCurrentUser.mockRejectedValue(new Error("Unauthorized"));
    const result = await loadDesktopProfileOverview({ dataSource: "mock" });
    expect(result.overview).toBeNull();
    expect(result.error).toContain("个人资料暂不可用");
  });
});
