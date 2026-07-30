import { useId, type ComponentProps, type ReactNode } from "react";
import { RiErrorWarningLine } from "@remixicon/react";
import { cva, type VariantProps } from "class-variance-authority";
import { Button } from "#components/button";
import { cn } from "#lib/utils";

const loadFailureVariants = cva("rounded-lg text-card-foreground", {
  variants: {
    variant: {
      page: "flex min-h-[min(24rem,60dvh)] flex-col items-center justify-center gap-3 px-4 py-10 text-center",
      section:
        "flex min-h-36 flex-col items-center justify-center gap-3 px-4 py-8 text-center",
      compact:
        "flex flex-col items-center justify-center gap-3 px-4 py-5 text-center",
    },
    surface: {
      card: "border border-destructive/25 bg-card",
      plain: "bg-transparent",
    },
  },
  defaultVariants: {
    variant: "section",
    surface: "card",
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
  const resolvedSurface = surface ?? "card";
  const compact = resolvedVariant === "compact";
  const normalizedDescription =
    typeof description === "string"
      ? description.replace(/[。.]+$/u, "")
      : description;
  const retryAction = onRetry ? (
    <Button type="button" size={compact ? "sm" : "default"} onClick={onRetry}>
      {retryLabel}
    </Button>
  ) : retryHref ? (
    <Button asChild size={compact ? "sm" : "default"}>
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
        data-slot="load-failure-icon"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive",
          compact ? "size-9" : "size-11",
        )}
        aria-hidden="true"
      >
        {icon}
      </div>

      <div data-slot="load-failure-content" className="min-w-0">
        <div className="space-y-1">
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
            className="mt-4 flex flex-wrap justify-center gap-2"
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
