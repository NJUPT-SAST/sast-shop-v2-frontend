import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

export default function SpotOrderLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-20 w-full rounded-lg" />
      <Card className="rounded-lg">
        <CardContent className="flex flex-col gap-4 p-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-6 w-full" />
        </CardContent>
      </Card>
      <Skeleton className="mt-auto h-12 w-full rounded-md" />
    </div>
  )
}
