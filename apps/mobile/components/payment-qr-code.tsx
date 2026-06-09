import type { CSSProperties } from "react";
import {
  RiAlipayFill,
  RiWechatPayFill,
  type RemixiconComponentType,
} from "@remixicon/react";
import type { PaymentPlatform } from "@sast-shop/domain";
import { QRCodeSVG } from "qrcode.react";

import { cn } from "@workspace/ui/lib/utils";

export interface PaymentQrCodeProps {
  content: string;
  channel: PaymentPlatform;
  className?: string;
  size?: number;
}

const PAYMENT_LOGO_META: Record<
  PaymentPlatform,
  {
    label: string;
    icon: RemixiconComponentType;
    className: string;
  }
> = {
  wechat: {
    label: "微信支付收款码",
    icon: RiWechatPayFill,
    className: "text-[#07c160] ring-[#07c160]/15",
  },
  alipay: {
    label: "支付宝收款码",
    icon: RiAlipayFill,
    className: "text-[#1677ff] ring-[#1677ff]/15",
  },
};

export function PaymentQrCode({
  content,
  channel,
  className,
  size = 184,
}: PaymentQrCodeProps) {
  const logoSize = Math.max(22, Math.round(size * 0.2));
  const logoIconSize = Math.max(14, Math.round(logoSize * 0.62));
  const logo = PAYMENT_LOGO_META[channel];
  const Icon = logo.icon;
  const qrStyle = {
    "--payment-qr-size": `${size}px`,
    "--payment-qr-logo-size": `${logoSize}px`,
    "--payment-qr-logo-icon-size": `${logoIconSize}px`,
  } as CSSProperties;

  return (
    <div
      className={cn(
        "relative flex aspect-square w-[var(--payment-qr-size)] max-w-full items-center justify-center overflow-hidden rounded-lg bg-white p-2 shadow-sm ring-1 ring-border",
        className,
      )}
      style={qrStyle}
    >
      <QRCodeSVG
        value={content}
        size={size}
        level="H"
        marginSize={2}
        title={logo.label}
        className="size-full"
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-1/2 top-1/2 flex size-[var(--payment-qr-logo-size)] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md bg-white shadow-sm ring-1",
          logo.className,
        )}
      >
        <Icon className="size-[var(--payment-qr-logo-icon-size)]" />
      </span>
    </div>
  );
}
