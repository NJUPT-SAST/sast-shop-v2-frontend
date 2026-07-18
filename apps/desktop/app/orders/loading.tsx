import { Skeleton } from "@workspace/ui/components/skeleton"

export default function Loading() {
  return <div className="space-y-6"><Skeleton className="h-20" /><Skeleton className="h-10" />{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-24" />)}</div>
}
