"use client"

import { FormProvider, useTypedForm } from "@/components/forms/typed-form"
import { MobileHeader } from "@/components/layout/mobile-header"
import { StickyActionBar } from "@/components/layout/sticky-action-bar"
import { CommonFields, MediaFields, defaultDraft } from "@/components/listing-form/shared"
import { isApiError } from "@/lib/api/errors"
import { useCreateListing } from "@/lib/api/queries"
import { type SecondhandListingInput, secondhandListingSchema } from "@/lib/schemas/listing"
import { useDraftStore } from "@/lib/stores/draft-store"
import { notify } from "@/lib/utils/toast"
import { Button } from "@heroui/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

const initialValues = (): SecondhandListingInput => ({
  type: "secondhand",
  ...defaultDraft(),
  stock: 1,
})

export default function PublishSecondhandPage() {
  const router = useRouter()
  const create = useCreateListing()
  const draftStore = useDraftStore()

  const draft = draftStore.get<SecondhandListingInput>("secondhand")
  const form = useTypedForm(secondhandListingSchema, {
    defaultValues: draft?.values ?? initialValues(),
  })

  // Auto-save draft on change (lightweight — every state change persists).
  useEffect(() => {
    const sub = form.watch((values) => {
      draftStore.set("secondhand", values)
    })
    return () => sub.unsubscribe()
  }, [form, draftStore])

  async function onSubmit(values: SecondhandListingInput) {
    try {
      const created = await create.mutateAsync(values)
      draftStore.clear("secondhand")
      notify({ title: "上架成功", color: "success" })
      router.replace(`/listings/${created.id}`)
    } catch (err) {
      notify({ title: isApiError(err) ? err.message : "上架失败", color: "danger" })
    }
  }

  return (
    <>
      <MobileHeader showBack title="上架二手" />
      <FormProvider {...form}>
        <form
          className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 pb-24 md:gap-4 md:px-8 md:py-8"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <header className="hidden md:block">
            <h1 className="text-[24px] font-semibold text-shop-text-primary">上架二手商品</h1>
            <p className="mt-1 text-[14px] text-shop-text-secondary">免审核，发布后立即上线</p>
          </header>
          {/* 闲鱼风格：商品图置顶大幅展示，其余字段紧随其后 */}
          <MediaFields desc="第一张为封面，可拖拽排序" title="晒图，越多越快卖出" variant="hero" />
          <CommonFields omitMedia />

          <StickyActionBar>
            <Button
              isDisabled={create.isPending}
              onPress={() => {
                draftStore.clear("secondhand")
                form.reset(initialValues())
              }}
              variant="ghost"
            >
              清空草稿
            </Button>
            <Button className="flex-1" isPending={create.isPending} type="submit" variant="primary">
              发布到二手商城
            </Button>
          </StickyActionBar>
        </form>
      </FormProvider>
    </>
  )
}
