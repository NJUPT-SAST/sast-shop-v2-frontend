"use client"

import { FormField } from "@/components/forms/form-field"
import { ImageUpload } from "@/components/image-upload"
import type { VoteFirstListingInput } from "@/lib/schemas/listing"
import { Button, Input, NumberField, Switch } from "@heroui/react"
import { Icon } from "@iconify/react"
import { useFieldArray, useFormContext } from "react-hook-form"
import { Section } from "../shared"

/** Two stacked sections: vote settings (target/deadline/show-count) + variants/designs editor. */
export function StepVoteVariants() {
  return (
    <>
      <VoteSettingsSection />
      <Section
        desc="一个款式 (variant) 对应多个候选方案 (design)，买家会为方案投票"
        title="款式与方案"
      >
        <VariantList />
      </Section>
    </>
  )
}

function VoteSettingsSection() {
  const { watch, setValue } = useFormContext()
  const enabled = (watch("show_vote_count") as boolean) ?? true
  return (
    <Section title="投票设置">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="目标票数" name="target_votes" required>
          {({ value, onChange }) => (
            <NumberField
              fullWidth
              minValue={1}
              onChange={(n) => onChange(n ?? 1)}
              value={(value as number) ?? 50}
              variant="secondary"
            >
              <NumberField.Group>
                <NumberField.DecrementButton />
                <NumberField.Input />
                <NumberField.IncrementButton />
              </NumberField.Group>
            </NumberField>
          )}
        </FormField>
        <FormField hint="至少需 24 小时之后" label="截止时间" name="deadline" required>
          <Input placeholder="2026-06-01T00:00" type="datetime-local" variant="secondary" />
        </FormField>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-shop-sm border border-shop-border-light bg-shop-bg-tinted px-3 py-2 text-[13px]">
        <span className="text-shop-text-primary">公开实时票数</span>
        <Switch
          isSelected={enabled}
          onChange={(next) => setValue("show_vote_count", next, { shouldDirty: true })}
        />
      </div>
    </Section>
  )
}

function VariantList() {
  const { control } = useFormContext<VoteFirstListingInput>()
  const variants = useFieldArray({ control, name: "variants" })

  return (
    <div className="flex flex-col gap-4">
      {variants.fields.map((field, vi) => (
        <VariantEditor index={vi} key={field.id} onRemove={() => variants.remove(vi)} />
      ))}
      <Button
        onPress={() =>
          variants.append({
            name: "",
            max_votes_per_user: 1,
            designs: [{ name: "", image_url: "" }],
          })
        }
        variant="ghost"
      >
        <Icon className="size-4" icon="material-symbols:add-rounded" />
        添加款式
      </Button>
    </div>
  )
}

function VariantEditor({ index, onRemove }: { index: number; onRemove: () => void }) {
  const { control } = useFormContext<VoteFirstListingInput>()
  const designs = useFieldArray({ control, name: `variants.${index}.designs` })

  return (
    <div className="flex flex-col gap-3 rounded-shop-md border border-shop-border-light bg-shop-bg-tinted p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <FormField className="flex-1" label="款式名称" name={`variants.${index}.name`} required>
          <Input placeholder="如「黑色款」" variant="secondary" />
        </FormField>
        <FormField label="每人可投" name={`variants.${index}.max_votes_per_user`}>
          {({ value, onChange }) => (
            <NumberField
              fullWidth
              minValue={1}
              onChange={(n) => onChange(n ?? 1)}
              value={(value as number) ?? 1}
              variant="secondary"
            >
              <NumberField.Group>
                <NumberField.DecrementButton />
                <NumberField.Input />
                <NumberField.IncrementButton />
              </NumberField.Group>
            </NumberField>
          )}
        </FormField>
        <Button onPress={onRemove} variant="ghost">
          <Icon className="size-4" icon="material-symbols:delete-outline-rounded" />
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        {designs.fields.map((field, di) => (
          <div className="rounded-shop-sm bg-shop-bg-white p-3" key={field.id}>
            <div className="flex flex-col gap-3 md:flex-row">
              <FormField
                className="flex-1"
                label="方案名"
                name={`variants.${index}.designs.${di}.name`}
                required
              >
                <Input placeholder="例如 方案 A" variant="secondary" />
              </FormField>
              <div className="flex-1">
                <FormField
                  label="方案图"
                  name={`variants.${index}.designs.${di}.image_url`}
                  required
                >
                  {({ value, onChange }) => (
                    <ImageUpload
                      max={1}
                      onChange={(urls) => onChange(urls[0] ?? "")}
                      purpose="listing_image"
                      value={typeof value === "string" && value ? [value] : []}
                    />
                  )}
                </FormField>
              </div>
            </div>
            {designs.fields.length > 1 ? (
              <Button onPress={() => designs.remove(di)} variant="ghost">
                <Icon className="size-4" icon="material-symbols:remove-rounded" /> 移除方案
              </Button>
            ) : null}
          </div>
        ))}
        <Button onPress={() => designs.append({ name: "", image_url: "" })} variant="ghost">
          <Icon className="size-4" icon="material-symbols:add-rounded" /> 添加方案
        </Button>
      </div>
    </div>
  )
}
