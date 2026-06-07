// Domain types for SAST Shop API v1.1.
// Source of truth: Feishu wiki API doc (DMvtwCoxtiRKOiksCQRc2S2Dnte) §8 + DB schema doc.
// All `*` enum constants live here as `as const` arrays so we can derive a union
// AND iterate over them at runtime (e.g. for filter dropdowns).

export const LISTING_TYPES = ["secondhand", "crowdfund", "direct_sale"] as const
export type ListingType = (typeof LISTING_TYPES)[number]

export const CF_MODES = ["presale", "vote_first"] as const
export type CfMode = (typeof CF_MODES)[number]

export const LISTING_ORIGINS = ["vote_winner", "official"] as const
export type ListingOrigin = (typeof LISTING_ORIGINS)[number]

export const LISTING_STATUSES = [
  "draft",
  "pending_review",
  "rejected",
  "voting",
  "active",
  "funded",
  "completed",
  "closed",
] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]

export const SHIPPING_MODES = ["free", "fixed", "variable"] as const
export type ShippingMode = (typeof SHIPPING_MODES)[number]

export const PAYMENT_MODES = ["sub_merchant", "qr_code"] as const
export type PaymentMode = (typeof PAYMENT_MODES)[number]

export const DELIVERY_MODES = ["express", "pickup", "none"] as const
export type DeliveryMode = (typeof DELIVERY_MODES)[number]

export const VOTE_WEIGHT_STRATEGIES = ["equal", "time_decayed"] as const
export type VoteWeightStrategy = (typeof VOTE_WEIGHT_STRATEGIES)[number]

export const ORDER_STATUSES = [
  "pending_payment",
  "pending_confirm",
  "paid",
  "producing",
  "shipped",
  "completed",
  "refunding",
  "refunded",
  "closed",
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const SHIPPING_STATUSES = [
  "pending",
  "awaiting_confirm",
  "awaiting_payment",
  "paid",
] as const
export type ShippingStatus = (typeof SHIPPING_STATUSES)[number]

export const PAYMENT_METHODS = ["wechat", "alipay"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export const PRESIGN_PURPOSES = ["listing_image", "qr_code", "shipping_qr", "avatar"] as const
export type PresignPurpose = (typeof PRESIGN_PURPOSES)[number]

// ---- Resources --------------------------------------------------------------

export type User = {
  id: string
  feishu_user_id: string
  name: string
  avatar_url: string | null
  email: string | null
  department: string | null
  is_admin: boolean
  created_at: string
}

export type SellerLite = Pick<User, "id" | "name" | "avatar_url">

export type ListingDesign = {
  id: string
  name: string
  image_url: string
  current_votes: number
}

export type ListingVariant = {
  id: string
  name: string
  max_votes_per_user: number
  designs: ListingDesign[]
}

export type Listing = {
  id: string
  type: ListingType
  cf_mode: CfMode | null
  origin: ListingOrigin | null
  status: ListingStatus
  title: string
  description: string
  // Decimal as string per API doc (avoids float precision in JSON).
  price: string
  stock: number
  image_urls: string[]
  shipping_mode: ShippingMode
  shipping_fee: string | null
  shipping_qr_url: string | null
  payment_mode: PaymentMode
  qr_code_url: string | null
  delivery_mode: DeliveryMode
  // vote_first only:
  target_votes: number | null
  current_votes: number | null
  show_vote_count: boolean
  vote_weight_strategy: VoteWeightStrategy | null
  variants: ListingVariant[]
  // presale only:
  target_amount: string | null
  current_amount: string | null
  supporter_count: number | null
  deadline: string | null
  seller: SellerLite
  created_at: string
  updated_at: string
}

export type Paginated<T> = {
  items: T[]
  page: number
  limit: number
  total: number
  has_more: boolean
}

export type ListingsQuery = {
  type?: ListingType | "all"
  cf_mode?: CfMode
  status?: ListingStatus
  seller_id?: string
  q?: string
  sort?: "created_desc" | "price_asc" | "price_desc" | "popularity"
  page?: number
  limit?: number
}

export type CreateListingInput = {
  type: ListingType
  cf_mode?: CfMode
  title: string
  description: string
  price: string
  stock: number
  image_urls: string[]
  shipping_mode: ShippingMode
  shipping_fee?: string
  shipping_qr_url?: string
  payment_mode: PaymentMode
  qr_code_url?: string
  delivery_mode: DeliveryMode
  // vote_first
  target_votes?: number
  deadline?: string
  show_vote_count?: boolean
  vote_weight_strategy?: VoteWeightStrategy
  variants?: Array<{
    name: string
    max_votes_per_user: number
    designs: Array<{ name: string; image_url: string }>
  }>
  // presale
  target_amount?: string
}

export type VoteSelection = {
  variant_id: string
  design_id: string
}

export type VoteResponse = {
  listing_id: string
  current_votes: number
  user_selections: VoteSelection[]
}

export type PresignInput = {
  filename: string
  content_type: string
  size_bytes: number
  purpose: PresignPurpose
}

export type PresignResponse = {
  upload_url: string
  method: "PUT" | "POST"
  headers: Record<string, string>
  public_url: string
  expires_at: string
}

export type OrderListingSummary = {
  id: string
  title: string
  image_url: string | null
  type: ListingType
  shipping_mode: ShippingMode
}

export type OrderTimelineEntry = {
  status: OrderStatus | string
  at: string
}

export type Order = {
  id: string
  listing: OrderListingSummary
  buyer: SellerLite
  seller: SellerLite
  status: OrderStatus
  shipping_status: ShippingStatus | null
  amount: string
  shipping_fee: string | null
  quantity: number
  payment_method: PaymentMethod | null
  payment_code: string | null
  payment_qr_url: string | null
  shipping_qr_url: string | null
  payment_trade_no: string | null
  shipping_address: string | null
  tracking_number: string | null
  carrier: string | null
  remark: string | null
  timeline: OrderTimelineEntry[]
  created_at: string
  updated_at: string
  paid_at: string | null
  shipped_at: string | null
  completed_at: string | null
}

export type OrdersQuery = {
  role?: "buyer" | "seller"
  status?: OrderStatus
  page?: number
  limit?: number
}

export type CreateOrderInput = {
  listing_id: string
  quantity: number
  shipping_address?: string
  remark?: string
}

export type PayInput = {
  method: PaymentMethod
  client?: "h5" | "native" | "mini_program"
}

export type PayResponse = {
  method: PaymentMethod
  payload: Record<string, string>
}

export type ConfirmReceiptInput = {
  payment_code?: string
  payment_trade_no?: string
}

export type ConfirmPaymentInput = {
  shipping_fee_confirmed?: string
}

export type SetShippingFeeInput = {
  shipping_fee: string
  shipping_qr_url: string
}

export type ShipOrderInput = {
  carrier: string
  tracking_number: string
}

export type ReviewRequest = {
  id: string
  listing: Pick<Listing, "id" | "title"> & {
    image_url: string | null
    cf_mode: CfMode | null
  }
  seller: SellerLite
  status: ReviewStatus
  reject_reason: string | null
  created_at: string
  reviewed_at: string | null
}
