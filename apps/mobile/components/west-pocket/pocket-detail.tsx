"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  type PocketDetail,
  type WestPocket,
} from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Input } from "@workspace/ui/components/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { CopyButton } from "@workspace/ui/components/copy-button";
import { PaymentCodeHelp } from "@workspace/ui/components/payment-code-help";
import { RiWechatPayLine, RiAlipayLine, RiEditLine } from "@remixicon/react";
import { cn } from "@workspace/ui/lib/utils";
import { MobileHeaderActions } from "../mobile-header-actions";
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
  const activePocketId = useRef(pocketId);
  useEffect(() => {
    activePocketId.current = pocketId;
  }, [pocketId]);
  const options = usePocketOptions();
  const result = usePocketResource(
    useCallback(() => getPocket(pocketId, options), [pocketId, options]),
  );
  const action = usePocketAction({
    transaction: true,
    reconcile: async () => Boolean(await result.refreshFresh()),
  });
  const [membersOpen, setMembersOpen] = useState(false);
  const [confirming, setConfirming] = useState<PocketMember | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [draftState, setDraftState] = useState({
    pocketId,
    blocked: false,
    saving: false,
  });
  const onDraftState = useCallback(
    (state: { blocked: boolean; saving: boolean }) =>
      setDraftState({ pocketId, ...state }),
    [pocketId],
  );
  const draftBlocked = draftState.pocketId === pocketId && draftState.blocked;
  const draftSaving = draftState.pocketId === pocketId && draftState.saving;
  const detail = result.data?.pocket.id === pocketId ? result.data : null;
  usePocketPolling(
    result.refresh,
    Boolean(
      detail &&
      ["publishing", "collecting", "cancelling"].includes(detail.pocket.status),
    ),
  );
  if (!detail)
    return (
      <div className="space-y-5 py-4">
        <PocketHeading title="Pocket" />
        <PocketError
          message={result.error}
          retry={action.pending ? action.recover : result.refresh}
        />
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
    <div className="space-y-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <h1 className="min-w-0 break-words text-xl font-semibold">
            {pocket.title || "Pocket"}
          </h1>
          {draft && isOwner ? (
            <Button
              variant="ghost"
              size="icon"
              className="-my-2 size-11 shrink-0"
              aria-label="修改聚餐名称"
              disabled={draftSaving || action.busy || Boolean(result.error)}
              onClick={() => setEditingTitleId(pocket.id)}
            >
              <RiEditLine className="size-4 text-muted-foreground" />
            </Button>
          ) : null}
        </div>
        <Badge
          variant={
            pocket.status === "settled"
              ? "success"
              : pocket.status === "collecting"
                ? "payment"
                : pocket.status === "draft"
                  ? "neutral"
                  : "muted"
          }
          className="shrink-0"
        >
          {pocketStatusLabel(pocket.status)}
        </Badge>
      </div>
      <PocketError
        message={result.error || action.error}
        retry={action.pending ? action.recover : result.refresh}
      />
      <section aria-label="分摊汇总" className="rounded-xl border bg-card px-4">
        <dl className="divide-y divide-border/70">
          {!draft || !isOwner ? (
            <div className="flex min-h-10 items-center justify-between gap-4 py-1.5">
              <dt className="shrink-0 text-sm text-muted-foreground">
                聚餐总金额
              </dt>
              <dd className="text-lg font-semibold tabular-nums text-primary">
                {pocketMoney(pocket.totalCents)}
              </dd>
            </div>
          ) : null}
          <div className="flex min-h-10 items-center justify-between gap-4 py-1.5">
            <dt className="shrink-0 text-sm text-muted-foreground">分摊人数</dt>
            <dd className="text-sm tabular-nums">
              {pocket.participantCount} 人
            </dd>
          </div>
          <div className="flex min-h-10 items-center justify-between gap-4 py-1.5">
            <dt className="shrink-0 text-sm text-muted-foreground">收款人</dt>
            <dd className="flex min-w-0 items-center gap-2 text-sm">
              <Avatar className="size-6 shrink-0">
                <AvatarImage src={pocket.owner.avatarUrl} alt="" />
                <AvatarFallback>{pocket.owner.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 break-words text-right font-medium">
                {pocket.owner.name}
              </span>
            </dd>
          </div>
          {isOwner && !draft ? (
            <div className="grid grid-cols-2 gap-3 py-3 text-sm">
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
            </div>
          ) : null}
        </dl>
        {draft && isOwner ? (
          <DraftPocketForm
            key={pocket.id}
            pocket={pocket}
            titleOpen={editingTitleId === pocket.id}
            onTitleClose={() => setEditingTitleId(null)}
            paused={
              cancelOpen || membersOpen || action.busy || Boolean(result.error)
            }
            onStateChange={onDraftState}
            onSaved={async (updated) => {
              if (activePocketId.current !== pocket.id) return null;
              if (updated) result.setData({ ...detail, pocket: updated });
              return result.refreshFresh();
            }}
          />
        ) : null}
      </section>
      {draft && isOwner ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {draftBlocked ? (
              <Button variant="outline" disabled>
                拍照 / 补拍
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href={`/west-pocket/${pocketId}/capture`}>
                  拍照 / 补拍
                </Link>
              </Button>
            )}
            <Button
              disabled={draftBlocked}
              onClick={() => setMembersOpen(true)}
            >
              选择分摊人
            </Button>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            {draftBlocked
              ? "请先完成当前修改，再选择分摊人或拍照"
              : "草稿仅你可见，确认金额和名单后再发起收款"}
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
                  <p
                    className={cn(
                      "font-semibold tabular-nums",
                      draft ? "text-muted-foreground" : "text-primary",
                    )}
                  >
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
      <MobileHeaderActions>
        {" "}
        {canCancel ? (
          <Button
            variant="ghost"
            className="min-h-11 px-2 text-destructive"
            disabled={action.busy || draftSaving || Boolean(result.error)}
            onClick={() => setCancelOpen(true)}
          >
            取消
          </Button>
        ) : null}
      </MobileHeaderActions>
      {pocket.status === "cancelled" ? (
        <p className="rounded-lg bg-muted p-4 text-sm leading-6">
          活动已取消，应用内账单已关闭。取消不会撤回已发生的线下转账。
          {pocket.cancelReason ? `取消原因：${pocket.cancelReason}` : ""}
        </p>
      ) : null}
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
          <DrawerHeader className="shrink-0">
            <DrawerTitle>取消本次 Pocket</DrawerTitle>
            <DrawerDescription>取消后关闭收款请求和提醒</DrawerDescription>
          </DrawerHeader>
          <div className="app-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-2">
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="pocket-cancel-reason">
                  取消原因（选填）
                </FieldLabel>
                <Textarea
                  id="pocket-cancel-reason"
                  value={cancelReason}
                  maxLength={500}
                  disabled={action.busy}
                  onChange={(event) => setCancelReason(event.target.value)}
                />
                <FieldDescription>
                  取消不会撤回线下转账，请先核实没有同学已转账但尚未标记付款
                </FieldDescription>
              </Field>
            </FieldGroup>
            <PocketError
              message={action.error}
              retry={action.pending ? action.recover : result.refresh}
            />
          </div>
          <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button
              variant="destructive"
              disabled={action.busy || !canCancel || Boolean(result.error)}
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
                    await result.refreshFresh();
                    setCancelOpen(false);
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
  titleOpen,
  onTitleClose,
  paused,
  onStateChange,
}: {
  pocket: WestPocket;
  onSaved: (updated?: WestPocket) => Promise<PocketDetail | null>;
  titleOpen: boolean;
  onTitleClose: () => void;
  paused: boolean;
  onStateChange: (state: { blocked: boolean; saving: boolean }) => void;
}) {
  const options = usePocketOptions();
  const mounted = useRef(true);
  const attempted = useRef("");
  const snapshot = useRef<{
    field: "title" | "totalCents";
    value: string | number;
  } | null>(null);
  const [amountDraft, setAmountDraft] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [attemptedAmount, setAttemptedAmount] = useState(false);
  const amount = amountDraft ?? (pocket.totalCents / 100).toFixed(2);
  const title = titleDraft ?? pocket.title;
  let amountCents: number | null = null;
  try {
    amountCents = parsePocketAmount(amount);
  } catch {}
  const dirty = amountDraft !== null && amountCents !== pocket.totalCents;
  const action = usePocketAction({
    transaction: true,
    reconcile: async () => {
      if (!mounted.current) return false;
      const latest = await onSaved();
      if (!latest || !mounted.current) return false;
      const current = snapshot.current;
      if (current && latest.pocket[current.field] === current.value) {
        action.clearError();
        if (current.field === "totalCents") {
          setAmountDraft(null);
          setAttemptedAmount(false);
        } else {
          setTitleDraft(null);
          onTitleClose();
        }
      }
      return true;
    },
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    onStateChange({
      blocked: dirty || titleOpen || action.busy || paused,
      saving: action.busy,
    });
  }, [dirty, titleOpen, action.busy, paused, onStateChange]);
  const save = async (
    field: "title" | "totalCents",
    value: string | number,
  ) => {
    if (!mounted.current || action.busy || paused) return;
    snapshot.current = { field, value };
    if (field === "totalCents") setAttemptedAmount(true);
    await action.run(
      `update:${pocket.revision}:${field}:${value}`,
      async (requestId) => {
        const updated = await updatePocket(
          {
            pocketId: pocket.id,
            expectedRevision: pocket.revision,
            requestId,
            ...(field === "title"
              ? { title: value as string }
              : { totalCents: value as number }),
          },
          options,
        );
        if (!mounted.current) return;
        await onSaved(updated);
        if (!mounted.current) return;
        if (field === "totalCents") {
          setAmountDraft(null);
          setAttemptedAmount(false);
        } else {
          setTitleDraft(null);
          onTitleClose();
        }
      },
    );
  };
  useEffect(() => {
    const key = `${pocket.revision}:${amountCents}`;
    if (
      !dirty ||
      focused ||
      titleOpen ||
      paused ||
      action.busy ||
      action.error ||
      amountCents === null ||
      attempted.current === key
    )
      return;
    const timer = window.setTimeout(() => {
      attempted.current = key;
      void save("totalCents", amountCents);
    }, 700);
    return () => window.clearTimeout(timer);
  });
  return (
    <div className="flex flex-col gap-3 border-t border-border/70 py-3">
      <FieldGroup className="gap-3">
        <Field data-invalid={dirty && !focused && amountCents === null}>
          <div className="flex min-w-0 items-center justify-between gap-3">
            <FieldLabel
              htmlFor="draft-amount"
              className="font-normal text-muted-foreground"
            >
              总金额
            </FieldLabel>
            <div className="flex shrink-0 items-center text-primary">
              <span className="text-lg font-semibold" aria-hidden="true">
                ¥
              </span>
              <Input
                id="draft-amount"
                aria-label="总金额（元）"
                className="h-11 min-w-[4ch] max-w-[14ch] border-transparent bg-transparent px-1 text-right text-lg font-semibold tabular-nums text-primary shadow-none focus-visible:border-ring focus-visible:ring-2 md:text-lg dark:bg-transparent"
                style={{
                  width: `${Math.max(4, Math.min(14, amount.length + 1))}ch`,
                }}
                inputMode="decimal"
                value={amount}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onChange={(event) => {
                  attempted.current = "";
                  setAttemptedAmount(false);
                  action.clearError();
                  setAmountDraft(event.target.value);
                }}
                disabled={action.busy || titleOpen || paused}
                aria-invalid={dirty && !focused && amountCents === null}
              />
            </div>
          </div>
          {dirty && !focused && amountCents === null ? (
            <FieldDescription>请输入有效金额，最多两位小数</FieldDescription>
          ) : null}
          {action.busy ? (
            <FieldDescription>正在保存或核实修改</FieldDescription>
          ) : dirty && !attemptedAmount ? (
            <FieldDescription>离开金额输入框后自动保存</FieldDescription>
          ) : null}
        </Field>
      </FieldGroup>
      <PocketError
        message={
          action.error ||
          (dirty && attemptedAmount && !action.busy
            ? "金额尚未保存，请重试"
            : "")
        }
        retry={
          action.pending
            ? action.recover
            : amountCents !== null && dirty
              ? () => void save("totalCents", amountCents)
              : undefined
        }
      />
      <Drawer
        open={titleOpen}
        dismissible={!action.busy}
        onOpenChange={(open) => {
          if (!open && !action.busy) {
            setTitleDraft(null);
            action.clearError();
            onTitleClose();
          }
        }}
      >
        <DrawerContent>
          <DrawerHeader className="shrink-0">
            <DrawerTitle>修改聚餐名称</DrawerTitle>
            <DrawerDescription className="sr-only">
              修改当前 Pocket 的聚餐名称
            </DrawerDescription>
          </DrawerHeader>
          <div className="app-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-2">
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="draft-title">聚餐名称</FieldLabel>
                <Input
                  id="draft-title"
                  value={title}
                  maxLength={100}
                  disabled={action.busy}
                  onChange={(event) => {
                    action.clearError();
                    setTitleDraft(event.target.value);
                  }}
                />
              </Field>
            </FieldGroup>
            <PocketError
              message={action.error}
              retry={action.pending ? action.recover : undefined}
            />
          </div>
          <DrawerFooter>
            <Button
              disabled={action.busy || !title.trim()}
              onClick={() => {
                if (title.trim() === pocket.title) {
                  setTitleDraft(null);
                  onTitleClose();
                  return;
                }
                void save("title", title.trim());
              }}
            >
              完成
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
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
  const action = usePocketAction({
    transaction: true,
    reconcile: async () => Boolean(await result.refreshFresh()),
  });
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
        <DrawerHeader className="shrink-0">
          <DrawerTitle>{returning ? "退回待付款" : "核对实际到账"}</DrawerTitle>
          <DrawerDescription className="sr-only">
            {returning
              ? "核对尚未到账，并先与付款人沟通"
              : "请核对支付账单中的付款人、金额和付款标识码"}
          </DrawerDescription>
        </DrawerHeader>
        <div className="app-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-2">
          <PocketError
            message={result.error || action.error}
            retry={action.pending ? action.recover : result.refresh}
          />
          {!bill && !result.error ? <PocketLoading /> : null}
          {bill ? (
            <>
              <dl
                aria-label="到账核对信息"
                className="divide-y divide-border/70 rounded-lg bg-muted/70 px-3"
              >
                <div className="flex min-h-12 items-center justify-between gap-4 py-2">
                  <dt className="shrink-0 text-sm text-muted-foreground">
                    付款人
                  </dt>
                  <dd className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-sm">
                    {bill.payer ? (
                      <>
                        <Avatar className="size-6 shrink-0">
                          <AvatarImage src={bill.payer.avatarUrl} alt="" />
                          <AvatarFallback>
                            {bill.payer.name.slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 break-words font-medium">
                          {bill.payer.name}
                        </span>
                      </>
                    ) : (
                      "待核实"
                    )}
                    {bill.channel ? (
                      <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                        {bill.channel === "wechat" ? (
                          <RiWechatPayLine
                            className="size-5 text-[#07c160]"
                            aria-hidden="true"
                          />
                        ) : (
                          <RiAlipayLine
                            className="size-5 text-[#1677ff]"
                            aria-hidden="true"
                          />
                        )}
                        {bill.channel === "wechat" ? "微信" : "支付宝"}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div className="flex min-h-10 items-center justify-between gap-4 py-1.5">
                  <dt className="shrink-0 text-sm text-muted-foreground">
                    应收金额
                  </dt>
                  <dd className="text-lg font-semibold tabular-nums text-primary">
                    {pocketMoney(bill.amountCents)}
                  </dd>
                </div>
                <div className="flex min-h-12 items-center justify-between gap-4 py-1">
                  <dt className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                    付款标识码
                    <PaymentCodeHelp presentation="drawer" />
                  </dt>
                  <dd className="flex min-w-0 items-center justify-end gap-1">
                    <span className="break-all text-right font-mono font-semibold tabular-nums">
                      {bill.verifyCode}
                    </span>
                    <CopyButton value={bill.verifyCode} label="付款标识码" />
                  </dd>
                </div>
              </dl>
              <FieldGroup className="gap-3">
                <Field
                  data-disabled={
                    action.busy ||
                    Boolean(result.error) ||
                    bill.status !== "submitted"
                  }
                >
                  <PocketConsent
                    checked={checked}
                    onChange={setChecked}
                    disabled={
                      action.busy ||
                      Boolean(result.error) ||
                      bill.status !== "submitted"
                    }
                  >
                    {returning
                      ? "我已核对尚未到账，并与付款人确认"
                      : "我已核对这笔款项确实到账"}
                  </PocketConsent>
                  {returning ? (
                    <FieldDescription>
                      退回仅修改应用内状态，不会退款或撤销转账
                    </FieldDescription>
                  ) : null}
                </Field>
              </FieldGroup>
              <Button
                variant="ghost"
                className="self-start"
                disabled={
                  action.busy ||
                  Boolean(result.error) ||
                  bill.status !== "submitted"
                }
                onClick={() => {
                  setReturning(!returning);
                  setChecked(false);
                }}
              >
                {returning ? "返回核对到账" : "未收到，退回待付"}
              </Button>
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
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
