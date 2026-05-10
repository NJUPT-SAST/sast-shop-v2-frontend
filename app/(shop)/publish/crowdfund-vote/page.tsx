"use client"

import { FormProvider, useTypedForm } from "@/components/forms/typed-form"
import { MobileHeader } from "@/components/layout/mobile-header"
import { defaultDraft } from "@/components/listing-form/shared"
import { StepNavBar } from "@/components/listing-form/step-nav-bar"
import { StepShell } from "@/components/listing-form/step-shell"
import type { StepDescriptor } from "@/components/listing-form/stepper"
import { StepInfo } from "@/components/listing-form/steps/step-info"
import { StepMedia } from "@/components/listing-form/steps/step-media"
import { StepPreview } from "@/components/listing-form/steps/step-preview"
import { StepShippingPayment } from "@/components/listing-form/steps/step-shipping-payment"
import { StepVoteVariants } from "@/components/listing-form/steps/step-vote-variants"
import { isApiError } from "@/lib/api/errors"
import { useCreateListing } from "@/lib/api/queries"
import { type VoteFirstListingInput, voteFirstListingSchema } from "@/lib/schemas/listing"
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
    key: "vote",
    title: "投票设置",
    caption: "目标、款式、方案",
    fields: ["target_votes", "deadline", "show_vote_count", "variants"],
  },
  { key: "media", title: "商品图片", caption: "封面与图集", fields: ["image_urls"] },
  {
    key: "shipping",
    title: "配送与支付",
    caption: "怎么发、怎么付",
    fields: ["delivery_mode", "shipping_mode", "shipping_fee", "payment_mode", "qr_code_url"],
  },
  { key: "preview", title: "预览提交", caption: "最后核对一次", fields: [] },
] as const

const initialValues = (): VoteFirstListingInput => ({
  type: "crowdfund",
  cf_mode: "vote_first",
  ...defaultDraft(),
  stock: 1,
  target_votes: 50,
  deadline: "",
  show_vote_count: true,
  vote_weight_strategy: "equal",
  variants: [
    {
      name: "",
      max_votes_per_user: 1,
      designs: [{ name: "", image_url: "" }],
    },
  ],
})

export default function PublishCrowdfundVotePage() {
  const router = useRouter()
  const create = useCreateListing()
  const draftStore = useDraftStore()

  const draft = draftStore.get<VoteFirstListingInput>("vote")
  const form = useTypedForm(voteFirstListingSchema, {
    defaultValues: draft?.values ?? initialValues(),
  })
  const [step, setStep] = useState(() => Math.min(draft?.lastStep ?? 0, STEPS.length - 1))

  // Auto-save draft on every change, persisting current step too.
  useEffect(() => {
    const sub = form.watch((values) => draftStore.set("vote", values, step))
    return () => sub.unsubscribe()
  }, [form, draftStore, step])

  async function goNext() {
    const fields = STEPS[step].fields as FieldPath<VoteFirstListingInput>[]
    const ok = fields.length === 0 ? true : await form.trigger(fields, { shouldFocus: true })
    if (!ok) return
    const next = Math.min(step + 1, STEPS.length - 1)
    setStep(next)
    draftStore.set("vote", form.getValues(), next)
  }

  function goPrev() {
    const next = Math.max(step - 1, 0)
    setStep(next)
    draftStore.set("vote", form.getValues(), next)
  }

  function clearDraft() {
    draftStore.clear("vote")
    form.reset(initialValues())
    setStep(0)
  }

  async function onSubmit(values: VoteFirstListingInput) {
    try {
      const created = await create.mutateAsync({
        ...values,
        deadline: new Date(values.deadline).toISOString(),
      })
      draftStore.clear("vote")
      notify({ title: "已提交审核", color: "success" })
      router.replace(`/listings/${created.id}`)
    } catch (err) {
      notify({ title: isApiError(err) ? err.message : "提交失败", color: "danger" })
    }
  }

  const currentKey = STEPS[step].key

  return (
    <>
      <MobileHeader showBack title="发起投票众筹" />
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <StepShell
            current={step}
            desktopHeader={
              <header>
                <h1 className="text-[20px] font-semibold text-shop-text-primary">发起投票众筹</h1>
                <p className="mt-1 text-[12px] text-shop-text-secondary">
                  需要管理员审核后方可上线
                </p>
              </header>
            }
            onStepClick={(i) => i < step && setStep(i)}
            steps={STEPS}
          >
            {currentKey === "info" ? <StepInfo /> : null}
            {currentKey === "vote" ? <StepVoteVariants /> : null}
            {currentKey === "media" ? <StepMedia /> : null}
            {currentKey === "shipping" ? <StepShippingPayment /> : null}
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
