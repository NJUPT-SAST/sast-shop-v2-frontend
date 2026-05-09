"use client"

import { greet, isTauri } from "@/lib/tauri"
import { Button } from "@heroui/react"
import { useState } from "react"

export function TauriDemo() {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!isTauri()) return null

  async function handlePress() {
    setError(null)
    try {
      setMessage(await greet("World"))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="mt-8 flex flex-col items-center gap-2">
      <Button onPress={handlePress}>Call Rust greet()</Button>
      {message && <p className="text-sm">{message}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
