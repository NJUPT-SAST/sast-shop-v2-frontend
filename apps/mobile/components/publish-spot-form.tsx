"use client"

import { useMemo, useState } from "react"
import {
  RiBarcodeLine,
  RiCheckboxCircleLine,
  RiQuestionLine,
  RiQrScan2Line,
} from "@remixicon/react"
import {
  createSpotGoods,
  type DataSource,
  type ProductTemplate,
  type ServiceOptions,
} from "@sast-shop/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"

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
  const [barcode, setBarcode] = useState("")
  const [queried, setQueried] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  )
  const [price, setPrice] = useState("")
  const [stock, setStock] = useState("1")
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const candidates = useMemo(
    () =>
      queried && barcode.trim()
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
    [barcode, queried, templates]
  )
  const canSubmit = selectedTemplate && price.trim() && Number(stock) > 0

  async function submitSpotGoods() {
    if (!selectedTemplate) return

    setSubmitting(true)
    setSubmissionError(null)

    try {
      await createSpotGoods(
        {
          productTemplateId: selectedTemplate.id,
          salePriceCents: Math.round(Number(price) * 100),
          stockTotal: Number(stock),
          productTemplateUpdatedAt: selectedTemplate.updatedAt,
        },
        serviceOptions
      )
      setSubmitted(true)
    } catch {
      setSubmissionError("上架失败，请稍后再试")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 py-6">
      <section className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold md:text-2xl">上架现货</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error ?? "输入条码后选择商品模板，再设置售价和库存。"}
          </p>
        </div>
        <Badge variant={submitted ? "default" : "outline"}>
          {submitted ? "已提交" : "草稿"}
        </Badge>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="barcode" className="text-sm font-medium">
            商品条码编号
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <RiBarcodeLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="barcode"
                value={barcode}
                className="pl-9"
                placeholder="输入或扫描条码"
                onChange={(event) => {
                  setBarcode(event.target.value)
                  setQueried(false)
                  setSelectedTemplate(null)
                  setSubmitted(false)
                }}
              />
            </div>
            <Button type="button" variant="outline" size="icon-lg">
              <RiQrScan2Line />
            </Button>
            <Button
              type="button"
              onClick={() => {
                setQueried(true)
                setSelectedTemplate(null)
                setSubmitted(false)
              }}
            >
              查询
            </Button>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">
            <RiQuestionLine className="mt-0.5 size-4 shrink-0" />
            <span>条码加店铺唯一确定商品模板；没有模板时需先维护模板。</span>
          </div>
        </div>

        {queried && barcode.trim() && candidates.length === 0 ? (
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="text-sm">未找到商品模板</CardTitle>
              <p className="text-sm text-muted-foreground">
                当前能力只展示查询结果，新增模板入口后再补录入流程。
              </p>
            </CardHeader>
          </Card>
        ) : null}

        {candidates.map((template) => (
          <Button
            key={template.barcode}
            type="button"
            variant="ghost"
            size="lg"
            className="h-auto w-full justify-start p-0 text-left"
            onClick={() => setSelectedTemplate(template)}
          >
            <Card className="rounded-lg transition-colors hover:bg-muted/30">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base leading-6">
                      {template.title}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  </div>
                  {selectedTemplate?.barcode === template.barcode ? (
                    <Badge>已选择</Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  店铺：{template.store}
                </p>
              </CardContent>
            </Card>
          </Button>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="spot-price" className="text-sm font-medium">
            售卖单价
          </label>
          <Input
            id="spot-price"
            value={price}
            type="number"
            min={0}
            step={0.01}
            placeholder="0.00"
            disabled={!selectedTemplate}
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="spot-stock" className="text-sm font-medium">
            初始库存
          </label>
          <Input
            id="spot-stock"
            value={stock}
            type="number"
            min={1}
            disabled={!selectedTemplate}
            onChange={(event) => setStock(event.target.value)}
          />
        </div>
      </section>

      <Button
        type="button"
        size="lg"
        disabled={!canSubmit || submitted || submitting}
        onClick={() => {
          void submitSpotGoods()
        }}
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
