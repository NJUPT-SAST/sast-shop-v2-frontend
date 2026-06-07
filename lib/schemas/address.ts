import { z } from "zod"

// CN mobile phone: 11 digits, starts with 1[3-9].
const phoneRegex = /^1[3-9]\d{9}$/

export const addressSchema = z.object({
  recipient: z.string().min(1, "请填写收件人").max(20, "姓名过长"),
  phone: z.string().min(1, "请填写电话").regex(phoneRegex, "请输入正确的手机号"),
  province: z.string().max(20).optional(),
  city: z.string().max(20).optional(),
  district: z.string().max(20).optional(),
  detail: z.string().min(2, "请填写详细地址").max(200, "详细地址过长"),
  isDefault: z.boolean().optional(),
})

export type AddressInput = z.infer<typeof addressSchema>
