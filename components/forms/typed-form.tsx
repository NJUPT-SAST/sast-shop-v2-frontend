"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  type DefaultValues,
  type FieldValues,
  FormProvider,
  type UseFormProps,
  type UseFormReturn,
  useForm,
  useFormContext,
} from "react-hook-form"
import type { ZodType } from "zod"

type Options<TInput extends FieldValues> = Omit<
  UseFormProps<TInput>,
  "resolver" | "defaultValues" | "mode" | "reValidateMode"
> & {
  defaultValues: DefaultValues<TInput>
  mode?: UseFormProps<TInput>["mode"]
  reValidateMode?: UseFormProps<TInput>["reValidateMode"]
}

// Standardized form bootstrap: zod resolver + onTouched validation + onChange revalidation.
// Use this in every form so error UX is consistent across the app.
export function useTypedForm<TInput extends FieldValues, TOutput = TInput>(
  schema: ZodType<TOutput, TInput>,
  options: Options<TInput>
): UseFormReturn<TInput> {
  const { mode = "onTouched", reValidateMode = "onChange", ...rest } = options
  // biome-ignore lint/suspicious/noExplicitAny: zodResolver typing is broad; safe at runtime.
  const resolver = zodResolver(schema as any) as any
  return useForm<TInput>({
    mode,
    reValidateMode,
    resolver,
    ...rest,
  })
}

export { FormProvider, useFormContext }
