// Endpoint path builder. Keeping URLs in one place lets us verify against the
// API doc with a single grep and prevents typos like `/order/:id` vs `/orders/:id`.

const auth = {
  feishuLogin: (redirect?: string) =>
    redirect ? `/auth/feishu/login?redirect=${encodeURIComponent(redirect)}` : "/auth/feishu/login",
  me: "/auth/me",
  logout: "/auth/logout",
} as const

const listings = {
  list: "/listings",
  detail: (id: string) => `/listings/${id}`,
  create: "/listings",
  update: (id: string) => `/listings/${id}`,
  delete: (id: string) => `/listings/${id}`,
  vote: (id: string) => `/listings/${id}/vote`,
} as const

const storage = {
  presign: "/storage/presign",
} as const

const orders = {
  list: "/orders",
  detail: (id: string) => `/orders/${id}`,
  create: "/orders",
  pay: (id: string) => `/orders/${id}/pay`,
  confirmReceipt: (id: string) => `/orders/${id}/confirm-receipt`,
  confirmPayment: (id: string) => `/orders/${id}/confirm-payment`,
  setShippingFee: (id: string) => `/orders/${id}/shipping-fee`,
  confirmShippingFee: (id: string) => `/orders/${id}/shipping-fee/confirm`,
  ship: (id: string) => `/orders/${id}/ship`,
  complete: (id: string) => `/orders/${id}/complete`,
} as const

const admin = {
  reviews: "/admin/reviews",
  approve: (id: string) => `/admin/reviews/${id}/approve`,
  reject: (id: string) => `/admin/reviews/${id}/reject`,
  listings: "/admin/listings",
  forceDelist: (id: string) => `/admin/listings/${id}`,
  orders: "/admin/orders",
} as const

export const endpoints = { auth, listings, storage, orders, admin } as const
