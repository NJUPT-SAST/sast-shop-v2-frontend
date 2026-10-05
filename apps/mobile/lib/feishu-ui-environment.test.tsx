// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFeishuUiEnvironment } from "../hooks/use-feishu-ui-environment";

let container: HTMLDivElement;
let root: Root;

function Probe() {
  return <span>{useFeishuUiEnvironment() ? "扫码入口" : "手动输入"}</span>;
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("h5sdk", undefined);
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    "Mozilla/5.0 (Linux; Android 15) Mobile Chrome/140.0",
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderProbe() {
  await act(async () => root.render(<Probe />));
}

describe("Feishu scan entry visibility", () => {
  it("shows the entry in Feishu before the SDK loads", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Linux; Android 15) Mobile Feishu/7.35.0",
    );
    await renderProbe();
    expect(container.textContent).toBe("扫码入口");
  });

  it("shows the entry with the CDN SDK that has no browser field", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Lark/7.35.0",
    );
    vi.stubGlobal("h5sdk", { ready: vi.fn(), config: vi.fn() });
    await renderProbe();
    expect(container.textContent).toBe("扫码入口");
  });

  it("updates an already mounted entry when an SDK script loads", async () => {
    await renderProbe();
    expect(container.textContent).toBe("手动输入");
    const script = document.createElement("script");
    document.head.append(script);
    await act(async () => {
      vi.stubGlobal("h5sdk", {
        browser: { versions: { mobileFeishu: true } },
      });
      script.dispatchEvent(new Event("load"));
    });
    script.remove();
    expect(container.textContent).toBe("扫码入口");
  });

  it("keeps scanning hidden in a normal browser and desktop Feishu", async () => {
    await renderProbe();
    expect(container.textContent).toBe("手动输入");
    await act(async () => {
      vi.stubGlobal("h5sdk", { browser: { versions: { PCFeishu: true } } });
      vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
        "Mozilla/5.0 (Macintosh) Feishu/7.35.0 WebApp",
      );
      window.dispatchEvent(new Event("focus"));
    });
    expect(container.textContent).toBe("手动输入");
  });
});
