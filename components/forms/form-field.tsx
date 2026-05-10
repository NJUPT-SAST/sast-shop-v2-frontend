"use client"

import { type ReactElement, type ReactNode, cloneElement, isValidElement } from "react"
import { useFormContext } from "react-hook-form"

type RenderProps = {
  value: unknown
  onChange: (value: unknown) => void
  onBlur: () => void
  invalid: boolean
  describedBy?: string
}

type Props = {
  name: string
  label?: ReactNode
  hint?: ReactNode
  required?: boolean
  /** Surface character count `count / maxLength` underneath the field. */
  maxLength?: number
  className?: string
  /**
   * Either pass a single child (its `value`/`onChange`/`onBlur` will be wired)
   * or a render-fn for full control (Radio groups, custom widgets, etc.).
   */
  children: ReactNode | ((props: RenderProps) => ReactNode)
}

// Wraps any input with a uniform label/hint/error/char-count surround that
// reads from RHF context via the field name. Use everywhere instead of bare
// HeroUI inputs so error UX is consistent.
export function FormField({ name, label, hint, required, maxLength, className, children }: Props) {
  const ctx = useFormContext()
  if (!ctx) {
    throw new Error("FormField must be used inside a <FormProvider>")
  }

  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = ctx
  const error = (errors[name]?.message as string | undefined) ?? undefined
  const value = watch(name)
  const invalid = Boolean(error)
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined

  function handleChange(next: unknown) {
    setValue(name, next as never, { shouldValidate: true, shouldDirty: true, shouldTouch: true })
  }

  // Trigger validation on blur for fields that don't go through render-fn.
  const blurHandlers = register(name)

  function renderChildren(): ReactNode {
    if (typeof children === "function") {
      return children({
        value,
        onChange: handleChange,
        onBlur: () => blurHandlers.onBlur({ target: { name }, type: "blur" } as never),
        invalid,
        describedBy,
      })
    }
    if (isValidElement(children)) {
      const childProps = (children as ReactElement<Record<string, unknown>>).props ?? {}
      return cloneElement(children as ReactElement<Record<string, unknown>>, {
        ...childProps,
        // biome-ignore lint/suspicious/noExplicitAny: passes through to HeroUI input
        value: value ?? (childProps.value as any) ?? "",
        onChange: (next: unknown) => {
          // HeroUI TextField onChange passes string; native inputs pass an event.
          if (next && typeof next === "object" && "target" in next) {
            const ev = next as { target: { value: unknown } }
            handleChange(ev.target.value)
          } else {
            handleChange(next)
          }
          if (typeof childProps.onChange === "function") {
            ;(childProps.onChange as (n: unknown) => void)(next)
          }
        },
        onBlur: () => {
          blurHandlers.onBlur({ target: { name }, type: "blur" } as never)
          if (typeof childProps.onBlur === "function") {
            ;(childProps.onBlur as () => void)()
          }
        },
        "aria-invalid": invalid || undefined,
        "aria-describedby": describedBy,
      })
    }
    return children
  }

  const valueLength =
    typeof value === "string" ? value.length : Array.isArray(value) ? value.length : 0

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      {label ? (
        <label
          className="flex items-center gap-1 text-[13px] font-medium text-shop-text-secondary"
          htmlFor={name}
        >
          {label}
          {required ? (
            <span aria-hidden className="text-shop-danger">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      <div className="shop-input-group">{renderChildren()}</div>
      <div className="flex min-h-[16px] items-start justify-between gap-3 text-[12px]">
        <div className="flex-1">
          {error ? (
            <p className="text-shop-danger" id={`${name}-error`} role="alert">
              {error}
            </p>
          ) : hint ? (
            <p className="text-shop-text-tertiary" id={`${name}-hint`}>
              {hint}
            </p>
          ) : null}
        </div>
        {maxLength ? (
          <span
            aria-live="polite"
            className={`shrink-0 tabular-nums ${valueLength > maxLength ? "text-shop-danger" : "text-shop-text-tertiary"}`}
          >
            {valueLength} / {maxLength}
          </span>
        ) : null}
      </div>
    </div>
  )
}
