import { Card, CardContent } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";

export default function PurchaseTaskLoading() {
  return (
    <div className="flex flex-1 flex-col gap-5 py-5">
      <section className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-5 w-20" />
      </section>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-24" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="overflow-hidden">
            <CardContent className="flex items-center gap-3 p-3">
              <Skeleton className="size-16 shrink-0 rounded-lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-auto overflow-hidden">
        <CardContent className="p-2">
          <Skeleton className="h-12 w-full rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}
