"use client"

import { useDebouncedSearch } from "@/lib/hooks/use-debounced-search"
import { usePreferenceStore } from "@/lib/stores/preference-store"
import { Button, SearchField } from "@heroui/react"
import { Icon } from "@iconify/react"
import { AnimatePresence, m } from "motion/react"
import { useEffect, useRef, useState } from "react"

type Props = {
  value?: string
  onChange: (debounced: string) => void
  placeholder?: string
  className?: string
  /** Disable the recent-search popover (e.g. inside admin tables). */
  disableHistory?: boolean
  autoFocus?: boolean
}

export function SearchBar({
  value: controlled,
  onChange,
  placeholder = "搜索商品 / 关键词",
  className,
  disableHistory,
  autoFocus,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [focused, setFocused] = useState(false)
  const search = useDebouncedSearch(controlled ?? "", 300)
  const recent = usePreferenceStore((s) => s.recentSearches)
  const pushSearch = usePreferenceStore((s) => s.pushSearch)
  const clearSearches = usePreferenceStore((s) => s.clearSearches)
  const removeSearch = usePreferenceStore((s) => s.removeSearch)

  useEffect(() => {
    onChange(search.debounced)
  }, [search.debounced, onChange])

  // biome-ignore lint/correctness/useExhaustiveDependencies: only sync when external `controlled` changes; ignore inner ref churn.
  useEffect(() => {
    if (controlled !== undefined && controlled !== search.raw) {
      search.setRaw(controlled)
    }
  }, [controlled])

  useEffect(() => {
    if (!focused) return
    function onDoc(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setFocused(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [focused])

  function commit() {
    search.flush()
    if (search.raw.trim()) pushSearch(search.raw.trim())
    setFocused(false)
    inputRef.current?.blur()
  }

  function pickHistory(q: string) {
    search.setRaw(q)
    pushSearch(q)
    onChange(q)
    setFocused(false)
  }

  const showHistory = !disableHistory && focused && recent.length > 0 && search.raw.length === 0

  return (
    <div className={`relative ${className ?? ""}`} ref={containerRef}>
      <SearchField
        aria-label="搜索"
        onChange={search.setRaw}
        onClear={() => {
          search.clear()
          onChange("")
          inputRef.current?.focus()
        }}
        onSubmit={commit}
        value={search.raw}
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input
            autoFocus={autoFocus}
            className="w-full"
            onFocus={() => setFocused(true)}
            placeholder={placeholder}
            ref={inputRef}
          />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <AnimatePresence>
        {showHistory ? (
          <m.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-shop-md border border-shop-border-light bg-shop-bg-white shadow-shop-lg"
            exit={{ opacity: 0, y: -4 }}
            initial={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center justify-between border-b border-shop-border-light px-4 py-2.5 text-[12px] text-shop-text-tertiary">
              <span>最近搜索</span>
              <Button
                className="!h-auto !min-h-0 !min-w-0 !p-0 text-shop-text-tertiary hover:!text-shop-primary"
                onPress={() => clearSearches()}
                size="sm"
                variant="ghost"
              >
                清空
              </Button>
            </div>
            <ul>
              {recent.map((q) => (
                <li
                  className="flex items-center gap-2 border-b border-shop-border-light/60 px-4 last:border-0"
                  key={q}
                >
                  <Button
                    className="!h-auto !min-h-0 flex-1 justify-start gap-2 !px-0 !py-2.5 text-left text-[14px] text-shop-text-primary hover:!bg-transparent"
                    onPress={() => pickHistory(q)}
                    size="sm"
                    variant="ghost"
                  >
                    <Icon
                      className="size-4 text-shop-text-tertiary"
                      icon="material-symbols:history-rounded"
                    />
                    <span className="truncate">{q}</span>
                  </Button>
                  <Button
                    aria-label={`移除 ${q}`}
                    className="shrink-0"
                    isIconOnly
                    onPress={() => removeSearch(q)}
                    size="sm"
                    variant="ghost"
                  >
                    <Icon className="size-4" icon="material-symbols:close-rounded" />
                  </Button>
                </li>
              ))}
            </ul>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
