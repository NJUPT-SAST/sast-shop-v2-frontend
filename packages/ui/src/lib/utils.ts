import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs)) //先用 clsx 灵活拼接所有条件样式，再用 twMerge 消除 Tailwind 类冲突
}
