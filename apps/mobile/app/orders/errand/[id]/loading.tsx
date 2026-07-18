import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";

export default function BuyerErrandOrderLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-6 w-16 rounded-md" />
      </div>
      <Skeleton className="h-12 w-full rounded-md" />
      {[1, 2, 3].map((item) => (
        <Card key={item}>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-16 w-full rounded-md" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
