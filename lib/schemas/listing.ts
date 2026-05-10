// Form-side validation. Mirrors the API doc §2.3 validation rules so we catch
// shape errors before round-tripping. The API still validates server-side.

import { z } from "zod"

// Crowdfund deadlines must give backers at least 24 hours.
const futureDeadline = z
  .string()
  .min(1, "请选择截止时间")
  .refine(
    (s) => {
      const ts = new Date(s).getTime()
      return Number.isFinite(ts) && ts - Date.now() >= 24 * 3600_000
    },
    { message: "截止时间需在 24 小时之后" }
  )

const positiveAmountString = z
  .string()
  .min(1, "请填写金额")
  .regex(/^\d+(\.\d{1,2})?$/, "金额最多两位小数")

const baseListing = {
  title: z.string().min(1, "请填写标题").max(200),
  description: z.string().max(5000),
  price: positiveAmountString,
  image_urls: z.array(z.string().url()).min(1, "请至少上传一张图片").max(9, "最多上传 9 张图片"),
  delivery_mode: z.enum(["express", "pickup", "none"]),
  shipping_mode: z.enum(["free", "fixed", "variable"]),
  shipping_fee: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  shipping_qr_url: z.string().url().optional(),
  payment_mode: z.enum(["sub_merchant", "qr_code"]),
  qr_code_url: z.string().url().optional(),
}

const variantSchema = z.object({
  name: z.string().min(1, "请填写款式名"),
  max_votes_per_user: z.number().int().min(1),
  designs: z
    .array(
      z.object({
        name: z.string().min(1, "请填写方案名"),
        image_url: z.string().url(),
      })
    )
    .min(1, "请至少添加一个方案"),
})

export const secondhandListingSchema = z.object({
  type: z.literal("secondhand"),
  ...baseListing,
  stock: z.number().int().min(1).max(99),
})

export const voteFirstListingSchema = z.object({
  type: z.literal("crowdfund"),
  cf_mode: z.literal("vote_first"),
  ...baseListing,
  stock: z.number().int().min(1),
  target_votes: z.number().int().min(1, "请设置投票目标"),
  deadline: futureDeadline,
  show_vote_count: z.boolean(),
  vote_weight_strategy: z.enum(["equal", "time_decayed"]),
  variants: z.array(variantSchema).min(1, "请至少添加一个款式"),
})

export const presaleListingSchema = z.object({
  type: z.literal("crowdfund"),
  cf_mode: z.literal("presale"),
  ...baseListing,
  stock: z.number().int().min(1),
  target_amount: positiveAmountString,
  deadline: futureDeadline,
  payment_mode: z.literal("sub_merchant"),
})

export const directSaleListingSchema = z.object({
  type: z.literal("direct_sale"),
  ...baseListing,
  stock: z.number().int().min(1),
  origin: z.enum(["vote_winner", "official"]).optional(),
})

export const listingSchema = z.discriminatedUnion("type", [
  secondhandListingSchema,
  // crowdfund branches share `type=crowdfund` but distinguish on `cf_mode`.
  // Zod doesn't support nested discriminated unions on a single field, so we
  // expose them as a flat union and rely on the form to set both fields.
  voteFirstListingSchema,
  presaleListingSchema,
  directSaleListingSchema,
])

export type SecondhandListingInput = z.infer<typeof secondhandListingSchema>
export type VoteFirstListingInput = z.infer<typeof voteFirstListingSchema>
export type PresaleListingInput = z.infer<typeof presaleListingSchema>
export type DirectSaleListingInput = z.infer<typeof directSaleListingSchema>
export type ListingInput = z.infer<typeof listingSchema>
