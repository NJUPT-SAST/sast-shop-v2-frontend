import Image from "next/image";
import { cn } from "@workspace/ui/lib/utils";
import errand from "../public/brand/errand.webp";
import errandCompact from "../public/brand/errand-compact.webp";
import template from "../public/brand/template.webp";
import templateCompact from "../public/brand/template-compact.webp";
import transactionAgreement from "../public/brand/transaction-agreement.webp";
import transactionAgreementCompact from "../public/brand/transaction-agreement-compact.webp";
import feishuRequired from "../public/brand/feishu-required.webp";
import feishuRequiredCompact from "../public/brand/feishu-required-compact.webp";
import login from "../public/brand/login.webp";
import loginCompact from "../public/brand/login-compact.webp";
import manual from "../public/brand/manual.webp";
import manualCompact from "../public/brand/manual-compact.webp";
import scan from "../public/brand/scan.webp";
import scanCompact from "../public/brand/scan-compact.webp";
import address from "../public/brand/address.webp";
import addressCompact from "../public/brand/address-compact.webp";
import collection from "../public/brand/collection.webp";
import collectionCompact from "../public/brand/collection-compact.webp";
import wallet from "../public/brand/wallet.webp";
import walletCompact from "../public/brand/wallet-compact.webp";
import help from "../public/brand/help.webp";
import helpCompact from "../public/brand/help-compact.webp";
import orders from "../public/brand/orders.webp";
import ordersCompact from "../public/brand/orders-compact.webp";
import store from "../public/brand/store.webp";
import storeCompact from "../public/brand/store-compact.webp";
import spotEmpty from "../public/brand/spot-empty.webp";
import spotEmptyCompact from "../public/brand/spot-empty-compact.webp";
import searchEmpty from "../public/brand/search-empty.webp";
import searchEmptyCompact from "../public/brand/search-empty-compact.webp";
import cartEmpty from "../public/brand/cart-empty.webp";
import cartEmptyCompact from "../public/brand/cart-empty-compact.webp";

import loadError from "../public/brand/load-error.webp";
import loadErrorCompact from "../public/brand/load-error-compact.webp";
import barcodeEmpty from "../public/brand/barcode-empty.webp";
import barcodeEmptyCompact from "../public/brand/barcode-empty-compact.webp";

const illustrations = {
  "load-error": { regular: loadError, compact: loadErrorCompact },
  "barcode-empty": { regular: barcodeEmpty, compact: barcodeEmptyCompact },
  "spot-empty": { regular: spotEmpty, compact: spotEmptyCompact },
  "search-empty": { regular: searchEmpty, compact: searchEmptyCompact },
  "cart-empty": { regular: cartEmpty, compact: cartEmptyCompact },
  errand: { regular: errand, compact: errandCompact },
  template: { regular: template, compact: templateCompact },
  "transaction-agreement": {
    regular: transactionAgreement,
    compact: transactionAgreementCompact,
  },
  "feishu-required": {
    regular: feishuRequired,
    compact: feishuRequiredCompact,
  },
  login: { regular: login, compact: loginCompact },
  manual: { regular: manual, compact: manualCompact },
  scan: { regular: scan, compact: scanCompact },
  address: { regular: address, compact: addressCompact },
  collection: { regular: collection, compact: collectionCompact },
  wallet: { regular: wallet, compact: walletCompact },
  help: { regular: help, compact: helpCompact },
  orders: { regular: orders, compact: ordersCompact },
  store: { regular: store, compact: storeCompact },
};

type BrandElement = keyof typeof illustrations;

export function BrandIllustration({
  name,
  size = 48,
  className,
}: {
  name: BrandElement;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={illustrations[name][size <= 64 ? "compact" : "regular"]}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      unoptimized
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
