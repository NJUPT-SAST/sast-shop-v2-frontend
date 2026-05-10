"use client"

import type { Order } from "@/lib/api/types"
import { getOrderProgressSteps } from "@/lib/utils/order-state"
import { Icon } from "@iconify/react"

export function OrderProgress({ order }: { order: Order }) {
  const steps = getOrderProgressSteps(order)
  return (
    <div className="flex w-full items-start gap-1 overflow-x-auto rounded-xl bg-shop-bg-white p-4">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1
        const dotColor =
          step.state === "done"
            ? "bg-shop-success text-white"
            : step.state === "active"
              ? "bg-shop-primary text-white"
              : "bg-shop-border-light text-shop-text-tertiary"
        const lineColor = step.state === "done" ? "bg-shop-success" : "bg-shop-border-light"
        return (
          <div className="flex flex-1 flex-col items-center gap-1" key={step.key}>
            <div className="flex w-full items-center">
              <div className={`flex size-7 items-center justify-center rounded-full ${dotColor}`}>
                {step.state === "done" ? (
                  <Icon className="size-4" icon="material-symbols:check-rounded" />
                ) : (
                  <span className="text-xs font-medium">{i + 1}</span>
                )}
              </div>
              {!isLast ? <span className={`h-0.5 flex-1 ${lineColor}`} /> : null}
            </div>
            <span
              className={`text-xs ${step.state === "todo" ? "text-shop-text-tertiary" : "text-shop-text-primary"}`}
            >
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
