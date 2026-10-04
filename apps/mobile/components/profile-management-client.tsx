"use client";

import type { ReactNode } from "react";
import { RiArrowRightSLine } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { BrandIllustration } from "./brand-illustration";
import { useProfileDialogs } from "./profile-dialogs-provider";

export function ProfileManagementClient({
  feedbackFormUrl,
}: {
  feedbackFormUrl: string | null;
}) {
  const { openAddressDialog, openPaymentPreferenceDialog, openQrCodeDialog } =
    useProfileDialogs();

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <ProfileMenuButton
        title="地址簿"
        icon={<BrandIllustration name="address" size={40} />}
        onClick={openAddressDialog}
        border
        first
      />
      <ProfileMenuButton
        title="收款码"
        icon={<BrandIllustration name="collection" size={40} />}
        onClick={openQrCodeDialog}
        border
      />
      <ProfileMenuButton
        title="默认支付方式"
        icon={<BrandIllustration name="wallet" size={40} />}
        onClick={openPaymentPreferenceDialog}
        border={Boolean(feedbackFormUrl)}
        last={!feedbackFormUrl}
      />
      {feedbackFormUrl ? (
        <ProfileMenuLink
          title="帮助与反馈"
          icon={<BrandIllustration name="help" size={40} />}
          href={feedbackFormUrl}
        />
      ) : null}
    </div>
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
      className="h-auto min-h-16 w-full justify-start gap-4 rounded-t-none rounded-b-xl px-4 py-3"
      asChild
    >
      <a href={href} target="_blank" rel="noopener noreferrer">
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
  border = false,
  first = false,
  last = false,
}: {
  title: string;
  icon: ReactNode;
  onClick: () => void;
  border?: boolean;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="lg"
      className={cn(
        "h-auto min-h-16 w-full justify-start gap-4 px-4 py-3",
        first && "rounded-t-xl rounded-b-none",
        last && "rounded-t-none rounded-b-xl",
        border && "border-b",
      )}
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
