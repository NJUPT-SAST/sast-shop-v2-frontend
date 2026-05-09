import { invoke } from "@tauri-apps/api/core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { greet, isTauri } from "./tauri"

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}))

const mockedInvoke = vi.mocked(invoke)

describe("lib/tauri", () => {
  beforeEach(() => {
    mockedInvoke.mockReset()
  })

  describe("isTauri", () => {
    it("returns false in jsdom (no Tauri marker)", () => {
      expect(isTauri()).toBe(false)
    })

    it("returns true when __TAURI_INTERNALS__ is on window", () => {
      ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
      expect(isTauri()).toBe(true)
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
    })
  })

  describe("greet", () => {
    it("invokes the greet command with the name argument", async () => {
      mockedInvoke.mockResolvedValue("Hello, X!")
      const result = await greet("X")
      expect(mockedInvoke).toHaveBeenCalledWith("greet", { name: "X" })
      expect(result).toBe("Hello, X!")
    })

    it("propagates rejection from invoke", async () => {
      mockedInvoke.mockRejectedValue(new Error("boom"))
      await expect(greet("X")).rejects.toThrow("boom")
    })
  })
})
