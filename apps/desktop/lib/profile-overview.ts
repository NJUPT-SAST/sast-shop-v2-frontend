import {
  getCurrentUser,
  listAddresses,
  listPaymentQrCodes,
  type ProfileOverview,
  type ServiceOptions,
} from "@sast-shop/api";

export async function loadDesktopProfileOverview(options: ServiceOptions) {
  const [user, addresses, qrCodes] = await Promise.allSettled([
    getCurrentUser(options),
    listAddresses(options),
    listPaymentQrCodes(options),
  ]);
  const savedAddresses =
    addresses.status === "fulfilled" ? addresses.value : [];
  const overview: ProfileOverview | null =
    user.status === "fulfilled"
      ? {
          user: user.value,
          addresses: savedAddresses,
          defaultAddress:
            savedAddresses.find((address) => address.isDefault) ?? null,
          paymentQrCodes: qrCodes.status === "fulfilled" ? qrCodes.value : [],
        }
      : null;
  return {
    overview,
    error: user.status === "rejected" ? "个人资料暂不可用，请稍后再试" : null,
    addressError:
      addresses.status === "rejected" ? "地址簿加载失败，请重试" : null,
    qrError: qrCodes.status === "rejected" ? "收款码加载失败，请重试" : null,
  };
}
