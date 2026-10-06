import { useId, type ComponentProps, type ReactNode } from "react";
import { RiErrorWarningLine } from "@remixicon/react";
import { cva, type VariantProps } from "class-variance-authority";
import { Button } from "#components/button";
import { cn } from "#lib/utils";

const loadFailureVariants = cva("w-full text-foreground", {
  variants: {
    variant: {
      page: "flex min-h-[min(24rem,60dvh)] flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center [@media(max-height:640px)]:py-4",
      section:
        "flex min-h-36 flex-col items-center justify-center gap-4 px-4 py-8 text-center [@media(max-height:640px)]:py-4",
      compact: "flex items-center gap-3 px-1 py-4 text-left",
    },
    surface: {
      card: "rounded-lg border bg-card",
      plain: "bg-transparent",
    },
  },
  defaultVariants: {
    variant: "section",
    surface: "plain",
  },
});

type RetryTarget =
  | {
      onRetry: () => void;
      retryHref?: never;
    }
  | {
      onRetry?: never;
      retryHref: string;
    }
  | {
      onRetry?: never;
      retryHref?: never;
    };

type LoadFailureProps = Omit<ComponentProps<"div">, "title"> &
  RetryTarget &
  VariantProps<typeof loadFailureVariants> & {
    title: ReactNode;
    description?: ReactNode;
    icon?: ReactNode;
    illustration?: ReactNode;
    retryLabel?: ReactNode;
    secondaryAction?: ReactNode;
  };

function LoadFailure({
  className,
  variant,
  surface,
  title,
  description,
  icon = <RiErrorWarningLine className="size-5" />,
  illustration,
  retryLabel = "重新加载",
  onRetry,
  retryHref,
  secondaryAction,
  ...props
}: LoadFailureProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;
  const resolvedVariant = variant ?? "section";
  const resolvedSurface = surface ?? "plain";
  const compact = resolvedVariant === "compact";
  const normalizedDescription =
    typeof description === "string"
      ? description.replace(/[。.]+$/u, "")
      : description;
  const retryAction = onRetry ? (
    <Button type="button" size="touch" onClick={onRetry}>
      {retryLabel}
    </Button>
  ) : retryHref ? (
    <Button asChild size="touch">
      <a href={retryHref}>{retryLabel}</a>
    </Button>
  ) : null;

  return (
    <div
      data-slot="load-failure"
      data-variant={resolvedVariant}
      data-surface={resolvedSurface}
      className={cn(
        loadFailureVariants({
          variant: resolvedVariant,
          surface: resolvedSurface,
        }),
        className,
      )}
      {...props}
      role="alert"
      aria-labelledby={titleId}
      aria-describedby={normalizedDescription ? descriptionId : undefined}
    >
      <div
        data-slot={
          illustration ? "load-failure-illustration" : "load-failure-icon"
        }
        className={cn(
          "flex shrink-0 items-center justify-center text-muted-foreground",
          !illustration && (compact ? "size-9" : "size-11"),
        )}
        aria-hidden="true"
      >
        {illustration ?? icon}
      </div>

      <div
        data-slot="load-failure-content"
        className={cn(
          "min-w-0",
          compact && "flex flex-1 flex-wrap items-center gap-3",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-col gap-1",
            compact && "flex-1 basis-36",
          )}
        >
          <p
            id={titleId}
            data-slot="load-failure-title"
            className="text-sm font-semibold text-foreground"
          >
            {title}
          </p>
          {normalizedDescription ? (
            <p
              id={descriptionId}
              data-slot="load-failure-description"
              className={cn(
                "text-sm leading-6 text-muted-foreground",
                compact ? "max-w-[52ch]" : "mx-auto max-w-[42ch]",
              )}
            >
              {normalizedDescription}
            </p>
          ) : null}
        </div>

        {retryAction || secondaryAction ? (
          <div
            data-slot="load-failure-actions"
            className={cn(
              "flex flex-wrap gap-2",
              compact ? "shrink-0" : "mt-4 justify-center",
            )}
          >
            {retryAction}
            {secondaryAction}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { LoadFailure };
export type { LoadFailureProps };
