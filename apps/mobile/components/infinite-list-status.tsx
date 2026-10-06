import type { ComponentProps } from "react";
import { InfiniteListStatus as SharedInfiniteListStatus } from "@workspace/ui/components/infinite-list-status";
import { BrandIllustration } from "@/components/brand-illustration";

export function InfiniteListStatus(
  props: ComponentProps<typeof SharedInfiniteListStatus>,
) {
  return (
    <SharedInfiniteListStatus
      errorIllustration={<BrandIllustration name="load-error" size={48} />}
      {...props}
    />
  );
}
