"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { listMyPockets } from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { pocketMoney, pocketStatusLabel } from "@/lib/west-pocket";
import {
  PocketError,
  PocketHeading,
  PocketLoading,
  usePocketAction,
  usePocketOptions,
  usePocketResource,
} from "./shared";

export function PocketList() {
  const [perspective, setPerspective] = useState<"owner" | "member">("owner");
  return (
    <div className="space-y-5 py-6">
      <PocketHeading
        title="West Pocket"
        action={
          <Button asChild size="sm">
            <Link href="/west-pocket/new">发起 AA</Link>
          </Button>
        }
      />
      <Tabs
        value={perspective}
        onValueChange={(value) =>
          setPerspective(value === "member" ? "member" : "owner")
        }
      >
        <TabsList className="w-full">
          <TabsTrigger value="owner" className="flex-1">
            我发起的
          </TabsTrigger>
          <TabsTrigger value="member" className="flex-1">
            我参与的
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <PocketListContent key={perspective} perspective={perspective} />
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
        <div className="space-y-3 py-12 text-center">
          <p className="font-semibold">还没有 AA 活动</p>
          <p className="text-sm text-muted-foreground">
            发起一次聚餐，留下合照和清楚的账单。
          </p>
        </div>
      ) : null}
      <div className="divide-y rounded-xl border bg-card">
        {data?.pockets.map((pocket) => (
          <Link
            key={pocket.id}
            href={`/west-pocket/${pocket.id}`}
            className="block space-y-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-words font-semibold">
                {pocket.title || "聚餐 AA"}
              </p>
              <Badge variant="outline" className="shrink-0">
                {pocketStatusLabel(pocket.status)}
              </Badge>
            </div>
            <div className="flex items-end justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {pocket.participantCount} 人参与
              </span>
              <span className="text-xl font-semibold tabular-nums">
                {pocketMoney(pocket.totalCents)}
              </span>
            </div>
          </Link>
        ))}
      </div>
      {data?.nextPageToken ? (
        <Button
          variant="outline"
          className="w-full"
          disabled={action.busy}
          onClick={() =>
            void action.run(`more:${data.nextPageToken}`, async () => {
              const next = await listMyPockets(
                { perspective, pageToken: data.nextPageToken },
                options,
              );
              setData({
                pockets: [...data.pockets, ...next.pockets],
                nextPageToken: next.nextPageToken,
              });
            })
          }
        >
          加载更多
        </Button>
      ) : null}
    </>
  );
}
