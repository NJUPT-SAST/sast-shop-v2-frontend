"use client";

import { RiQuestionLine } from "@remixicon/react";

import { Button } from "#components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "#components/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "#components/popover";
import { TextHighlight } from "#components/text-highlight";

function PaymentCodeHelpText() {
  return (
    <>
      <p>
        付款时将此标识码
        <TextHighlight>填写到微信或支付宝的付款备注</TextHighlight>
        ，帮助收款人核对订单。
      </p>
      <p>
        <TextHighlight>已备注通常无需流水号</TextHighlight>
        。忘记备注时，可从支付账单查找交易单号或流水号并补充，协助核款；
        <TextHighlight>补充不代表自动到账确认</TextHighlight>。
      </p>
    </>
  );
}

function PaymentCodeHelp({
  presentation = "popover",
}: {
  presentation?: "drawer" | "popover";
}) {
  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="size-6 text-muted-foreground"
      aria-label="付款标识码说明"
    >
      <RiQuestionLine className="size-4" aria-hidden="true" />
    </Button>
  );

  if (presentation === "drawer") {
    return (
      <Drawer>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="overflow-clip">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>付款标识码说明</DrawerTitle>
            <DrawerDescription className="sr-only">
              了解付款备注与补充流水号的用途
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 space-y-3 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-sm leading-6 text-foreground">
            <PaymentCodeHelpText />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="space-y-2 leading-6">
        <PaymentCodeHelpText />
      </PopoverContent>
    </Popover>
  );
}

export { PaymentCodeHelp };
