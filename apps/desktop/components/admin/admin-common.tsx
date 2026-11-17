"use client";

import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { LoadFailure } from "@workspace/ui/components/load-failure";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type { AdminCorrection, AdminField, AdminImpact } from "@sast-shop/api";
import { adminDate, adminStatus, resourceLabels } from "@/lib/admin-fields";

export function AdminSelect({
  id,
  name,
  label,
  value,
  defaultValue,
  onChange,
  choices,
  disabled,
  required,
  placeholder = "请选择",
}: {
  id?: string;
  name?: string;
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  choices: Array<{ value: string; label: string }>;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <Select
      name={name}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onChange}
      disabled={disabled}
      required={required}
    >
      <SelectTrigger id={id} aria-label={label}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {choices.map((choice) => (
          <SelectItem key={choice.value} value={choice.value}>
            {choice.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AdminError({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return retry ? (
    <LoadFailure variant="compact" title={message} onRetry={retry} />
  ) : (
    <LoadFailure variant="compact" title={message} />
  );
}
export function AdminFields({ fields }: { fields: AdminField[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.key} className="min-w-0">
          <dt className="text-xs text-muted-foreground">
            {field.label || field.key}
          </dt>
          <dd className="mt-1 break-words text-sm whitespace-pre-wrap">
            {field.key.endsWith("_json") ? (
              <AdminStructuredValue value={field.value} />
            ) : (
              field.value || "—"
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function AdminPagination({
  page,
  total,
  busy,
  onChange,
}: {
  page: number;
  total: number;
  busy: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm">
      <span className="text-muted-foreground">
        共 {total} 条 · 第 {page} 页
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || busy}
          onClick={() => onChange(page - 1)}
        >
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page * 20 >= total || busy}
          onClick={() => onChange(page + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
export function AdminImpacts({ impacts }: { impacts: AdminImpact[] }) {
  return (
    <ul className="space-y-3">
      {impacts.map((impact, index) => (
        <li
          key={`${impact.resource}:${impact.id}:${index}`}
          className="rounded-lg border p-3"
        >
          <p className="text-sm font-medium">
            {resourceLabels[impact.resource]} · {impact.id}
          </p>
          <p className="mt-1 text-sm">{impact.description}</p>
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <p className="break-words rounded bg-muted p-2">
              变更前：{impact.before || "—"}
            </p>
            <p className="break-words rounded bg-muted p-2">
              变更后：{impact.after || "—"}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
export function AdminCorrectionResult({
  correction,
}: {
  correction: AdminCorrection;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{adminStatus(correction.status)}</Badge>
        <span className="text-xs text-muted-foreground">
          处理编号 {correction.id} · 第 {correction.round} 轮
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        最近更新 {adminDate(correction.updatedAt)}
      </p>
      {correction.error ? <AdminError message={correction.error} /> : null}
      <ol className="space-y-2">
        {correction.steps.map((step) => (
          <li key={step.key} className="rounded border p-3 text-sm">
            <span className="font-medium">{step.description}</span>
            <span className="ml-3 text-muted-foreground">
              {adminStatus(step.status)}
            </span>
            {step.error ? (
              <p className="mt-1 text-destructive">{step.error}</p>
            ) : null}
          </li>
        ))}
      </ol>
      <AdminImpacts impacts={correction.impacts} />
    </div>
  );
}

const structuredLabels: Record<string, string> = {
  id: "行编号",
  product_template_id: "商品模板 ID",
  title: "商品",
  required_quantity: "需求数量",
  purchased_quantity: "采购数量",
  actual_unit_price_cents: "实际单价（分）",
  deadline: "截止时间",
  task_item_id: "采购行 ID",
  demand_item_id: "需求行 ID",
  purchaser_id: "买家 ID",
  distributed_quantity: "分发数量",
  service_fee_per_unit_cents: "单件跑腿费（分）",
  payment_bill_id: "账单 ID",
  requester_id: "买家 ID",
  quantity: "数量",
  status: "状态",
};
function AdminStructuredValue({ value }: { value: string }) {
  let rows: unknown;
  try {
    rows = JSON.parse(value);
  } catch {
    return <span>明细格式不可用</span>;
  }
  if (!Array.isArray(rows)) return <span>暂无明细</span>;
  return (
    <div className="space-y-2">
      {rows.length
        ? rows.map((row: unknown, index) => {
            if (!row || typeof row !== "object") return null;
            return (
              <dl key={index} className="space-y-1 rounded border p-2">
                {Object.entries(row)
                  .filter(([key]) => key in structuredLabels)
                  .map(([key, entry]) => (
                    <div
                      key={key}
                      className="flex flex-wrap justify-between gap-2"
                    >
                      <dt className="text-xs text-muted-foreground">
                        {structuredLabels[key]}
                      </dt>
                      <dd>
                        {entry == null
                          ? "—"
                          : key === "status"
                            ? adminStatus(String(entry))
                            : String(entry)}
                      </dd>
                    </div>
                  ))}
              </dl>
            );
          })
        : "暂无明细"}
    </div>
  );
}
