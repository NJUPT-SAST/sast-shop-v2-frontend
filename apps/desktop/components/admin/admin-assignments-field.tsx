"use client";

import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";

type Assignment = {
  task_item_id: string;
  demand_item_id: string;
  distributed_quantity: number | null;
};

export function AdminAssignmentsField({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  let rows: Assignment[] = [];
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    if (Array.isArray(parsed)) rows = parsed;
  } catch {
    /* A new restoration draft starts with no rows. */
  }
  function update(index: number, patch: Partial<Assignment>) {
    onChange(
      JSON.stringify(
        rows.map((row, position) =>
          position === index ? { ...row, ...patch } : row,
        ),
      ),
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        按原始凭据逐行补录采购商品与买家需求的对应关系；请从关联交易核对编号。
      </p>
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-2 gap-2 rounded border p-3">
          <label className="space-y-1 text-xs">
            采购商品 ID
            <Input
              required
              disabled={disabled}
              value={row.task_item_id}
              inputMode="numeric"
              pattern="[1-9][0-9]*"
              onChange={(event) =>
                update(index, { task_item_id: event.target.value })
              }
            />
          </label>
          <label className="space-y-1 text-xs">
            买家需求行 ID
            <Input
              required
              disabled={disabled}
              value={row.demand_item_id}
              inputMode="numeric"
              pattern="[1-9][0-9]*"
              onChange={(event) =>
                update(index, { demand_item_id: event.target.value })
              }
            />
          </label>
          <label className="space-y-1 text-xs">
            已分发数量
            <Input
              required={row.distributed_quantity !== null}
              disabled={disabled || row.distributed_quantity === null}
              type="number"
              min={0}
              step={1}
              value={row.distributed_quantity ?? ""}
              onChange={(event) =>
                update(index, {
                  distributed_quantity: Number(event.target.value),
                })
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              disabled={disabled}
              checked={row.distributed_quantity === null}
              onCheckedChange={(checked) =>
                update(index, { distributed_quantity: checked ? null : 0 })
              }
            />
            该项未采购
          </label>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() =>
              onChange(
                JSON.stringify(
                  rows.filter((_, position) => position !== index),
                ),
              )
            }
          >
            移除此行
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() =>
          onChange(
            JSON.stringify([
              ...rows,
              { task_item_id: "", demand_item_id: "", distributed_quantity: 0 },
            ]),
          )
        }
      >
        添加对应关系
      </Button>
    </div>
  );
}
