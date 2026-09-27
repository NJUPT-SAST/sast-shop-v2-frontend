"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import {
  cancelPocket,
  confirmBill,
  getBill,
  getPocket,
  remindPocketMembers,
  rejectPocketPayment,
  retryPocketJob,
  updatePocket,
  type PocketMember,
  type WestPocket,
} from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer";
import {
  parsePocketAmount,
  pocketMoney,
  pocketPaymentLabel,
  pocketStatusLabel,
} from "@/lib/west-pocket";
import { PocketAlbum } from "./pocket-album";
import { PocketMembersDrawer } from "./members-drawer";
import {
  PocketConsent,
  PocketError,
  PocketHeading,
  PocketJobProgress,
  PocketLoading,
  PocketPerson,
  usePocketAction,
  usePocketOptions,
  usePocketPolling,
  usePocketResource,
} from "./shared";

export function PocketDetailPage({ pocketId }: { pocketId: string }) {
  const options = usePocketOptions();
  const result = usePocketResource(
    useCallback(() => getPocket(pocketId, options), [pocketId, options]),
  );
  const action = usePocketAction();
  const [membersOpen, setMembersOpen] = useState(false);
  const [confirming, setConfirming] = useState<PocketMember | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const detail = result.data;
  usePocketPolling(
    result.refresh,
    Boolean(
      detail &&
      ["publishing", "collecting", "cancelling"].includes(detail.pocket.status),
    ),
  );
  if (!detail)
    return (
      <div className="space-y-5 py-6">
        <PocketHeading title="AA 活动" />
        <PocketError message={result.error} retry={result.refresh} />
        {!result.error ? <PocketLoading /> : null}
      </div>
    );
  const { pocket, isOwner, members, jobs, notifications } = detail;
  const draft = pocket.status === "draft";
  const completed = members.filter(
    (member) => !member.isOwner && member.billStatus === "completed",
  );
  const unpaid = members.filter(
    (member) => !member.isOwner && member.billStatus === "unpaid",
  );
  const hasPayment = members.some((member) =>
    ["submitted", "completed"].includes(member.billStatus),
  );
  const canCancel =
    isOwner &&
    ["draft", "publishing", "collecting"].includes(pocket.status) &&
    !hasPayment;
  const failedMessages = notifications.filter((item) =>
    ["failed", "pending", "retrying"].includes(item.status),
  );
  return (
    <div className="space-y-5 py-6">
      <PocketHeading
        title={pocket.title || "聚餐 AA"}
        action={
          <Badge variant="outline" className="shrink-0">
            {pocketStatusLabel(pocket.status)}
          </Badge>
        }
      />
      <PocketError
        message={result.error || action.error}
        retry={result.refresh}
      />
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">聚餐总金额</p>
        <p className="text-3xl font-semibold tabular-nums">
          {pocketMoney(pocket.totalCents)}
        </p>
        <div className="flex justify-between text-sm">
          <span>{pocket.participantCount} 人分摊</span>
          <span>收款人：{pocket.owner.name}</span>
        </div>
        {isOwner && !draft ? (
          <dl className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
            <dt className="text-muted-foreground">自己承担</dt>
            <dd className="text-right tabular-nums">
              {pocketMoney(pocket.ownerShareCents)}
            </dd>
            <dt className="text-muted-foreground">应收合计</dt>
            <dd className="text-right tabular-nums">
              {pocketMoney(pocket.receivableCents)}
            </dd>
            <dt className="text-muted-foreground">已确认到账</dt>
            <dd className="text-right tabular-nums">
              {pocketMoney(
                completed.reduce((sum, member) => sum + member.shareCents, 0),
              )}
            </dd>
          </dl>
        ) : null}
      </section>
      {draft && isOwner ? (
        <>
          <DraftPocketForm
            key={pocket.revision}
            pocket={pocket}
            onSaved={result.refresh}
          />
          <div className="grid grid-cols-2 gap-3">
            <Button asChild variant="outline">
              <Link href={`/west-pocket/${pocketId}/capture`}>拍照 / 补拍</Link>
            </Button>
            <Button onClick={() => setMembersOpen(true)}>选择分摊人</Button>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            草稿仅你可见。保存照片和名单后，可以在饭后修改总金额再发起。
          </p>
        </>
      ) : null}
      {!isOwner && ["collecting", "settled"].includes(pocket.status) ? (
        <Button asChild className="w-full" size="lg">
          <Link href={`/west-pocket/${pocketId}/pay`}>查看我的账单</Link>
        </Button>
      ) : null}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">{isOwner ? "收款清单" : "我的分摊"}</h2>
          <Button size="sm" variant="ghost" onClick={result.refresh}>
            刷新
          </Button>
        </div>
        <div className="divide-y rounded-xl border bg-card px-4">
          {members.map((member) => (
            <PocketPerson
              key={member.userId}
              user={member.user}
              detail={
                member.isOwner
                  ? "收款人自身份额"
                  : draft
                    ? "名单待确认"
                    : pocketPaymentLabel(member.billStatus)
              }
              action={
                <div className="shrink-0 space-y-2 text-right">
                  <p className="font-semibold tabular-nums">
                    {draft ? "待分摊" : pocketMoney(member.shareCents)}
                  </p>
                  {isOwner &&
                  pocket.status === "collecting" &&
                  member.billStatus === "submitted" &&
                  member.paymentBillId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={action.busy}
                      onClick={() => setConfirming(member)}
                    >
                      核对到账
                    </Button>
                  ) : null}
                </div>
              }
            />
          ))}
        </div>
      </section>
      {jobs
        .filter(
          (job) => job.status !== "succeeded" && job.status !== "completed",
        )
        .map((job) => (
          <PocketJobProgress
            key={job.id}
            job={job}
            busy={action.busy}
            retry={() =>
              void action.run(`retry:${job.id}`, async (requestId) => {
                await retryPocketJob({ jobId: job.id, requestId }, options);
                result.refresh();
              })
            }
          />
        ))}
      {isOwner && notifications.length > 0 ? (
        <p className="rounded-lg bg-muted p-3 text-sm leading-6">
          飞书通知：
          {notifications.filter((item) => item.status === "sent").length} /{" "}
          {notifications.length} 条已送达。
          {failedMessages.length
            ? "部分消息仍待发送，系统会继续尝试；也可提醒待付款成员。"
            : "每位分摊人收到自己的账单，你收到收款汇总。"}
        </p>
      ) : null}
      {isOwner && pocket.status === "collecting" ? (
        <>
          <Button
            variant="outline"
            className="w-full"
            disabled={action.busy || !unpaid.length}
            onClick={() =>
              void action.run(
                `remind:${unpaid.map((member) => member.id).join(",")}`,
                async (requestId) => {
                  await remindPocketMembers(
                    {
                      pocketId,
                      memberIds: unpaid.map((member) => member.id),
                      requestId,
                    },
                    options,
                  );
                  result.refresh();
                },
              )
            }
          >
            提醒 {unpaid.length} 位待付款成员
          </Button>
          {hasPayment ? (
            <p className="text-xs text-muted-foreground">
              已有成员付款或标记付款，活动不能直接取消。
            </p>
          ) : null}
        </>
      ) : null}
      {!draft && pocket.status !== "cancelled" ? (
        <PocketAlbum
          pocketId={pocketId}
          isOwner={isOwner}
          ownerParticipates={members.some((member) => member.isOwner)}
          initiallyAccepted={
            (isOwner ? members.find((member) => member.isOwner) : members[0])
              ?.albumAccess === "accepted"
          }
        />
      ) : null}
      {canCancel ? (
        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          disabled={action.busy}
          onClick={() => setCancelOpen(true)}
        >
          取消本次 AA
        </Button>
      ) : null}
      {pocket.status === "cancelled" ? (
        <p className="rounded-lg bg-muted p-4 text-sm leading-6">
          活动已取消，应用内账单已关闭。取消不会撤回已发生的线下转账。
          {pocket.cancelReason ? `取消原因：${pocket.cancelReason}` : ""}
        </p>
      ) : null}
      <Button asChild variant="ghost" className="w-full">
        <Link href="/west-pocket">我的 AA 活动</Link>
      </Button>
      {membersOpen ? (
        <PocketMembersDrawer
          detail={detail}
          onClose={() => setMembersOpen(false)}
          onChanged={result.refresh}
        />
      ) : null}
      {confirming?.paymentBillId ? (
        <ConfirmPocketPayment
          billId={confirming.paymentBillId}
          onClose={() => setConfirming(null)}
          onConfirmed={result.refresh}
        />
      ) : null}
      <Drawer
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        dismissible={!action.busy}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>取消本次 AA</DrawerTitle>
            <DrawerDescription>
              取消后关闭收款请求和提醒，不会撤回线下转账。请先核实没有同学已转账但尚未标记付款。
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 px-4">
            <Textarea
              placeholder="取消原因（选填）"
              aria-label="取消原因"
              value={cancelReason}
              maxLength={500}
              onChange={(event) => setCancelReason(event.target.value)}
            />
            <PocketError message={action.error} />
          </div>
          <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button
              variant="destructive"
              disabled={action.busy || !canCancel}
              onClick={() =>
                void action.run(
                  `cancel:${pocket.revision}:${cancelReason}`,
                  async (requestId) => {
                    await cancelPocket(
                      {
                        pocketId,
                        expectedRevision: pocket.revision,
                        reason: cancelReason,
                        requestId,
                      },
                      options,
                    );
                    setCancelOpen(false);
                    result.refresh();
                  },
                )
              }
            >
              确认取消
            </Button>
            <Button
              variant="outline"
              disabled={action.busy}
              onClick={() => setCancelOpen(false)}
            >
              继续保留
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function DraftPocketForm({
  pocket,
  onSaved,
}: {
  pocket: WestPocket;
  onSaved: () => void;
}) {
  const options = usePocketOptions();
  const action = usePocketAction();
  const [title, setTitle] = useState(pocket.title);
  const [amount, setAmount] = useState((pocket.totalCents / 100).toFixed(2));
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void action.run(
          `update:${pocket.revision}:${title}:${amount}`,
          async (requestId) => {
            await updatePocket(
              {
                pocketId: pocket.id,
                expectedRevision: pocket.revision,
                title: title.trim(),
                totalCents: parsePocketAmount(amount),
                requestId,
              },
              options,
            );
            onSaved();
          },
        );
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="draft-title">聚餐名称</Label>
        <Input
          id="draft-title"
          value={title}
          maxLength={100}
          onChange={(event) => setTitle(event.target.value)}
          disabled={action.busy}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="draft-amount">总金额（元）</Label>
        <Input
          id="draft-amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          disabled={action.busy}
        />
      </div>
      <PocketError message={action.error} />
      <Button
        type="submit"
        className="w-full"
        variant="outline"
        disabled={action.busy}
      >
        保存金额与名称
      </Button>
    </form>
  );
}

