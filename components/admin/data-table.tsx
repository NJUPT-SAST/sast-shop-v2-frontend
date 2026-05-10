"use client"

import { RowSelectCheckbox } from "@/components/admin/row-select-checkbox"
import { ErrorState } from "@/components/states/error-state"
import { SkeletonTable } from "@/components/states/skeleton-table"
import { Icon } from "@iconify/react"
import {
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { type ReactNode, useMemo, useState } from "react"

type DataTableProps<T extends { id: string }> = {
  data: readonly T[]
  columns: ColumnDef<T, unknown>[]
  isLoading?: boolean
  isError?: boolean
  error?: unknown
  onRetry?: () => void
  emptyState?: ReactNode
  /** Row click handler — omit to disable row clicking. */
  onRowClick?: (row: T) => void
  /** Enable selection column (controlled). */
  selectable?: {
    isSelected: (id: string) => boolean
    isAllSelected: boolean
    isIndeterminate: boolean
    toggle: (id: string) => void
    toggleAll: (ids: readonly string[]) => void
  }
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  isLoading,
  isError,
  error,
  onRetry,
  emptyState,
  onRowClick,
  selectable,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const allIds = useMemo(() => data.map((d) => d.id), [data])

  const fullColumns = useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!selectable) return columns
    const selectionCol: ColumnDef<T, unknown> = {
      id: "__select__",
      header: () => (
        <RowSelectCheckbox
          ariaLabel="全选"
          checked={selectable.isAllSelected}
          indeterminate={selectable.isIndeterminate}
          onChange={() => selectable.toggleAll(allIds)}
        />
      ),
      cell: ({ row }) => (
        <RowSelectCheckbox
          ariaLabel={`选择 ${row.original.id}`}
          checked={selectable.isSelected(row.original.id)}
          onChange={() => selectable.toggle(row.original.id)}
        />
      ),
      size: 40,
    }
    return [selectionCol, ...columns]
  }, [columns, selectable, allIds])

  const table = useReactTable({
    data: data as T[],
    columns: fullColumns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (isLoading) return <SkeletonTable columns={Math.max(2, columns.length)} />
  if (isError) return <ErrorState error={error} onRetry={onRetry} title="加载失败" />
  if (data.length === 0) return <>{emptyState}</>

  return (
    <div className="overflow-hidden rounded-shop-lg bg-shop-bg-white shadow-shop-sm">
      <table className="min-w-full text-[13px]">
        <thead className="bg-shop-bg-tinted text-shop-text-secondary">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  className="px-4 py-3 text-left font-medium"
                  key={h.id}
                  style={{ width: h.getSize() }}
                >
                  {h.isPlaceholder ? null : h.column.getCanSort() ? (
                    <button
                      className="inline-flex items-center gap-1 transition hover:text-shop-text-primary"
                      onClick={h.column.getToggleSortingHandler()}
                      type="button"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      <Icon
                        className="size-4"
                        icon={
                          h.column.getIsSorted() === "asc"
                            ? "material-symbols:arrow-drop-up-rounded"
                            : h.column.getIsSorted() === "desc"
                              ? "material-symbols:arrow-drop-down-rounded"
                              : "material-symbols:unfold-more-rounded"
                        }
                      />
                    </button>
                  ) : (
                    flexRender(h.column.columnDef.header, h.getContext())
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              className={`border-t border-shop-border-light/60 transition hover:bg-shop-primary-wash/40 ${onRowClick ? "cursor-pointer" : ""}`}
              key={row.id}
              onClick={() => onRowClick?.(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  className="px-4 py-3 align-middle text-shop-text-primary"
                  key={cell.id}
                  onClick={(e) => {
                    if (cell.column.id === "__select__") e.stopPropagation()
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
