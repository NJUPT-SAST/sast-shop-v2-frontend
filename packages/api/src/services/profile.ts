import type { ServiceOptions } from "../data-source";
import { getCurrentUser, type CurrentUser } from "./auth";
import { listAddresses, type ShippingAddress } from "./addresses";
import { listPaymentQrCodes, type PaymentQrCode } from "./payment-qr-codes";

export interface ProfileOverview {
  user: CurrentUser;
  addresses: ShippingAddress[];
  defaultAddress: ShippingAddress | null;
  paymentQrCodes: PaymentQrCode[];
}

export async function getProfileOverview(
  options: ServiceOptions = {},
): Promise<ProfileOverview> {
  const [user, addresses, paymentQrCodes] = await Promise.all([
    getCurrentUser(options),
    listAddresses(options),
    listPaymentQrCodes(options),
  ]);

  return {
    user,
    addresses,
    defaultAddress: addresses.find((address) => address.isDefault) ?? null,
    paymentQrCodes,
  };
}
