"use client"

import { FormField } from "@/components/forms/form-field"
import { FormProvider, useTypedForm } from "@/components/forms/typed-form"
import { type AddressInput, addressSchema } from "@/lib/schemas/address"
import type { Address } from "@/lib/stores/address-store"
import { Button, Input, Switch, TextArea } from "@heroui/react"

type Props = {
  initial?: Address
  onSubmit: (input: AddressInput) => void
  onCancel?: () => void
  submitting?: boolean
}

const empty: AddressInput = {
  recipient: "",
  phone: "",
  province: "",
  city: "",
  district: "",
  detail: "",
  isDefault: false,
}

export function AddressForm({ initial, onSubmit, onCancel, submitting }: Props) {
  const form = useTypedForm(addressSchema, {
    defaultValues: initial
      ? {
          recipient: initial.recipient,
          phone: initial.phone,
          province: initial.province ?? "",
          city: initial.city ?? "",
          district: initial.district ?? "",
          detail: initial.detail,
          isDefault: initial.isDefault,
        }
      : empty,
  })

  return (
    <FormProvider {...form}>
      <form className="flex flex-col gap-3" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="收件人" maxLength={20} name="recipient" required>
            <Input placeholder="请输入收件人姓名" variant="secondary" />
          </FormField>
          <FormField hint="11 位手机号" label="联系电话" name="phone" required>
            <Input inputMode="numeric" placeholder="例如 13800000000" variant="secondary" />
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <FormField label="省" name="province">
            <Input placeholder="可选" variant="secondary" />
          </FormField>
          <FormField label="市" name="city">
            <Input placeholder="可选" variant="secondary" />
          </FormField>
          <FormField label="区" name="district">
            <Input placeholder="可选" variant="secondary" />
          </FormField>
        </div>
        <FormField
          hint="校区 / 楼栋 / 宿舍号 / 街道门牌"
          label="详细地址"
          maxLength={200}
          name="detail"
          required
        >
          <TextArea
            placeholder="例如 仙林校区 SAST 工作室 / 紫荆园 8 栋 305"
            rows={3}
            variant="secondary"
          />
        </FormField>
        <FormField name="isDefault">
          {({ value, onChange }) => (
            <label className="flex cursor-pointer items-center justify-between rounded-shop-sm bg-shop-bg-tinted px-3 py-2">
              <span className="text-[13px] text-shop-text-secondary">设为默认地址</span>
              <Switch isSelected={Boolean(value)} onChange={(next) => onChange(next)} />
            </label>
          )}
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          {onCancel ? (
            <Button isDisabled={submitting} onPress={onCancel} variant="ghost">
              取消
            </Button>
          ) : null}
          <Button isPending={submitting} type="submit" variant="primary">
            保存地址
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
