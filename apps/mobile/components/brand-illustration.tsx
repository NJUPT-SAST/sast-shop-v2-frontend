import Image from "next/image";
import { cn } from "@workspace/ui/lib/utils";

type BrandElement =
  | "errand"
  | "template"
  | "transaction-agreement"
  | "feishu-required"
  | "login"
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
      src={`/brand/${name}${size <= 64 ? "-compact" : ""}.webp`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      unoptimized
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
