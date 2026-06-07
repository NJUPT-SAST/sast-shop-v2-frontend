"use client"

import { FormProvider, useTypedForm } from "@/components/forms/typed-form"
import { MobileHeader } from "@/components/layout/mobile-header"
import { StickyActionBar } from "@/components/layout/sticky-action-bar"
import { CommonFields, MediaFields } from "@/components/listing-form/shared"
import { StepPresaleFunding } from "@/components/listing-form/steps/step-presale-funding"
import { StepVoteVariants } from "@/components/listing-form/steps/step-vote-variants"
import { ErrorState } from "@/components/states/error-state"
import { SkeletonDetail } from "@/components/states/skeleton-detail"
import { isApiError } from "@/lib/api/errors"
import { useAuthMe, useListing, useUpdateListing } from "@/lib/api/queries"
import type { CreateListingInput, Listing } from "@/lib/api/types"
import {
  type PresaleListingInput,
  type SecondhandListingInput,
  type VoteFirstListingInput,
  presaleListingSchema,
  secondhandListingSchema,
  voteFirstListingSchema,
} from "@/lib/schemas/listing"
import { notify } from "@/lib/utils/toast"
import { Button } from "@heroui/react"
import { Icon } from "@iconify/react"
import { useParams, useRouter } from "next/navigation"
import type { z } from "zod"

export default function EditView() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const { data: me, isPending: mePending } = useAuthMe()
  const { data: listing, isPending, isError, refetch } = useListing(id)

  if (isPending || mePending) {
    return (
      <>
        <MobileHeader showBack title="编辑商品" />
        <main className="mx-auto w-full max-w-3xl px-4 py-4 md:px-8 md:py-8">
          <SkeletonDetail />
        </main>
      </>
    )
  }

  if (isError || !listing) {
    return (
      <>
        <MobileHeader showBack title="编辑商品" />
        <main className="mx-auto w-full max-w-3xl px-4 py-4 md:px-8 md:py-8">
          <ErrorState onRetry={refetch} />
        </main>
      </>
    )
  }

  // Ownership check: only the seller may edit. Admin force-edit is intentionally not allowed
  // (admins use /admin tooling instead).
  if (!me || me.id !== listing.seller.id) {
    return (
      <>
        <MobileHeader showBack title="编辑商品" />
        <main className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-4 py-12 text-center md:px-8">
          <Icon className="size-12 text-shop-warning" icon="material-symbols:lock-rounded" />
          <h1 className="text-[18px] font-semibold text-shop-text-primary">无法编辑</h1>
          <p className="text-[14px] text-shop-text-secondary">只有商品的发布者可以编辑这个商品。</p>
          <Button onPress={() => router.push(`/listings/${id}`)} variant="primary">
            返回商品详情
          </Button>
        </main>
      </>
    )
  }

  if (listing.type === "crowdfund" && listing.cf_mode === "vote_first") {
    return <EditVoteForm listing={listing} />
  }
  if (listing.type === "crowdfund" && listing.cf_mode === "presale") {
    return <EditPresaleForm listing={listing} />
  }
  // secondhand & direct_sale share the same form shape.
  return <EditSecondhandForm listing={listing} />
}

// ===================================================================
// Secondhand / Direct sale
// ===================================================================
function EditSecondhandForm({ listing }: { listing: Listing }) {
  const router = useRouter()
  const update = useUpdateListing(listing.id)
  const form = useTypedForm(secondhandListingSchema, {
    defaultValues: listingToSecondhandValues(listing),
  })

  async function onSubmit(values: SecondhandListingInput) {
    try {
      await update.mutateAsync(values as Partial<CreateListingInput>)
      notify({ title: "已保存修改", color: "success" })
      router.replace(`/listings/${listing.id}`)
    } catch (err) {
      notify({ title: isApiError(err) ? err.message : "保存失败", color: "danger" })
    }
  }

  return (
    <>
      <MobileHeader showBack title="编辑二手商品" />
      <FormProvider {...form}>
        <form
          className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 pb-24 md:gap-4 md:px-8 md:py-8"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <header className="hidden md:block">
            <h1 className="text-[24px] font-semibold text-shop-text-primary">编辑二手商品</h1>
          </header>
          <MediaFields desc="第一张为封面，可拖拽排序" title="商品图片" variant="hero" />
          <CommonFields omitMedia />

          <StickyActionBar>
            <Button isDisabled={update.isPending} onPress={() => router.back()} variant="ghost">
              取消
            </Button>
            <Button className="flex-1" isPending={update.isPending} type="submit" variant="primary">
              保存修改
            </Button>
          </StickyActionBar>
        </form>
      </FormProvider>
    </>
  )
}

