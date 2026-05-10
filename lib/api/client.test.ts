import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api, registerUnauthorizedHandler } from "./client"
import { ApiError } from "./errors"

describe("api client", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockReset()
    // Reset the unauthorized handler between tests.
    registerUnauthorizedHandler(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("calls fetch with credentials and JSON body", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    )
    const result = await api.post("/listings", { title: "x" })
    expect(result).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain("/listings")
    expect(init.credentials).toBe("include")
    expect(init.method).toBe("POST")
    expect(init.body).toBe(JSON.stringify({ title: "x" }))
    expect(init.headers["Content-Type"]).toBe("application/json")
  })

  it("attaches Idempotency-Key when idempotent=true", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "o1" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    )
    await api.post("/orders", {}, { idempotent: true })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers["Idempotency-Key"]).toBeDefined()
    expect(typeof init.headers["Idempotency-Key"]).toBe("string")
    expect(init.headers["Idempotency-Key"].length).toBeGreaterThan(8)
  })

  it("triggers onUnauthorized once on 401", async () => {
    const handler = vi.fn()
    registerUnauthorizedHandler(handler)
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "UNAUTHORIZED", message: "no", status: 401 }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    )
    await expect(api.get("/auth/me")).rejects.toBeInstanceOf(ApiError)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("parses business error envelope into ApiError", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: "LISTING_NOT_FOUND",
          message: "商品不存在",
          status: 404,
          request_id: "req_x",
        }),
        { status: 404, headers: { "content-type": "application/json" } }
      )
    )
    try {
      await api.get("/listings/none")
      throw new Error("expected throw")
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).code).toBe("LISTING_NOT_FOUND")
      expect((err as ApiError).status).toBe(404)
      expect((err as ApiError).requestId).toBe("req_x")
    }
  })

  it("returns undefined for 204 no-content", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(api.del("/listings/x")).resolves.toBeUndefined()
  })

  it("encodes query params and skips nullish values", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    )
    await api.get("/listings", { query: { type: "secondhand", q: undefined, page: 2, sort: null } })
    const [url] = fetchMock.mock.calls[0]
    const u = String(url)
    expect(u).toContain("type=secondhand")
    expect(u).toContain("page=2")
    expect(u).not.toContain("q=")
    expect(u).not.toContain("sort=")
  })
})
