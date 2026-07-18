"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  RiAddLine,
  RiBarcodeLine,
  RiEditLine,
  RiFileList3Line,
  RiImageLine,
  RiSearchLine,
} from "@remixicon/react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"
import {
  createProductTemplate,
  updateProductTemplate,
  type DataSource,
  type ProductTemplate,
  type ServiceOptions,
  type Store,
  ValidationError,
} from "@sast-shop/api"
import { formatPrice } from "@sast-shop/domain"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import { Empty } from "@workspace/ui/components/empty"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@workspace/ui/components/item"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"

const templateSchema = z.object({
  storeId: z.string().min(1, "请选择店铺"),
  barcode: z
    .string()
    .trim()
    .min(1, "请输入商品条码")
    .max(64, "商品条码不能超过 64 位")
    .regex(/^\d+$/, "商品条码只能包含数字"),
  title: z.string().trim().min(1, "请输入商品名称").max(100),
  description: z.string().trim().max(500, "商品规格不能超过 500 字"),
  price: z.coerce
    .number<number>()
    .min(0.01, "参考价至少为 0.01 元")
    .max(21474836.47, "参考价过高")
    .multipleOf(0.01, "参考价最多保留两位小数"),
  mainImageUrl: z
    .string()
    .trim()
    .refine(
      (value) => !value || (value.length <= 2048 && /^https:\/\//.test(value)),
      "图片地址需要使用 HTTPS，且不能超过 2048 字符"
    ),
})

type TemplateFormValues = z.infer<typeof templateSchema>

type ProductTemplateManagerProps = {
  dataSource: DataSource
  connectBaseUrl: string
  stores: Store[]
  initialTemplates: ProductTemplate[]
  selectedStoreId: string | null
  prefillBarcode: string
  startCreating: boolean
  error: string | null
}

export function ProductTemplateManager({
  dataSource,
  connectBaseUrl,
  stores,
  initialTemplates,
  selectedStoreId,
  prefillBarcode,
  startCreating,
  error,
}: ProductTemplateManagerProps) {
  const router = useRouter()
  const serviceOptions: ServiceOptions = { dataSource, connectBaseUrl }
  const renderedStoreId = useRef(selectedStoreId)
  const [templates, setTemplates] = useState(initialTemplates)
  const [keyword, setKeyword] = useState("")
  const [editingTemplate, setEditingTemplate] = useState<ProductTemplate | null>(
    null
  )
  const [drawerOpen, setDrawerOpen] = useState(startCreating && Boolean(selectedStoreId))
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: createDefaultValues(selectedStoreId, prefillBarcode),
  })

  useEffect(() => {
    if (renderedStoreId.current === selectedStoreId) return

    renderedStoreId.current = selectedStoreId
    setTemplates(initialTemplates)
  }, [initialTemplates, selectedStoreId])

  const visibleTemplates = useMemo(() => {
    const value = keyword.trim().toLowerCase()
    if (!value) return templates

    return templates.filter((template) =>
      [template.title, template.description, template.barcode].some((field) =>
        field.toLowerCase().includes(value)
      )
    )
  }, [keyword, templates])

  function openCreateDrawer() {
    setEditingTemplate(null)
    form.reset(createDefaultValues(selectedStoreId, prefillBarcode))
    setDrawerOpen(true)
  }

  function openEditDrawer(template: ProductTemplate) {
    setEditingTemplate(template)
    form.reset({
      storeId: template.storeId,
      barcode: template.barcode,
      title: template.title,
      description: template.description,
      price: template.priceCents / 100,
      mainImageUrl: template.mainImageUrl,
    })
    setDrawerOpen(true)
  }

  async function saveTemplate(values: TemplateFormValues) {
    if (submitting) return

    setSubmitting(true)

    try {
      const payload = {
        storeId: values.storeId,
        barcode: values.barcode,
        title: values.title,
        description: values.description,
        priceCents: Math.round(values.price * 100),
        mainImageUrl: values.mainImageUrl,
      }
      const saved = editingTemplate
        ? await updateExistingTemplate(editingTemplate, payload, serviceOptions)
        : await createProductTemplate(payload, serviceOptions)

      if (saved.storeId === selectedStoreId) {
        setTemplates((current) => upsertTemplate(current, saved))
      } else {
        setTemplates((current) =>
          current.filter((template) => template.id !== saved.id)
        )
      }
      setDrawerOpen(false)
      setEditingTemplate(null)
      toast.success(editingTemplate ? "商品模板已更新" : "商品模板已创建")
      router.refresh()
    } catch (caught) {
      toast.error(readErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5 py-6">
      <section className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-7 md:text-2xl">
            商品模板
          </h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            维护条码、店铺、规格与参考价，供跑腿采购和现货上架复用。
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={!selectedStoreId}
          onClick={openCreateDrawer}
        >
          <RiAddLine />
          新建
        </Button>
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>模板暂不可用</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {stores.length > 0 ? (
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="template-store">当前店铺</FieldLabel>
            <Select
              value={selectedStoreId ?? undefined}
              onValueChange={(value) => {
                setKeyword("")
                router.replace(`/group/templates?store=${encodeURIComponent(value)}`)
              }}
            >
              <SelectTrigger
                id="template-store"
                className="h-10"
                aria-label="当前店铺"
              >
                <span className="truncate">
                  {stores.find((store) => store.id === selectedStoreId)?.name ??
                    "选择店铺"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="template-search">搜索模板</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <RiSearchLine />
              </InputGroupAddon>
              <InputGroupInput
                id="template-search"
                value={keyword}
                placeholder="搜索商品名称、规格或条码"
                onChange={(event) => setKeyword(event.target.value)}
              />
            </InputGroup>
          </Field>
        </FieldGroup>
      ) : null}

      {visibleTemplates.length > 0 ? (
        <section className="flex min-w-0 flex-col gap-3" aria-label="商品模板列表">
          {visibleTemplates.map((template) => (
            <TemplateItem
              key={template.id}
              template={template}
              onEdit={() => openEditDrawer(template)}
            />
          ))}
        </section>
      ) : !error ? (
        <Empty
          icon={<RiFileList3Line className="size-5" />}
          title={keyword ? "没有匹配的商品模板" : "暂无商品模板"}
          description={
            keyword
              ? "换个商品名称、规格或条码试试。"
              : "新建模板后，跑腿采购和现货上架都可以按条码复用。"
          }
          action={
            selectedStoreId && !keyword ? (
              <Button type="button" size="sm" onClick={openCreateDrawer}>
                <RiAddLine />
                新建模板
              </Button>
            ) : undefined
          }
        />
      ) : null}

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!submitting) setDrawerOpen(open)
        }}
      >
        <DrawerContent className="max-h-[88dvh]">
          <DrawerHeader className="shrink-0 text-left">
            <DrawerTitle>{editingTemplate ? "编辑商品模板" : "新建商品模板"}</DrawerTitle>
            <DrawerDescription>
              模板不记录库存和运费；保存后会供采购与上架流程复用。
            </DrawerDescription>
          </DrawerHeader>

          <form
            id="product-template-form"
            className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-2"
            onSubmit={form.handleSubmit(saveTemplate)}
          >
            <TemplateFields
              form={form}
              stores={stores}
              lockStore={Boolean(editingTemplate)}
            />
          </form>

          <DrawerFooter className="shrink-0 border-t bg-card">
            <Button
              type="submit"
              form="product-template-form"
              size="lg"
              disabled={submitting || (Boolean(editingTemplate) && !editingTemplate?.updatedAt)}
            >
              {submitting ? "保存中" : editingTemplate ? "保存修改" : "创建模板"}
            </Button>
            {editingTemplate && !editingTemplate.updatedAt ? (
              <p className="text-center text-xs text-destructive">
                缺少模板版本，刷新页面后再编辑。
              </p>
            ) : null}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function TemplateItem({
  template,
  onEdit,
}: {
  template: ProductTemplate
  onEdit: () => void
}) {
  return (
    <Item
      variant="outline"
      role="button"
      tabIndex={0}
      className="min-w-0 cursor-pointer items-start hover:bg-muted/30"
      onClick={onEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onEdit()
        }
      }}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {template.mainImageUrl ? <RiImageLine /> : <RiBarcodeLine />}
      </span>
      <ItemContent className="min-w-0 gap-1.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <ItemTitle className="min-w-0 truncate leading-5">
            {template.title}
          </ItemTitle>
          <Badge variant="secondary" className="shrink-0">
            {formatPrice(template.priceCents)}
          </Badge>
        </div>
        <ItemDescription className="line-clamp-2 break-words">
          {template.description || "暂无规格说明"}
        </ItemDescription>
        <ItemDescription className="truncate font-mono text-xs">
          {template.barcode}
        </ItemDescription>
      </ItemContent>
      <ItemActions className="self-center">
        <RiEditLine className="size-4 text-muted-foreground" />
      </ItemActions>
    </Item>
  )
}

