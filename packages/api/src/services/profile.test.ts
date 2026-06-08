import { describe, expect, expectTypeOf, it } from "vitest"
import type { CurrentUser } from "./auth"
import type { ShippingAddress } from "./addresses"
import type { PaymentQrCode } from "./payment-qr-codes"
import { getProfileOverview, type ProfileOverview } from "./profile"

describe("profile service", () => {
  it("exposes stable profile overview return types", () => {
    expectTypeOf(getProfileOverview()).toEqualTypeOf<Promise<ProfileOverview>>()
    expectTypeOf<ProfileOverview>().toEqualTypeOf<{
      user: CurrentUser
      addresses: ShippingAddress[]
      defaultAddress: ShippingAddress | null
      paymentQrCodes: PaymentQrCode[]
    }>()
  })

  it("composes mock profile overview in mock mode", async () => {
    const overview = await getProfileOverview({ dataSource: "mock" })

    expect(overview.user.name).toBe("南邮同学")
    expect(overview.defaultAddress?.id).toBe("1001")
    expect(overview.addresses).toHaveLength(2)
    expect(overview.paymentQrCodes.map((qrCode) => qrCode.channel)).toEqual([
      "wechat",
      "alipay",
    ])
  })
})
