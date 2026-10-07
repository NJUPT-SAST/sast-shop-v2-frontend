"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { RiArrowRightSLine } from "@remixicon/react";
import { isLarkClientEnvironment } from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { Separator } from "@workspace/ui/components/separator";
import { BrandIllustration } from "./brand-illustration";
import { ListedGoodsIcon } from "./listed-goods-icon";
import { useProfileDialogs } from "./profile-dialogs-provider";
import { useTransactionAgreement } from "./transaction-agreement-provider";

export function ProfileManagementClient({
  feedbackFormUrl,
}: {
  feedbackFormUrl: string | null;
}) {
  const { openAddressDialog, openPaymentPreferenceDialog, openQrCodeDialog } =
    useProfileDialogs();
  const { openAgreement } = useTransactionAgreement();

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div role="group" aria-label="个人资料">
        <ProfileMenuButton
          title="地址簿"
          icon={<BrandIllustration name="address" size={32} />}
          onClick={openAddressDialog}
        />
        <ProfileNavigationLink
          title="人脸录入"
          icon={<BrandIllustration name="face" size={32} />}
          href="/profile/face"
        />
      </div>
      <Separator className="my-1" />
      <div role="group" aria-label="支付与收款">
        <ProfileMenuButton
          title="默认支付方式"
          icon={<BrandIllustration name="wallet" size={32} />}
          onClick={openPaymentPreferenceDialog}
        />
        <ProfileMenuButton
          title="收款码"
          icon={<BrandIllustration name="collection" size={32} />}
          onClick={openQrCodeDialog}
        />
      </div>
      <Separator className="my-1" />
      <div role="group" aria-label="商品管理">
        <ProfileNavigationLink
          title="我上架的商品"
          icon={<ListedGoodsIcon />}
          href="/profile/goods"
        />
      </div>
      <Separator className="my-1" />
      <div role="group" aria-label="协议与帮助">
        <ProfileMenuButton
          title="交易协议"
          icon={<BrandIllustration name="transaction-agreement" size={32} />}
          onClick={openAgreement}
        />
        {feedbackFormUrl ? (
          <ProfileMenuLink
            title="帮助与反馈"
            icon={<BrandIllustration name="help" size={32} />}
            href={feedbackFormUrl}
          />
        ) : null}
      </div>
    </div>
  );
}

function ProfileNavigationLink({
  title,
  icon,
  href,
}: {
  title: string;
  icon: ReactNode;
  href: string;
}) {
  return (
    <Button
      variant="ghost"
      size="lg"
      className="h-auto min-h-16 w-full justify-start gap-4 rounded-none px-4 py-3"
      asChild
    >
      <Link href={href}>
        <span className="flex size-10 shrink-0 items-center justify-center">
          {icon}
        </span>
        <span className="flex-1 text-left font-medium">{title}</span>
        <RiArrowRightSLine className="size-5 text-muted-foreground" />
      </Link>
    </Button>
  );
}

function ProfileMenuLink({
  title,
  icon,
  href,
}: {
  title: string;
  icon: ReactNode;
  href: string;
}) {
  return (
    <Button
      variant="ghost"
      size="lg"
      className="h-auto min-h-16 w-full justify-start gap-4 rounded-none px-4 py-3"
      asChild
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => {
          if (!isLarkClientEnvironment(window.h5sdk)) return;
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
          event.preventDefault();
          window.location.assign(
            `https://applink.feishu.cn/client/web_url/open?mode=window&url=${encodeURIComponent(href)}`,
          );
        }}
      >
        <span className="flex size-10 shrink-0 items-center justify-center">
          {icon}
        </span>
        <span className="flex-1 text-left font-medium">{title}</span>
        <RiArrowRightSLine className="size-5 text-muted-foreground" />
      </a>
    </Button>
  );
}

function ProfileMenuButton({
  title,
  icon,
  onClick,
}: {
  title: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="lg"
      className="h-auto min-h-16 w-full justify-start gap-4 rounded-none px-4 py-3"
      onClick={onClick}
    >
      <span className="flex size-10 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="flex-1 text-left font-medium">{title}</span>
      <RiArrowRightSLine className="size-5 text-muted-foreground" />
    </Button>
  );
}
