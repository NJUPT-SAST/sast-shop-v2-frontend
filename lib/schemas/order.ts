import { z } from "zod"

export const createOrderSchema = z.object({
  listing_id: z.string().uuid(),
  quantity: z.number().int().min(1, "数量至少为 1"),
  shipping_address: z.string().max(500).optional(),
  remark: z.string().max(500).optional(),
})

export type CreateOrderFormInput = z.infer<typeof createOrderSchema>

export const confirmReceiptSchema = z
  .object({
    payment_code: z
      .string()
      .regex(/^\d{4}$/, "请输入 4 位备注码")
      .optional()
      .or(z.literal("")),
    payment_trade_no: z.string().min(4).max(64).optional().or(z.literal("")),
  })
  .refine((v) => Boolean(v.payment_code) || Boolean(v.payment_trade_no), {
    message: "请至少填写备注码或交易流水号",
    path: ["payment_code"],
  })

export const setShippingFeeSchema = z.object({
  shipping_fee: z.string().regex(/^\d+(\.\d{1,2})?$/, "金额格式错误"),
  shipping_qr_url: z.string().url("请上传运费二维码"),
})

export const shipOrderSchema = z.object({
  carrier: z.string().min(1, "请填写承运商"),
  tracking_number: z.string().min(4, "请填写运单号"),
})
