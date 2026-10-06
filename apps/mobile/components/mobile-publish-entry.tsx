"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { RiAddLine } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/utils";
import { useFeishuUiEnvironment } from "@/hooks/use-feishu-ui-environment";
import { normalizeBarcodeQuery } from "@/lib/product-template-flow";
import { waitForDrawerHistoryCleanup } from "@workspace/ui/lib/drawer-history";
import { BrandIllustration } from "./brand-illustration";

export function MobilePublishEntry() {
  const router = useRouter();
  const showFeishuEntry = useFeishuUiEnvironment();
  const [publishStep, setPublishStep] = useState<"entry" | "barcode" | null>(
    null,
  );
  const [barcode, setBarcode] = useState("");
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  function openBarcodeEntry() {
    setBarcode("");
    setBarcodeError(null);
    setPublishStep("barcode");
  }

  async function handleBarcodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = normalizeBarcodeQuery(barcode);
    if (!result.ok) {
      setBarcodeError(result.message);
      barcodeRef.current?.focus();
      return;
    }

    setPublishStep(null);
    await waitForDrawerHistoryCleanup();
    router.push(
      `/publish/spot?entry=manual&barcode=${encodeURIComponent(result.barcode)}`,
    );
  }

  return (
    <>
      <Drawer
        open={publishStep === "entry"}
        autoFocus
        onOpenChange={(open) => {
          setPublishStep((step) =>
            open ? "entry" : step === "entry" ? null : step,
          );
        }}
      >
        <DrawerTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            size="icon-touch"
            className="-mt-8 size-14 rounded-full shadow-xl shadow-foreground/15 ring-1 ring-border/60"
            aria-label="上架现货"
          >
            <RiAddLine className="size-6" aria-hidden="true" />
          </Button>
        </DrawerTrigger>
        <DrawerContent
          onCloseAutoFocus={(event) => {
            if (publishStep === "barcode") event.preventDefault();
          }}
        >
          <DrawerHeader>
            <DrawerTitle>上架现货</DrawerTitle>
            <DrawerDescription className="sr-only">
              选择商品条码录入方式
            </DrawerDescription>
          </DrawerHeader>
          <div
            className={cn(
              "grid gap-3 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))]",
              showFeishuEntry ? "grid-cols-2" : "grid-cols-1",
            )}
          >
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-24 flex-col gap-2 rounded-xl bg-card shadow-sm"
              onClick={openBarcodeEntry}
            >
              <BrandIllustration name="manual" size={48} />
              手动输入
            </Button>
            {showFeishuEntry ? (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="h-24 flex-col gap-2 rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm hover:bg-primary/15"
                onClick={async () => {
                  setPublishStep(null);
                  await waitForDrawerHistoryCleanup();
                  router.push("/publish/spot?entry=scan");
                }}
              >
                <BrandIllustration name="scan" size={48} />
                扫码录入
              </Button>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={publishStep === "barcode"}
        autoFocus
        onOpenChange={(open) => {
          if (!open) {
            setPublishStep((step) => (step === "barcode" ? null : step));
          }
        }}
      >
        <DrawerContent
          className="overflow-clip"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (publishStep === null) {
              triggerRef.current?.focus({ preventScroll: true });
            }
          }}
        >
          <DrawerHeader>
            <DrawerTitle>输入商品条码</DrawerTitle>
            <DrawerDescription className="sr-only">
              输入商品包装上的条码，继续填写商品信息。
            </DrawerDescription>
          </DrawerHeader>
          <form
            onSubmit={handleBarcodeSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <FieldGroup className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-4">
              <Field data-invalid={Boolean(barcodeError)}>
                <FieldLabel htmlFor="publish-entry-barcode">
                  商品条码
                </FieldLabel>
                <Input
                  ref={barcodeRef}
                  id="publish-entry-barcode"
                  value={barcode}
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={64}
                  placeholder="输入商品包装上的条码"
                  aria-invalid={Boolean(barcodeError)}
                  aria-describedby={
                    barcodeError ? "publish-entry-error" : undefined
                  }
                  onChange={(event) => {
                    setBarcode(event.target.value);
                    setBarcodeError(null);
                  }}
                />
                {barcodeError ? (
                  <FieldError id="publish-entry-error">
                    {barcodeError}
                  </FieldError>
                ) : null}
              </Field>
            </FieldGroup>
            <DrawerFooter>
              <Button type="submit">继续填写商品信息</Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}