function TemplateFields({
  form,
  stores,
  lockStore,
}: {
  form: ReturnType<typeof useForm<TemplateFormValues>>
  stores: Store[]
  lockStore: boolean
}) {
  return (
    <FieldGroup className="gap-5">
      <Controller
        name="storeId"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>店铺</FieldLabel>
            <Select
              value={field.value}
              disabled={lockStore}
              onValueChange={field.onChange}
            >
              <SelectTrigger
                id={field.name}
                aria-label="店铺"
                aria-invalid={fieldState.invalid}
              >
                <span className="truncate">
                  {stores.find((store) => store.id === field.value)?.name ??
                    "选择店铺"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {lockStore ? (
              <FieldDescription>
                编辑时不能更换店铺；请在目标店铺新建模板。
              </FieldDescription>
            ) : null}
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="barcode"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>商品条码</FieldLabel>
            <Input
              {...field}
              id={field.name}
              inputMode="numeric"
              autoComplete="off"
              placeholder="输入条码编号"
              aria-invalid={fieldState.invalid}
            />
            <FieldDescription>同一条码可属于不同店铺。</FieldDescription>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="title"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>商品名称</FieldLabel>
            <Input {...field} id={field.name} aria-invalid={fieldState.invalid} />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="description"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>规格说明</FieldLabel>
            <Textarea
              {...field}
              id={field.name}
              rows={3}
              placeholder="例如：550ml 瓶装"
              aria-invalid={fieldState.invalid}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="price"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>参考原价</FieldLabel>
            <InputGroup>
              <InputGroupAddon>¥</InputGroupAddon>
              <InputGroupInput
                {...field}
                id={field.name}
                type="number"
                min={0.01}
                step={0.01}
                inputMode="decimal"
                aria-invalid={fieldState.invalid}
              />
            </InputGroup>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="mainImageUrl"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>商品图片地址（选填）</FieldLabel>
            <Input
              {...field}
              id={field.name}
              type="url"
              inputMode="url"
              placeholder="https://example.com/image.jpg"
              aria-invalid={fieldState.invalid}
            />
            <FieldDescription>当前接口只支持保存图片地址。</FieldDescription>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
    </FieldGroup>
  )
}

function createDefaultValues(
  storeId: string | null,
  barcode: string
): TemplateFormValues {
  return {
    storeId: storeId ?? "",
    barcode,
    title: "",
    description: "",
    price: 0.01,
    mainImageUrl: "",
  }
}

async function updateExistingTemplate(
  template: ProductTemplate,
  patch: {
    barcode: string
    title: string
    description: string
    priceCents: number
    mainImageUrl: string
  },
  options: ServiceOptions
): Promise<ProductTemplate> {
  if (!template.updatedAt) {
    throw new Error("缺少模板版本，刷新页面后再试")
  }

  return updateProductTemplate(
    { id: template.id, updatedAt: template.updatedAt, patch },
    options
  )
}

function upsertTemplate(
  templates: ProductTemplate[],
  saved: ProductTemplate
): ProductTemplate[] {
  const index = templates.findIndex((template) => template.id === saved.id)
  if (index === -1) return [saved, ...templates]

  return templates.map((template) => (template.id === saved.id ? saved : template))
}

function readErrorMessage(error: unknown): string {
  if (error instanceof ValidationError && error.message.trim()) {
    return error.message
  }

  return "保存商品模板失败，请稍后再试"
}
