"use client";

import { useState, type FormEvent } from "react";
import type { ShoppingTaskItem } from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog";
import { Textarea } from "@workspace/ui/components/textarea";

type EditorProps = {
  item: ShoppingTaskItem | null;
  saving: boolean;
  disabled: boolean;
  onClose: () => void;
  onSave: (item: ShoppingTaskItem, quantity: number, reason?: string) => void;
};

export function ShoppingTaskItemEditor({
  item,
  saving,
  disabled,
  onClose,
  onSave,
}: EditorProps) {
  return (
    <ResponsiveDialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <ResponsiveDialogContent className="max-h-[88dvh] overflow-clip px-4 pb-0 md:pb-4 sm:mx-auto sm:max-w-sm">
        <ResponsiveDialogHeader className="px-0 text-left">
          <ResponsiveDialogTitle>记录采购</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {item
              ? `${item.productTitle} · 需求 ${item.requiredQuantity} 件`
              : ""}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {item ? (
          <PurchaseQuantityForm
            key={item.id}
            item={item}
            saving={saving}
            disabled={disabled}
            onClose={onClose}
            onSave={onSave}
          />
        ) : null}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function PurchaseQuantityForm({
  item,
  saving,
  disabled,
  onClose,
  onSave,
}: Omit<EditorProps, "item"> & { item: ShoppingTaskItem }) {
  const [quantity, setQuantity] = useState(
    String(item.purchasedQuantity ?? item.requiredQuantity),
  );
  const [reason, setReason] = useState(item.nonPurchaseReason ?? "");
  const quantityValue = Number(quantity);
  const validQuantity =
    /^\d+$/.test(quantity.trim()) &&
    Number.isSafeInteger(quantityValue) &&
    quantityValue >= 0 &&
    quantityValue <= item.requiredQuantity;
  const canSave = validQuantity && !disabled && Boolean(item.updatedAt);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;
    onSave(
      item,
      quantityValue,
      quantityValue === 0 ? reason.trim() || undefined : undefined,
    );
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-col">
      <div className="app-scrollbar min-h-0 overflow-y-auto">
        <FieldGroup className="gap-4">
          <Field data-invalid={!validQuantity} data-disabled={disabled}>
            <FieldLabel htmlFor="purchase-quantity">实购数量</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="purchase-quantity"
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={!validQuantity}
                aria-describedby={
                  validQuantity
                    ? "purchase-quantity-hint"
                    : "purchase-quantity-error"
                }
                disabled={disabled}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>件</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            {validQuantity ? (
              <FieldDescription id="purchase-quantity-hint">
                填 0 表示不购买
              </FieldDescription>
            ) : (
              <FieldError id="purchase-quantity-error">
                请输入0至{item.requiredQuantity}之间的整数
              </FieldError>
            )}
          </Field>
          {validQuantity && quantityValue === 0 ? (
            <Field data-disabled={disabled}>
              <FieldLabel htmlFor="purchase-reason">
                不购买原因（可选）
              </FieldLabel>
              <Textarea
                id="purchase-reason"
                disabled={disabled}
                maxLength={15}
                value={reason}
                onChange={(event) => setReason(event.target.value.slice(0, 15))}
                placeholder="最多 15 字"
                rows={2}
              />
            </Field>
          ) : null}
        </FieldGroup>
      </div>
      <ResponsiveDialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={onClose}
        >
          取消
        </Button>
        <Button type="submit" disabled={!canSave}>
          {saving ? "保存中" : "保存采购结果"}
        </Button>
      </ResponsiveDialogFooter>
    </form>
  );
}
