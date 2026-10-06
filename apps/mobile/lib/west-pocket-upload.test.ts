import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyWestPocketUpload } from "../../../server/west-pocket-upload";

const options = {
  appOrigin: "https://m.shop.test",
  backendBaseUrl: "https://backend.test/api",
  isAuthenticationRequired: true,
  sessionToken: "session-secret",
};
const requestId = "12345678-1234-4123-8123-123456789abc";
function request(
  fields: Record<string, string> = {},
  content = new Uint8Array([255, 216, 255, 219]),
) {
  const form = new FormData();
  form.set(
    "file",
    new File([content], "private-name.jpg", { type: "image/jpeg" }),
  );
  Object.entries({
    purpose: "group_photo",
    consent_version: "photo-v1",
    request_id: requestId,
    pocket_id: "12",
    ...fields,
  }).forEach(([key, value]) => form.set(key, value));
  return new Request("https://m.shop.test/api/uploads/west-pocket", {
    method: "POST",
    body: form,
    headers: {
      host: "m.shop.test",
      origin: "https://m.shop.test",
      cookie: "secret-client-cookie",
      "x-west-pocket-token": "forged",
    },
  });
}
afterEach(() => vi.unstubAllGlobals());
describe("West Pocket upload proxy", () => {
  it("rejects cross-origin and unauthenticated uploads without forwarding bytes", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const wrongOrigin = request();
    wrongOrigin.headers.set("origin", "https://attacker.test");
    expect((await proxyWestPocketUpload(wrongOrigin, options)).status).toBe(
      403,
    );
    expect(
      (
        await proxyWestPocketUpload(request(), {
          ...options,
          sessionToken: undefined,
        })
      ).status,
    ).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires consent/version, activity binding, UUID and a real image signature", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const fields of [
      { consent_version: "" },
      { pocket_id: "" },
      { request_id: "guess" },
      { purpose: "product" },
    ] as Record<string, string>[])
      expect(
        (await proxyWestPocketUpload(request(fields), options)).status,
      ).toBe(400);
    expect(
      (
        await proxyWestPocketUpload(
          request({}, new Uint8Array([1, 2, 3])),
          options,
        )
      ).status,
    ).toBe(415);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("forwards only approved fields and trusted session, with no cache or redirects", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        upload_id: "55",
        expires_at: "2026-09-24T10:00:00Z",
        preview_url: "https://private.cos.test/photo?signature=short-lived",
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await proxyWestPocketUpload(request(), options);
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe("/api/v1/west-pocket/uploads");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer session-secret");
    expect(headers.has("cookie")).toBe(false);
    expect(headers.has("x-west-pocket-token")).toBe(false);
    expect(init.redirect).toBe("manual");
    const forwarded = init.body as FormData;
    expect((forwarded.get("file") as File).name).toBe("photo.jpg");
    expect(forwarded.get("pocket_id")).toBe("12");
  });
  it("rejects unsafe signed-image URLs and malformed upstream success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          upload_id: "55",
          expires_at: "2026-09-24T10:00:00Z",
          preview_url: "javascript:alert(1)",
        }),
      ),
    );
    expect((await proxyWestPocketUpload(request(), options)).status).toBe(502);
  });
  it("rejects a missing browser origin and forged forwarding headers", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const incoming = request();
    incoming.headers.delete("origin");
    incoming.headers.set("x-forwarded-host", "m.shop.test");
    incoming.headers.set("x-forwarded-proto", "https");
    expect((await proxyWestPocketUpload(incoming, options)).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    "not a URL",
    "https://user:secret@backend.test",
    "https://backend.test?key=secret",
  ])(
    "returns a recoverable configuration error for %s",
    async (backendBaseUrl) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      expect(
        (await proxyWestPocketUpload(request(), { ...options, backendBaseUrl }))
          .status,
      ).toBe(503);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});
