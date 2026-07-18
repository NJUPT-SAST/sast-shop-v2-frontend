import { Skeleton } from "@workspace/ui/components/skeleton"

export default function Loading() {
  return <div className="space-y-6"><Skeleton className="h-20 w-full" /><div className="grid grid-cols-2 gap-4 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-80" />)}</div></div>
}
