// Wrapper around HeroUI's `toast` so call sites can keep a simple
// `notify({ title, color })` API without juggling toast.success / toast.danger.

import { toast as heroToast } from "@heroui/react"

type Color = "success" | "warning" | "danger" | "info" | "default"

export function notify({
  title,
  color = "default",
  description,
}: {
  title: string
  color?: Color
  description?: string
}): void {
  if (color === "success") heroToast.success(title, { description })
  else if (color === "warning") heroToast.warning(title, { description })
  else if (color === "danger") heroToast.danger(title, { description })
  else if (color === "info") heroToast.info(title, { description })
  else heroToast(title, { description })
}
