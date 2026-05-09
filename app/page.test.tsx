import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@iconify/react", () => ({
  Icon: ({ icon, className }: { icon: string; className?: string }) => (
    <span aria-hidden className={className} data-icon={icon} />
  ),
}))

import Home from "./page"

describe("Home Page", () => {
  it("renders the hero heading", () => {
    render(<Home />)
    const heading = screen.getByRole("heading", {
      level: 1,
      name: /react heroui.*quick starter/i,
    })
    expect(heading).toBeInTheDocument()
  })

  it("renders the Quick Start link to HeroUI docs", () => {
    render(<Home />)
    const link = screen.getByRole("link", { name: /quick start/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", expect.stringContaining("heroui.com"))
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("renders the GitHub link", () => {
    render(<Home />)
    const link = screen.getByRole("link", { name: /view on github/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", expect.stringContaining("github.com"))
  })

  it("renders all tech-stack chips", () => {
    render(<Home />)
    const stack = ["Next.js 16", "React 19", "Tauri 2", "HeroUI v3", "Tailwind v4", "Vitest"]
    for (const label of stack) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it("renders the component-showcase section heading", () => {
    render(<Home />)
    expect(
      screen.getByRole("heading", { level: 2, name: /real heroui v3 components/i })
    ).toBeInTheDocument()
  })

  it("renders the Native Bridge section", () => {
    render(<Home />)
    expect(
      screen.getByRole("heading", { level: 2, name: /talk to rust from react/i })
    ).toBeInTheDocument()
  })

  it("renders sample HeroUI buttons inside the Buttons card", () => {
    render(<Home />)
    expect(screen.getByRole("button", { name: /primary/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /secondary/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /danger/i })).toBeInTheDocument()
  })
})
