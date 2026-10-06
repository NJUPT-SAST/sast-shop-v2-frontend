"use client";
import { useCallback } from "react";
import Link from "next/link";
import { listMyPockets } from "@sast-shop/api";
import { Badge } from "@workspace/ui/components/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { RiUser3Line } from "@remixicon/react";
import { InfiniteListStatus } from "@workspace/ui/components/infinite-list-status";
import { Empty } from "@workspace/ui/components/empty";
import { BrandIllustration } from "../brand-illustration";
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { pocketMoney, pocketStatusLabel } from "@/lib/pocket";
import {
  PocketError,
  PocketLoading,
  usePocketAction,
  usePocketOptions,
  usePocketResource,
} from "./shared";

export function PocketList({
  refreshKey = "",
  perspective,
}: {
  refreshKey?: string;
  perspective: "owner" | "member";
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <PocketListContent
        key={`${perspective}:${refreshKey}`}
        perspective={perspective}
      />
    </div>
  );
}
function PocketListContent({
  perspective,
}: {
  perspective: "owner" | "member";
}) {
  const options = usePocketOptions();
  const { data, setData, error, refresh } = usePocketResource(
    useCallback(
      () => listMyPockets({ perspective }, options),
      [perspective, options],
    ),
  );
  const action = usePocketAction();
  return (
    <>
      <PocketError message={error} retry={refresh} />
      {!data && !error ? <PocketLoading /> : null}
      {data?.pockets.length === 0 ? (
        <Empty
          illustration={<BrandIllustration name="pocket" size={80} />}
          title="还没有 Pocket"
          description={
            perspective === "owner"
              ? "发起 Pocket，记录分摊与收款"
              : "参与的分摊会显示在这里"
          }
        />
      ) : null}
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        {data?.pockets.map((pocket) => (
          <Link
            key={pocket.id}
            href={`/pocket/${pocket.id}`}
            className="group block min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="min-w-0 overflow-hidden rounded-lg transition-colors group-hover:border-primary/40 group-active:border-primary/40 motion-reduce:transition-none">
              <CardHeader className="gap-2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="line-clamp-2 min-w-0 flex-1 text-base leading-6">
                    {pocket.title || "Pocket"}
                  </CardTitle>
                  <Badge
                    variant={
                      pocket.status === "settled"
                        ? "success"
                        : pocket.status === "collecting"
                          ? "payment"
                          : pocket.status === "draft"
                            ? "neutral"
                            : pocket.status === "cancelled"
                              ? "danger"
                              : "muted"
                    }
                    className="shrink-0"
                  >
                    {pocketStatusLabel(pocket.status)}
                  </Badge>
                </div>
                <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                  <Avatar className="size-6 shrink-0">
                    <AvatarImage src={pocket.owner.avatarUrl} alt="" />
                    <AvatarFallback>
                      {Array.from(pocket.owner.name)[0] || (
                        <RiUser3Line className="size-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 truncate">
                    {pocket.owner.name || "收款人"}
                  </span>
                  <span className="shrink-0 text-xs">发起</span>
                </div>
              </CardHeader>
              <CardFooter className="min-w-0 justify-between gap-3 border-t bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">
                  {pocket.participantCount} 人参与
                </span>
                <div className="flex shrink-0 items-baseline gap-1 text-right">
                  <span className="text-xs text-muted-foreground">合计</span>
                  <span className="text-lg font-semibold tabular-nums text-primary">
                    {pocketMoney(pocket.totalCents)}
                  </span>
                </div>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>
      {data && data.pockets.length > 0 ? (
        <div className="pt-4">
          <InfiniteListStatus
            hasMore={Boolean(data.nextPageToken)}
            loading={action.busy}
            error={Boolean(action.error)}
            hasItems={data.pockets.length > 0}
            loadingFallback={<PocketLoading />}
            onLoadMore={() => {
              void action.run(`more:${data.nextPageToken}`, async () => {
                const next = await listMyPockets(
                  { perspective, pageToken: data.nextPageToken },
                  options,
                );
                const existing = new Set(
                  data.pockets.map((pocket) => pocket.id),
                );
                setData({
                  pockets: [
                    ...data.pockets,
                    ...next.pockets.filter(
                      (pocket) => !existing.has(pocket.id),
                    ),
                  ],
                  nextPageToken: next.nextPageToken,
                });
              });
            }}
          />
        </div>
      ) : null}
    </>
  );
}
