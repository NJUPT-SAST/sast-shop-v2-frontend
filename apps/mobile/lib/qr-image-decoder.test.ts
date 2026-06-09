import jsQR from "jsqr";
import { afterEach, describe, expect, it, vi } from "vitest";

import { decodePaymentQrImage } from "./qr-image-decoder";

vi.mock("jsqr", () => ({
  default: vi.fn(),
}));

const imageBytes = new Uint8ClampedArray([0, 0, 0, 255]);

function createImageFile(type = "image/png") {
  return new File(["qr"], "qr.png", { type });
}

function stubBrowserImageRead() {
  const drawImage = vi.fn();
  const getImageData = vi.fn(() => ({
    data: imageBytes,
    width: 1,
    height: 1,
  }));
  const getContext = vi.fn(() => ({
    drawImage,
    getImageData,
  }));
  const createElement = vi.fn(() => ({
    width: 0,
    height: 0,
    getContext,
  }));
  const createObjectURL = vi.fn(() => "blob:qr-image");
  const revokeObjectURL = vi.fn();

  class TestImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 240;
    naturalHeight = 240;

    set src(_value: string) {
      queueMicrotask(() => {
        this.onload?.();
      });
    }
  }

  vi.stubGlobal("document", { createElement });
  vi.stubGlobal("Image", TestImage);
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

  return {
    createElement,
    createObjectURL,
    drawImage,
    getImageData,
    revokeObjectURL,
  };
}

describe("decodePaymentQrImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("rejects non-image files", async () => {
    await expect(
      decodePaymentQrImage(createImageFile("text/plain")),
    ).rejects.toThrow("请上传图片格式的二维码");

    expect(jsQR).not.toHaveBeenCalled();
  });

  it("rejects oversized images", async () => {
    const file = {
      size: 5 * 1024 * 1024 + 1,
      type: "image/png",
    } as File;

    await expect(decodePaymentQrImage(file)).rejects.toThrow(
      "二维码图片不能超过 5MB",
    );

    expect(jsQR).not.toHaveBeenCalled();
  });

  it("throws a toast-friendly error when no QR code is detected", async () => {
    stubBrowserImageRead();
    vi.mocked(jsQR).mockReturnValue(null);

    await expect(decodePaymentQrImage(createImageFile())).rejects.toThrow(
      "未识别到二维码，请换一张清晰图片",
    );
  });

  it("returns decoded QR text without exposing image data", async () => {
    const browser = stubBrowserImageRead();
    vi.mocked(jsQR).mockReturnValue({
      data: "wxp://example-pay",
    } as ReturnType<typeof jsQR>);

    await expect(decodePaymentQrImage(createImageFile())).resolves.toBe(
      "wxp://example-pay",
    );

    expect(browser.drawImage).toHaveBeenCalled();
    expect(browser.getImageData).toHaveBeenCalledWith(0, 0, 240, 240);
    expect(jsQR).toHaveBeenCalledWith(imageBytes, 1, 1);
    expect(browser.revokeObjectURL).toHaveBeenCalledWith("blob:qr-image");
  });
});
