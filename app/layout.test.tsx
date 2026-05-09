import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("./providers", () => ({
  ClientProviders: ({ children }: { children: React.ReactNode }) => children,
}))

import RootLayout, { metadata } from "./layout"

describe("RootLayout", () => {
  it("exports metadata used by Next.js", () => {
    expect(metadata).toMatchObject({
      title: "React HeroUI Quick Starter",
      description: "Next.js 16 + Tauri 2 + HeroUI v3 starter",
    })
  })

  it("renders html/body with font variables and children", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <main>content</main>
      </RootLayout>
    )

    expect(markup).toContain('<html lang="zh-CN"')
    expect(markup).toContain("--font-geist-sans")
    expect(markup).toContain("--font-geist-mono")
    expect(markup).toContain("antialiased")
    expect(markup).toContain("<main>content</main>")
  })
})
