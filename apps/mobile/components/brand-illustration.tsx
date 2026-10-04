import Image from "next/image";
import { cn } from "@workspace/ui/lib/utils";

type BrandElement =
  | "errand"
  | "template"
  | "manual"
  | "scan"
  | "address"
  | "collection"
  | "wallet"
  | "help"
  | "orders"
  | "store";

export function BrandIllustration({
  name,
  size = 48,
  className,
}: {
  name: BrandElement;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={`/brand/${name}.webp`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
