"use client";

import { useId } from "react";

export function ListedGoodsIcon() {
  const id = useId();

  return (
    <svg
      className="size-9"
      width="36"
      height="36"
      viewBox="4 2 43 43"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={`${id}-box`}
          x1="9"
          y1="18"
          x2="30"
          y2="39"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--primary)" stopOpacity="0.72" />
          <stop offset="1" stopColor="var(--primary)" />
        </linearGradient>
      </defs>
      <ellipse
        cx="24"
        cy="41"
        rx="19"
        ry="3"
        fill="var(--foreground)"
        opacity="0.08"
      />
      <path
        d="M7 20 21 13 35 20 21 27 7 20Z"
        fill="var(--primary)"
        opacity="0.35"
      />
      <path d="M7 20v16l14 7V27L7 20Z" fill={`url(#${id}-box)`} />
      <path d="m21 27 14-7v16l-14 7V27Z" fill="var(--primary)" />
      <path
        d="m14 16.5 14 7v6l-5 2.5v-6l-14-7 5-2.5Z"
        fill="var(--primary-foreground)"
        opacity="0.8"
      />
      <path
        d="m11 30 6 3v3l-6-3v-3Z"
        fill="var(--primary-foreground)"
        opacity="0.7"
      />
      <circle cx="36" cy="13" r="10" fill="var(--secondary)" />
      <path
        d="M36 18V8m-4 4 4-4 4 4"
        stroke="var(--primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
