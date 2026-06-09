"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  RiAddLine,
  RiArrowRightSLine,
  RiBarcodeLine,
  RiCheckboxCircleLine,
  RiQrScan2Line,
  RiStoreLine,
  RiSubtractLine,
} from "@remixicon/react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"
import {
  createSpotGoods,
  listPaymentQrCodes,
  type DataSource,
  type ProductTemplate,
  type ServiceOptions,
} from "@sast-shop/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  ButtonGroup,
  ButtonGroupText,
} from "@workspace/ui/components/button-group"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@workspace/ui/components/item"
import { useProfileDialogs } from "./profile-dialogs-provider"

const formSchema = z.object({
  barcode: z
    .string()
    .trim()
    .min(1, "请输入商品条码")
    .regex(/^\d+$/, "商品条码只能包含数字"),
  price: z.coerce
    .number<number>()
    .min(0.01, "售价至少为 0.01 元")
    .multipleOf(0.01, "售价最多保留两位小数"),
  stock: z.coerce
    .number<number>()
    .int("库存必须是整数")
    .positive("库存必须大于 0"),
})

type FormValues = z.infer<typeof formSchema>

type Template = {
  barcode: string
  title: string
  description: string
  store: string
  id: string
  updatedAt: string | null
}

export function PublishSpotForm({
  dataSource,
  connectBaseUrl,
  templates,
  error,
}: {
  dataSource: DataSource
  connectBaseUrl: string
  templates: ProductTemplate[]
  error: string | null
}) {
  const serviceOptions: ServiceOptions = { dataSource, connectBaseUrl }
  const { openQrCodeDialog } = useProfileDialogs()
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      barcode: "",
      price: 0.01,
      stock: 1,
    },
  })
  const barcode = useWatch({
    control: form.control,
    name: "barcode",
  })
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  )
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const barcodeLengths = useMemo(
    () =>
      Array.from(
        new Set(
          templates
            .map((template) => template.barcode.trim().length)
            .filter((length) => length > 0)
        )
      ),
    [templates]
  )
  const barcodeReady = isBarcodeReady(barcode, barcodeLengths)
  const candidates = useMemo(
    () =>
      barcodeReady
        ? templates
            .filter((template) => template.barcode === barcode.trim())
            .map((template) => ({
              id: template.id,
              barcode: template.barcode,
              title: template.title,
              description: template.description,
              store: `店铺 ${template.storeId}`,
              updatedAt: template.updatedAt,
            }))
        : [],
    [barcode, barcodeReady, templates]
  )

  function handleBarcodeChange(value: string) {
    form.clearErrors("barcode")
    setSelectedTemplate(null)
    setSubmitted(false)
    setSubmissionError(null)

    const nextBarcode = value.trim()

    if (!isBarcodeReady(nextBarcode, barcodeLengths)) {
      return
    }

    form.clearErrors("barcode")
  }

  async function submitSpotGoods(values: FormValues) {
    if (!selectedTemplate) {
      toast.error("请先选择商品模板")
      return
    }

    setSubmitting(true)
    setSubmissionError(null)

    try {
      const qrCodes = await listPaymentQrCodes(serviceOptions)

      if (qrCodes.length === 0) {
        toast.error("请先配置收款码，再上架现货")
        openQrCodeDialog()
        return
      }

      await createSpotGoods(
        {
          productTemplateId: selectedTemplate.id,
          salePriceCents: Math.round(values.price * 100),
          stockTotal: values.stock,
          productTemplateUpdatedAt: selectedTemplate.updatedAt,
        },
        serviceOptions
      )
      setSubmitted(true)
      toast.success("已提交上架")
    } catch {
      const message = "上架失败，请稍后再试"
      setSubmissionError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 py-6">
      <section className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold md:text-2xl">上架现货</h1>
          {error ? (
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          ) : null}
        </div>
        {submitted ? <Badge>已提交</Badge> : null}
      </section>

      <section className="flex flex-col gap-4">
        <FieldGroup>
          <Controller
            name="barcode"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>商品条码编号</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <RiBarcodeLine />
                  </InputGroupAddon>
                  <InputGroupInput
                    id={field.name}
                    name={field.name}
                    value={field.value}
                    placeholder="输入或扫描条码"
                    aria-invalid={fieldState.invalid}
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      field.onChange(event)
                      handleBarcodeChange(event.target.value)
                    }}
                    ref={field.ref}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label="扫描条码"
                      title="扫描条码"
                      onClick={() => {
                        toast.message("扫码能力暂未接入，请先手动输入条码")
                      }}
                    >
                      <RiQrScan2Line />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {fieldState.invalid ? (
                  <FieldError errors={[fieldState.error]} />
                ) : null}
              </Field>
            )}
          />
        </FieldGroup>

        {barcodeReady && candidates.length === 0 ? (
          <TemplateActionItem
            title="添加商品模板"
            description="没有找到这个条码对应的商品，先维护商品模板后再上架。"
            icon={<RiAddLine />}
            href="/group"
          />
        ) : null}

        {candidates.map((template) => (
          <Item
            key={template.id}
            variant="outline"
            role="button"
            tabIndex={0}
            className="cursor-pointer hover:bg-muted/30"
            onClick={() => setSelectedTemplate(template)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                setSelectedTemplate(template)
              }
            }}
          >
            <ItemContent>
              <ItemTitle>{template.title}</ItemTitle>
              <ItemDescription>{template.description}</ItemDescription>
              <ItemDescription>店铺：{template.store}</ItemDescription>
            </ItemContent>
            {selectedTemplate?.id === template.id ? (
              <ItemActions>
                <Badge>已选择</Badge>
              </ItemActions>
            ) : null}
          </Item>
        ))}

        {barcodeReady && candidates.length > 0 ? (
          <TemplateActionItem
            title="添加店铺"
            description="商品已匹配，但没有你要上架的店铺时，先新增店铺。"
            icon={<RiStoreLine />}
            href="/group"
          />
        ) : null}
      </section>

      <FieldGroup className="grid grid-cols-2 gap-4">
        <Controller
          name="price"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>售卖单价</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>¥</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id={field.name}
                  name={field.name}
                  value={field.value}
                  type="number"
                  min={0.01}
                  step={0.01}
                  placeholder="0.00"
                  aria-invalid={fieldState.invalid}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  ref={field.ref}
                />
              </InputGroup>
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />
        <Controller
          name="stock"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>初始库存</FieldLabel>
              <ButtonGroup
                aria-invalid={fieldState.invalid}
                aria-label="调整初始库存"
                className="w-full"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="减少库存"
                  title="减少库存"
                  disabled={Number(field.value) <= 1}
                  onClick={() => {
                    field.onChange(Math.max(1, Number(field.value) - 1))
                  }}
                >
                  <RiSubtractLine />
                </Button>
                <ButtonGroupText className="flex-1">
                  {field.value}
                </ButtonGroupText>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="增加库存"
                  title="增加库存"
                  onClick={() => {
                    field.onChange(Number(field.value) + 1)
                  }}
                >
                  <RiAddLine />
                </Button>
              </ButtonGroup>
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />
      </FieldGroup>

      <Button
        type="button"
        size="lg"
        disabled={submitted || submitting}
        onClick={form.handleSubmit(submitSpotGoods)}
      >
        <RiCheckboxCircleLine data-icon="inline-start" />
        {submitting ? "提交中" : submitted ? "已提交上架" : "上架商品"}
      </Button>
      {submissionError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {submissionError}
        </p>
      ) : null}

    </div>
  )
}

function TemplateActionItem({
  title,
  description,
  icon,
  href,
}: {
  title: string
  description: string
  icon: ReactNode
  href: string
}) {
  return (
    <Item variant="outline" asChild>
      <Link href={href}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
          {icon}
        </span>
        <ItemContent>
          <ItemTitle>{title}</ItemTitle>
          <ItemDescription>{description}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <RiArrowRightSLine />
        </ItemActions>
      </Link>
    </Item>
  )
}

function isBarcodeReady(value: string, barcodeLengths: number[]) {
  const barcode = value.trim()

  return /^\d+$/.test(barcode) && barcodeLengths.includes(barcode.length)
}
