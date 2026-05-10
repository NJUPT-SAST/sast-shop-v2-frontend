"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type Result = {
  raw: string
  debounced: string
  setRaw: (value: string) => void
  flush: () => void
  clear: () => void
}

// `raw` updates synchronously; `debounced` follows after `delay`ms.
// `flush()` synchronizes them immediately (e.g. on Enter).
export function useDebouncedSearch(initial = "", delay = 300): Result {
  const [raw, setRawState] = useState(initial)
  const [debounced, setDebounced] = useState(initial)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setRaw = useCallback(
    (value: string) => {
      setRawState(value)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setDebounced(value), delay)
    },
    [delay]
  )

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setDebounced(raw)
  }, [raw])

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setRawState("")
    setDebounced("")
  }, [])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return { raw, debounced, setRaw, flush, clear }
}
