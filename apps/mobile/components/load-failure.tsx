import {
  LoadFailure as SharedLoadFailure,
  type LoadFailureProps,
} from "@workspace/ui/components/load-failure";
import { BrandIllustration } from "@/components/brand-illustration";

export function LoadFailure({
  variant = "section",
  illustration,
  icon,
  ...props
}: LoadFailureProps) {
  return (
    <SharedLoadFailure
      variant={variant}
      illustration={
        illustration ??
        (icon ? undefined : (
          <BrandIllustration
            name="load-error"
            size={variant === "compact" ? 48 : variant === "page" ? 112 : 96}
            className={
              variant === "compact"
                ? undefined
                : "[@media(max-height:640px)]:size-20"
            }
          />
        ))
      }
      icon={icon}
      {...props}
    />
  );
}