// ===================================================================
// Vote-first crowdfund
// ===================================================================
function EditVoteForm({ listing }: { listing: Listing }) {
  const router = useRouter()
  const update = useUpdateListing(listing.id)
  const form = useTypedForm(voteFirstListingSchema, {
    defaultValues: listingToVoteValues(listing),
  })

  async function onSubmit(values: VoteFirstListingInput) {
    try {
      await update.mutateAsync({
        ...values,
        deadline: new Date(values.deadline).toISOString(),
      } as Partial<CreateListingInput>)
      notify({ title: "已保存修改", color: "success" })
      router.replace(`/listings/${listing.id}`)
    } catch (err) {
      notify({ title: isApiError(err) ? err.message : "保存失败", color: "danger" })
    }
  }

  return (
    <>
      <MobileHeader showBack title="编辑投票众筹" />
      <FormProvider {...form}>
        <form
          className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 pb-24 md:gap-4 md:px-8 md:py-8"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <header className="hidden md:block">
            <h1 className="text-[24px] font-semibold text-shop-text-primary">编辑投票众筹</h1>
          </header>
          <CommonFields />
          <StepVoteVariants />

          <StickyActionBar>
            <Button isDisabled={update.isPending} onPress={() => router.back()} variant="ghost">
              取消
            </Button>
            <Button className="flex-1" isPending={update.isPending} type="submit" variant="primary">
              保存修改
            </Button>
          </StickyActionBar>
        </form>
      </FormProvider>
    </>
  )
}

// ===================================================================
// Presale crowdfund
// ===================================================================
function EditPresaleForm({ listing }: { listing: Listing }) {
  const router = useRouter()
  const update = useUpdateListing(listing.id)
  const form = useTypedForm(presaleListingSchema, {
    defaultValues: listingToPresaleValues(listing),
  })

  async function onSubmit(values: PresaleListingInput) {
    try {
      await update.mutateAsync({
        ...values,
        deadline: new Date(values.deadline).toISOString(),
      } as Partial<CreateListingInput>)
      notify({ title: "已保存修改", color: "success" })
      router.replace(`/listings/${listing.id}`)
    } catch (err) {
      notify({ title: isApiError(err) ? err.message : "保存失败", color: "danger" })
    }
  }

  return (
    <>
      <MobileHeader showBack title="编辑预售众筹" />
      <FormProvider {...form}>
        <form
          className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 pb-24 md:gap-4 md:px-8 md:py-8"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <header className="hidden md:block">
            <h1 className="text-[24px] font-semibold text-shop-text-primary">编辑预售众筹</h1>
          </header>
          <CommonFields lockedPaymentMode="sub_merchant" />
          <StepPresaleFunding />

          <StickyActionBar>
            <Button isDisabled={update.isPending} onPress={() => router.back()} variant="ghost">
              取消
            </Button>
            <Button className="flex-1" isPending={update.isPending} type="submit" variant="primary">
              保存修改
            </Button>
          </StickyActionBar>
        </form>
      </FormProvider>
    </>
  )
}

// ===================================================================
// Helpers — convert Listing (server) → Form input shape
// ===================================================================

/** Convert ISO timestamp to <input type="datetime-local"> friendly string. */
function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  // YYYY-MM-DDTHH:mm in local time
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function listingToSecondhandValues(l: Listing): SecondhandListingInput {
  return {
    type: "secondhand",
    title: l.title,
    description: l.description,
    price: l.price,
    stock: l.stock,
    image_urls: l.image_urls,
    shipping_mode: l.shipping_mode,
    shipping_fee: l.shipping_fee ?? undefined,
    shipping_qr_url: l.shipping_qr_url ?? undefined,
    payment_mode: l.payment_mode,
    qr_code_url: l.qr_code_url ?? undefined,
    delivery_mode: l.delivery_mode,
  } as z.infer<typeof secondhandListingSchema>
}

function listingToVoteValues(l: Listing): VoteFirstListingInput {
  return {
    type: "crowdfund",
    cf_mode: "vote_first",
    title: l.title,
    description: l.description,
    price: l.price,
    stock: l.stock,
    image_urls: l.image_urls,
    shipping_mode: l.shipping_mode,
    shipping_fee: l.shipping_fee ?? undefined,
    shipping_qr_url: l.shipping_qr_url ?? undefined,
    payment_mode: l.payment_mode,
    qr_code_url: l.qr_code_url ?? undefined,
    delivery_mode: l.delivery_mode,
    target_votes: l.target_votes ?? 50,
    deadline: isoToLocal(l.deadline),
    show_vote_count: l.show_vote_count,
    vote_weight_strategy: l.vote_weight_strategy ?? "equal",
    variants: l.variants.map((v) => ({
      name: v.name,
      max_votes_per_user: v.max_votes_per_user,
      designs: v.designs.map((d) => ({ name: d.name, image_url: d.image_url })),
    })),
  } as z.infer<typeof voteFirstListingSchema>
}

function listingToPresaleValues(l: Listing): PresaleListingInput {
  return {
    type: "crowdfund",
    cf_mode: "presale",
    title: l.title,
    description: l.description,
    price: l.price,
    stock: l.stock,
    image_urls: l.image_urls,
    shipping_mode: l.shipping_mode,
    shipping_fee: l.shipping_fee ?? undefined,
    shipping_qr_url: l.shipping_qr_url ?? undefined,
    payment_mode: "sub_merchant",
    qr_code_url: undefined,
    delivery_mode: l.delivery_mode,
    target_amount: l.target_amount ?? "10000.00",
    deadline: isoToLocal(l.deadline),
  } as z.infer<typeof presaleListingSchema>
}
