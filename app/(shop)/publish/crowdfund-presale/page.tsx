"use client"

import { FormProvider, useTypedForm } from "@/components/forms/typed-form"
import { MobileHeader } from "@/components/layout/mobile-header"
import { defaultDraft } from "@/components/listing-form/shared"
import { StepNavBar } from "@/components/listing-form/step-nav-bar"
import { StepShell } from "@/components/listing-form/step-shell"
import type { StepDescriptor } from "@/components/listing-form/stepper"
import { StepInfo } from "@/components/listing-form/steps/step-info"
import { StepMedia } from "@/components/listing-form/steps/step-media"
import { StepPresaleFunding } from "@/components/listing-form/steps/step-presale-funding"
import { StepPreview } from "@/components/listing-form/steps/step-preview"
import { StepShippingPayment } from "@/components/listing-form/steps/step-shipping-payment"
import { isApiError } from "@/lib/api/errors"
import { useCreateListing } from "@/lib/api/queries"
import { type PresaleListingInput, presaleListingSchema } from "@/lib/schemas/listing"
import { useDraftStore } from "@/lib/stores/draft-store"
import { notify } from "@/lib/utils/toast"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import type { FieldPath } from "react-hook-form"

const STEPS: ReadonlyArray<StepDescriptor> = [
  {
    key: "info",
    title: "基本信息",
    caption: "标题、描述、价格",
    fields: ["title", "description", "price", "stock"],
  },
  {
    key: "funding",
    title: "众筹设置",
    caption: "目标金额与截止时间",
    fields: ["target_amount", "deadline"],
  },
  { key: "media", title: "商品图片", caption: "封面与图集", fields: ["image_urls"] },
  {
    key: "shipping",
    title: "配送与支付",
    caption: "怎么发、怎么付",
    fields: ["delivery_mode", "shipping_mode", "shipping_fee", "payment_mode"],
  },
  { key: "preview", title: "预览提交", caption: "最后核对一次", fields: [] },
] as const

const initialValues = (): PresaleListingInput => ({
  type: "crowdfund",
  cf_mode: "presale",
  ...defaultDraft(),
  stock: 1,
  payment_mode: "sub_merchant",
  qr_code_url: undefined,
  target_amount: "10000.00",
  deadline: "",
})

export default function PublishCrowdfundPresalePage() {
  const router = useRouter()
  const create = useCreateListing()
  const draftStore = useDraftStore()

  const draft = draftStore.get<PresaleListingInput>("presale")
  const form = useTypedForm(presaleListingSchema, {
    defaultValues: draft?.values ?? initialValues(),
  })
  const [step, setStep] = useState(() => Math.min(draft?.lastStep ?? 0, STEPS.length - 1))

  useEffect(() => {
    const sub = form.watch((values) => draftStore.set("presale", values, step))
    return () => sub.unsubscribe()
  }, [form, draftStore, step])

  async function goNext() {
    const fields = STEPS[step].fields as FieldPath<PresaleListingInput>[]
    const ok = fields.length === 0 ? true : await form.trigger(fields, { shouldFocus: true })
    if (!ok) return
    const next = Math.min(step + 1, STEPS.length - 1)
    setStep(next)
    draftStore.set("presale", form.getValues(), next)
  }

  function goPrev() {
    const next = Math.max(step - 1, 0)
    setStep(next)
    draftStore.set("presale", form.getValues(), next)
  }

  function clearDraft() {
    draftStore.clear("presale")
    form.reset(initialValues())
    setStep(0)
  }

  async function onSubmit(values: PresaleListingInput) {
    try {
      const created = await create.mutateAsync({
        ...values,
        deadline: new Date(values.deadline).toISOString(),
      })
      draftStore.clear("presale")
      notify({ title: "已提交审核", color: "success" })
      router.replace(`/listings/${created.id}`)
    } catch (err) {
      notify({ title: isApiError(err) ? err.message : "提交失败", color: "danger" })
    }
  }

  const currentKey = STEPS[step].key

  return (
    <>
      <MobileHeader showBack title="发起预售众筹" />
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <StepShell
            current={step}
            desktopHeader={
              <header>
                <h1 className="text-[20px] font-semibold text-shop-text-primary">发起预售众筹</h1>
                <p className="mt-1 text-[12px] text-shop-text-secondary">
                  需管理员审核 · 子商户支付，未达标自动退款
                </p>
              </header>
            }
            onStepClick={(i) => i < step && setStep(i)}
            steps={STEPS}
          >
            {currentKey === "info" ? <StepInfo /> : null}
            {currentKey === "funding" ? <StepPresaleFunding /> : null}
            {currentKey === "media" ? <StepMedia /> : null}
            {currentKey === "shipping" ? (
              <StepShippingPayment lockedPaymentMode="sub_merchant" />
            ) : null}
            {currentKey === "preview" ? <StepPreview /> : null}

            <StepNavBar
              isFirst={step === 0}
              isLast={step === STEPS.length - 1}
              isSubmitting={create.isPending}
              onClearDraft={clearDraft}
              onNext={goNext}
              onPrev={goPrev}
            />
          </StepShell>
        </form>
      </FormProvider>
    </>
  )
}
