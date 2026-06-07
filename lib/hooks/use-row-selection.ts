"use client"

import { useCallback, useMemo, useState } from "react"

type Result = {
  selected: Set<string>
  selectedCount: number
  isAllSelected: boolean
  isIndeterminate: boolean
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  toggleAll: (ids: readonly string[]) => void
  clear: () => void
  select: (ids: readonly string[]) => void
}

export function useRowSelection(allIds: readonly string[]): Result {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const isAllSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const isIndeterminate = !isAllSelected && allIds.some((id) => selected.has(id))

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback((ids: readonly string[]) => {
    setSelected((prev) => {
      const allOn = ids.length > 0 && ids.every((id) => prev.has(id))
      if (allOn) {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      }
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])
  const select = useCallback((ids: readonly string[]) => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      return next
    })
  }, [])

  const isSelected = useCallback((id: string) => selected.has(id), [selected])

  return useMemo(
    () => ({
      selected,
      selectedCount: selected.size,
      isAllSelected,
      isIndeterminate,
      isSelected,
      toggle,
      toggleAll,
      clear,
      select,
    }),
    [selected, isAllSelected, isIndeterminate, isSelected, toggle, toggleAll, clear, select]
  )
}
