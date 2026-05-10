import { invoke } from "@tauri-apps/api/core"

/**
 * Detects whether the app is running inside a Tauri webview.
 * Use this to gate any code that calls `invoke` so the same component
 * works in both `pnpm dev` (web) and `pnpm tauri dev` (desktop).
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

// Type-safe wrappers for Rust commands defined in src-tauri/src/commands.rs.
// Keep this file as the SOLE caller of `invoke` — business code imports
// named functions from here, never `invoke` directly.

export async function greet(name: string): Promise<string> {
  return invoke<string>("greet", { name })
}

/**
 * Open a URL outside of the embedded webview. In a browser this is a normal
 * tab navigation; in Tauri it would shell-open the system browser, but the
 * shell plugin is opt-in and not yet wired into src-tauri. For now we fall
 * back to writing the URL to the clipboard so users can finish OAuth in their
 * normal browser. Replace the Tauri branch when adding @tauri-apps/plugin-shell.
 */
export async function openExternal(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, "_blank", "noopener")
    return
  }
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    // Clipboard may be unavailable in Tauri's restricted webview; ignore.
  }
}
