"use client";

import Image from "next/image";
import {
  RiBarcodeLine,
  RiBillLine,
  RiCameraLine,
  RiChat3Line,
  RiEditLine,
  RiFileList3Line,
  RiImageLine,
  RiLoginBoxLine,
  RiMapPinLine,
  RiMoneyCnyCircleLine,
  RiPriceTag3Line,
  RiQrScanLine,
  RiQuestionLine,
  RiRefreshLine,
  RiSearchLine,
  RiShoppingBagLine,
  RiShoppingCartLine,
  RiStore2Line,
  RiTruckLine,
  RiUserSmileLine,
  RiWallet3Line,
} from "@remixicon/react";
import { IllustrationFrame } from "@workspace/ui/components/illustration-frame";
import errand from "../public/brand/errand.webp";
import errandCompact from "../public/brand/errand-compact.webp";
import errandEmpty from "../public/brand/errand-empty.webp";
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
import face from "../public/brand/face.webp";
import faceCompact from "../public/brand/face-compact.webp";
import pocket from "../public/brand/pocket.webp";
import pocketCompact from "../public/brand/pocket-compact.webp";
import faceEmpty from "../public/brand/face-empty.webp";
import faceEmptyCompact from "../public/brand/face-empty-compact.webp";
import faceActive from "../public/brand/face-active.webp";
import faceActiveCompact from "../public/brand/face-active-compact.webp";
import faceInactive from "../public/brand/face-inactive.webp";
import faceInactiveCompact from "../public/brand/face-inactive-compact.webp";
import camera from "../public/brand/camera.webp";
import cameraCompact from "../public/brand/camera-compact.webp";
import photoAlbum from "../public/brand/photo-album.webp";
import photoAlbumCompact from "../public/brand/photo-album-compact.webp";

const illustrations = {
  camera: { regular: camera, compact: cameraCompact },
  "photo-album": { regular: photoAlbum, compact: photoAlbumCompact },
  "face-empty": { regular: faceEmpty, compact: faceEmptyCompact },
  "face-active": { regular: faceActive, compact: faceActiveCompact },
  "face-inactive": { regular: faceInactive, compact: faceInactiveCompact },
  face: { regular: face, compact: faceCompact },
  pocket: { regular: pocket, compact: pocketCompact },
  "load-error": { regular: loadError, compact: loadErrorCompact },
  "barcode-empty": { regular: barcodeEmpty, compact: barcodeEmptyCompact },
  "spot-empty": { regular: spotEmpty, compact: spotEmptyCompact },
  "search-empty": { regular: searchEmpty, compact: searchEmptyCompact },
  "cart-empty": { regular: cartEmpty, compact: cartEmptyCompact },
  errand: { regular: errand, compact: errandCompact },
  "errand-empty": { regular: errandEmpty, compact: errandEmpty },
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

const fallbackIcons = {
  "load-error": RiRefreshLine,
  "barcode-empty": RiBarcodeLine,
  "spot-empty": RiShoppingBagLine,
  "search-empty": RiSearchLine,
  "cart-empty": RiShoppingCartLine,
  errand: RiTruckLine,
  "errand-empty": RiTruckLine,
  template: RiPriceTag3Line,
  "transaction-agreement": RiFileList3Line,
  "feishu-required": RiChat3Line,
  login: RiLoginBoxLine,
  manual: RiEditLine,
  scan: RiQrScanLine,
  address: RiMapPinLine,
  collection: RiMoneyCnyCircleLine,
  wallet: RiWallet3Line,
  help: RiQuestionLine,
  orders: RiBillLine,
  store: RiStore2Line,
  camera: RiCameraLine,
  "photo-album": RiImageLine,
  "face-empty": RiUserSmileLine,
  "face-active": RiUserSmileLine,
  "face-inactive": RiUserSmileLine,
  face: RiUserSmileLine,
  pocket: RiWallet3Line,
} satisfies Record<BrandElement, typeof RiWallet3Line>;

export function BrandIllustration({
  name,
  size = 48,
  className,
}: {
  name: BrandElement;
  size?: number;
  className?: string;
}) {
  const image = illustrations[name][size <= 64 ? "compact" : "regular"];
  const FallbackIcon = fallbackIcons[name];
  return (
    <IllustrationFrame
      src={image.src}
      size={size}
      className={className}
      fallback={<FallbackIcon aria-hidden="true" />}
      renderImage={(imageProps) => (
        <Image
          {...imageProps}
          src={image}
          width={size}
          height={size}
          alt=""
          aria-hidden="true"
          unoptimized
        />
      )}
    />
  );
}
