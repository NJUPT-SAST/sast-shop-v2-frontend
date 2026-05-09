import { invoke } from "@tauri-apps/api/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TauriDemo } from "./tauri-demo"

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}))

const mockedInvoke = vi.mocked(invoke)
const tauriMarker = "__TAURI_INTERNALS__"

function enableTauri() {
  ;(window as unknown as Record<string, unknown>)[tauriMarker] = {}
}

function disableTauri() {
  delete (window as unknown as Record<string, unknown>)[tauriMarker]
}

describe("TauriDemo", () => {
  beforeEach(() => {
    mockedInvoke.mockReset()
  })

  afterEach(() => {
    disableTauri()
  })

  it("renders nothing in non-Tauri environments", () => {
    const { container } = render(<TauriDemo />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the call button when running inside Tauri", () => {
    enableTauri()
    render(<TauriDemo />)
    expect(screen.getByRole("button", { name: /call rust greet/i })).toBeInTheDocument()
  })

  it("displays the greet result after pressing the button", async () => {
    enableTauri()
    mockedInvoke.mockResolvedValue("Hello, World!")
    const user = userEvent.setup()
    render(<TauriDemo />)
    await user.click(screen.getByRole("button", { name: /call rust greet/i }))
    expect(await screen.findByText("Hello, World!")).toBeInTheDocument()
    expect(mockedInvoke).toHaveBeenCalledWith("greet", { name: "World" })
  })

  it("shows an error message when invoke rejects", async () => {
    enableTauri()
    mockedInvoke.mockRejectedValue(new Error("bridge offline"))
    const user = userEvent.setup()
    render(<TauriDemo />)
    await user.click(screen.getByRole("button", { name: /call rust greet/i }))
    expect(await screen.findByText("bridge offline")).toBeInTheDocument()
  })
})
