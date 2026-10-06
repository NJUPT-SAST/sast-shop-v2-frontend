"use client";
import { useCallback } from "react";
import Link from "next/link";
import { listMyPockets } from "@sast-shop/api";
import { Badge } from "@workspace/ui/components/badge";
import { InfiniteListStatus } from "@workspace/ui/components/infinite-list-status";
import { Empty } from "@workspace/ui/components/empty";
import { BrandIllustration } from "../brand-illustration";
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { pocketMoney, pocketStatusLabel } from "@/lib/west-pocket";
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
      <PocketError message={error || action.error} retry={refresh} />
      {!data && !error ? <PocketLoading /> : null}
      {data?.pockets.length === 0 ? (
        <Empty
          illustration={<BrandIllustration name="pocket" size={80} />}
          title="还没有 Pocket"
          description={
            perspective === "owner"
              ? "发起一次 Pocket，记录分摊与收款"
              : "加入分摊后，可在这里查看账单和活动"
          }
        />
      ) : null}
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        {data?.pockets.map((pocket) => (
          <Link
            key={pocket.id}
            href={`/west-pocket/${pocket.id}`}
            className="group block min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="min-w-0 overflow-hidden rounded-lg transition-colors group-hover:border-primary/40">
              <CardHeader className="gap-2 pb-3">
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
              </CardHeader>
              <CardFooter className="min-w-0 justify-between gap-3 border-t bg-muted/30 px-4 py-3">
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
          />{" "}
        </div>
      ) : null}
    </>
  );
}
