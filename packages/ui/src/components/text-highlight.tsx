import type { ComponentProps, ReactNode } from "react";

import { cn } from "#lib/utils";

function TextHighlight({ className, ...props }: ComponentProps<"mark">) {
  return (
    <mark
      className={cn(
        "bg-transparent bg-[linear-gradient(transparent_55%,color-mix(in_oklab,var(--primary)_24%,transparent)_55%)] text-inherit [box-decoration-break:clone]",
        className,
      )}
      {...props}
    />
  );
}

function HighlightedText({
  text,
  highlights = [],
}: {
  text: string;
  highlights?: string[];
}) {
  let parts: ReactNode[] = [text];
  for (const phrase of highlights.filter(Boolean)) {
    parts = parts.flatMap<ReactNode>((part, partIndex) =>
      typeof part === "string"
        ? part
            .split(phrase)
            .flatMap((segment, matchIndex) =>
              matchIndex === 0
                ? [segment]
                : [
                    <TextHighlight key={`${phrase}:${partIndex}:${matchIndex}`}>
                      {phrase}
                    </TextHighlight>,
                    segment,
                  ],
            )
        : [part],
    );
  }
  return <>{parts}</>;
}

export { TextHighlight, HighlightedText };
