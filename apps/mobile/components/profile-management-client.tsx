"use client";

import type { ReactNode } from "react";
import {
  RiArrowRightSLine,
  RiMapPinLine,
  RiQrCodeLine,
  RiWallet3Line,
} from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { useProfileDialogs } from "./profile-dialogs-provider";

export function ProfileManagementClient() {
  const { openAddressDialog, openPaymentPreferenceDialog, openQrCodeDialog } =
    useProfileDialogs();

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <ProfileMenuButton
        title="地址簿"
        icon={<RiMapPinLine className="size-4" />}
        onClick={openAddressDialog}
        border
        first
      />
      <ProfileMenuButton
        title="收款码"
        icon={<RiQrCodeLine className="size-4" />}
        onClick={openQrCodeDialog}
        border
      />
      <ProfileMenuButton
        title="默认支付方式"
        icon={<RiWallet3Line className="size-4" />}
        onClick={openPaymentPreferenceDialog}
        last
      />
    </div>
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
        "h-auto min-h-16 w-full justify-start gap-4 px-4 py-3.5",
        first && "rounded-t-xl rounded-b-none",
        last && "rounded-t-none rounded-b-xl",
        border && "border-b",
      )}
      onClick={onClick}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <span className="flex-1 text-left font-medium">{title}</span>
      <RiArrowRightSLine className="size-5 text-muted-foreground" />
    </Button>
  );
}
