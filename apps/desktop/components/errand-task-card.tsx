"use client";

import Link from "next/link";
import { RiArrowRightSLine } from "@remixicon/react";
import {
  getErrandTaskParticipants,
  type ErrandTaskBrief,
  type ServiceOptions,
} from "@sast-shop/api";
import { Card } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import {
  ErrandTaskParticipants,
  ErrandTaskStartTime,
  getErrandTaskProgress,
} from "@workspace/ui/components/errand-task-summary";
import { ManagedImage } from "@/components/managed-image";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/order-filters";
import { parsePositiveInt64RouteId } from "@/lib/route-id";

export function ErrandTaskCard({
  task,
  options,
}: {
  task: ErrandTaskBrief;
  options: ServiceOptions;
}) {
  const id = parsePositiveInt64RouteId(task.id);
  const images = task.items.filter((item) => item.productImageUrl).slice(0, 3);
  const main = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-base font-semibold leading-6 tabular-nums">
          {getErrandTaskProgress(task)}
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant={getStatusBadgeVariant(task.status)}>
            {getStatusLabel(task.status)}
          </Badge>
          {id ? (
            <RiArrowRightSLine
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
          ) : null}
        </div>
      </div>
      <p className="mt-1 truncate text-sm text-muted-foreground">
        {task.storeName}
      </p>
    </>
  );
  return (
    <Card className="relative min-w-0 overflow-hidden rounded-lg p-4">
      {id ? (
        <Link
          href={`/group/purchase/${id}`}
          prefetch={false}
          className="block rounded-sm after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
        >
          {main}
        </Link>
      ) : (
        <div>{main}</div>
      )}
      <div className="mt-3 flex min-h-8 items-center justify-between gap-3">
        {id ? (
          <ErrandTaskParticipants
            cacheKey={JSON.stringify([
              "errand:participants",
              options.dataSource,
              options.connectBaseUrl,
              id,
            ])}
            refreshKey={task}
            load={() => getErrandTaskParticipants(id, options)}
          />
        ) : (
          <span />
        )}
        {images.length ? (
          <div className="flex shrink-0 gap-1" aria-label="商品摘要">
            {images.map((item) => (
              <ManagedImage
                key={item.id}
                src={item.productImageUrl}
                alt={item.productTitle}
                fit="contain"
                className="size-8 rounded-md"
              />
            ))}
          </div>
        ) : null}
      </div>
      <ErrandTaskStartTime value={task.createdAt} />
    </Card>
  );
}
