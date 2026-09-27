"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPocket } from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Spinner } from "@workspace/ui/components/spinner";
import { parsePocketAmount } from "@/lib/west-pocket";
import {
  PocketError,
  PocketHeading,
  usePocketAction,
  usePocketOptions,
} from "./shared";

export function PocketCreate() {
  const options = usePocketOptions();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [created, setCreated] = useState(false);
  const { busy, error, run } = usePocketAction();
  function submit(event: FormEvent) {
    event.preventDefault();
    if (created) return;
    void run(`create:${title}:${amount}`, async (requestId) => {
      const pocket = await createPocket(
        {
          title: title.trim(),
          totalCents: parsePocketAmount(amount),
          requestId,
        },
        options,
      );
      setCreated(true);
      router.replace(`/west-pocket/${pocket.id}/capture`);
    });
  }
  return (
    <div className="space-y-6 py-6">
      <PocketHeading
        title="West Pocket"
        description="一起吃饭，合照选人，轻松 AA。"
      />
      <form onSubmit={submit} className="space-y-6">
        <div className="space-y-3 rounded-xl border bg-card p-5">
          <Label htmlFor="pocket-total">本次付款总金额（元）</Label>
          <Input
            id="pocket-total"
            inputMode="decimal"
            placeholder="0.00"
            required
            autoFocus
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={busy || created}
            className="h-16 text-3xl font-semibold tabular-nums md:text-3xl"
          />
          <p className="text-xs leading-5 text-muted-foreground">
            饭前可以先填写预计金额，发起收款前再修改。
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pocket-title">聚餐名称（选填）</Label>
          <Input
            id="pocket-title"
            placeholder="例如：周五晚饭"
            value={title}
            maxLength={100}
            onChange={(event) => setTitle(event.target.value)}
            disabled={busy || created}
          />
        </div>
        <PocketError message={error} />
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={busy || created}
        >
          {busy ? <Spinner /> : null}下一步 · 拍合照
        </Button>
      </form>
      <Button asChild variant="ghost" className="w-full">
        <Link href="/west-pocket">查看我的 AA 活动</Link>
      </Button>
      <p className="text-xs leading-6 text-muted-foreground">
        使用微信个人收款码收款；付款后由收款人核对到账。不方便拍照时也能直接搜索姓名选人。
      </p>
    </div>
  );
}
