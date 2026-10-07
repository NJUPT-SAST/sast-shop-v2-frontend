import { Skeleton } from "@workspace/ui/components/skeleton";

type RouteVariant =
  | "goods"
  | "face"
  | "templates"
  | "pocket-create"
  | "pocket-detail"
  | "pocket-capture";

const routeLabels: Record<RouteVariant, string> = {
  goods: "我上架的商品加载中",
  face: "人脸状态加载中",
  templates: "商品模板加载中",
  "pocket-create": "发起 Pocket 加载中",
  "pocket-detail": "Pocket 详情加载中",
  "pocket-capture": "选择分摊人加载中",
};

export function MobileRouteSkeleton({ variant }: { variant: RouteVariant }) {
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col gap-4 ${variant.startsWith("pocket-") ? "py-3" : "py-6"}`}
      role="status"
      aria-label={routeLabels[variant]}
    >
      <Skeleton className="h-7 w-36" />
      {variant === "goods" ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-xl border bg-card p-3"
            >
              <Skeleton className="size-16 shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {variant === "face" ? (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <Skeleton className="size-14 shrink-0 rounded-lg" />
          <Skeleton className="h-5 w-40" />
        </div>
      ) : null}
      {variant === "templates" ? (
        <>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-40 w-full" />
        </>
      ) : null}
      {variant === "pocket-create" ? (
        <>
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-full" />
          </div>
          <Skeleton className="h-12 w-full" />
        </>
      ) : null}
      {variant === "pocket-detail" ? (
        <>
          <div className="divide-y rounded-lg border bg-card px-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="flex min-h-10 items-center justify-between gap-4 py-2"
              >
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
          <Skeleton className="h-6 w-24" />
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 py-3">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="ml-auto h-5 w-16" />
            </div>
          ))}
        </>
      ) : null}
      {variant === "pocket-capture" ? (
        <>
          <div className="space-y-3 rounded-lg border bg-card p-3">
            <Skeleton className="h-5 w-32" />
            <div className="flex justify-between gap-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
          <Skeleton className="h-12 w-full" />
        </>
      ) : null}
    </div>
  );
}