function ConfirmPocketPayment({
  billId,
  onClose,
  onConfirmed,
}: {
  billId: string;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const options = usePocketOptions();
  const result = usePocketResource(
    useCallback(() => getBill(billId, options), [billId, options]),
  );
  const action = usePocketAction();
  const [checked, setChecked] = useState(false);
  const [returning, setReturning] = useState(false);
  const bill = result.data;
  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open && !action.busy) onClose();
      }}
      dismissible={!action.busy}
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{returning ? "退回待付款" : "核对实际到账"}</DrawerTitle>
          <DrawerDescription>
            {returning
              ? "请先核对微信账单并与付款人沟通。退回只修改应用内状态，不会退款或撤销转账。"
              : "请先在微信账单中核对付款人、金额和付款标识码，再确认收款。"}
          </DrawerDescription>
        </DrawerHeader>
        <div className="space-y-3 px-4">
          <PocketError
            message={result.error || action.error}
            retry={result.refresh}
          />
          {!bill && !result.error ? <PocketLoading /> : null}
          {bill ? (
            <>
              <p className="text-lg font-semibold">
                {bill.payer?.name} · {pocketMoney(bill.amountCents)}
              </p>
              <p className="text-sm">付款标识码：{bill.verifyCode}</p>
              <PocketConsent checked={checked} onChange={setChecked}>
                {returning
                  ? "我已核对尚未到账，并与付款人确认。"
                  : "我已核对这笔款项确实到账。"}
              </PocketConsent>
            </>
          ) : null}
        </div>
        <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button
            disabled={
              action.busy ||
              Boolean(result.error) ||
              !checked ||
              bill?.status !== "submitted" ||
              !bill.updatedAt
            }
            onClick={() =>
              void action.run(
                `${returning ? "return" : "confirm"}:${bill?.id}:${bill?.updatedAt}`,
                async () => {
                  if (!bill?.updatedAt || result.error) return;
                  await (returning ? rejectPocketPayment : confirmBill)(
                    { billId: bill.id, updatedAt: bill.updatedAt },
                    options,
                  );
                  onConfirmed();
                  onClose();
                },
              )
            }
          >
            {returning ? "确认未到账，退回待付" : "确认已到账"}
          </Button>
          <Button
            variant="outline"
            disabled={
              action.busy ||
              Boolean(result.error) ||
              bill?.status !== "submitted"
            }
            onClick={() => {
              setReturning(!returning);
              setChecked(false);
            }}
          >
            {returning ? "返回核对到账" : "未收到，退回待付"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
