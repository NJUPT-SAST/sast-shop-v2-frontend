import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ClientProviders } from "./providers"

describe("ClientProviders", () => {
  it("renders children", () => {
    render(
      <ClientProviders lang="en">
        <span data-testid="child">hello</span>
      </ClientProviders>
    )
    expect(screen.getByTestId("child")).toHaveTextContent("hello")
  })

  it("accepts a locale via the lang prop without crashing", () => {
    render(
      <ClientProviders lang="zh-CN">
        <span>ok</span>
      </ClientProviders>
    )
    expect(screen.getByText("ok")).toBeInTheDocument()
  })
})
