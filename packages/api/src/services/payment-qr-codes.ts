import { createClient } from "@connectrpc/connect"
import {
  isPaymentQrContentAllowed,
  validatePaymentQrContent,
  type PaymentPlatform,
  type PaymentQrContentValidationReason,
} from "../../../domain/src"
import {
  listMockPaymentQrCodes,
  updateMockPaymentQrCode,
} from "@sast-shop/mocks"
import { Channel } from "../gen/sast/sastshopv2/payment/v1/channel_pb"
import type { QrCode as ProtoQrCode } from "../gen/sast/sastshopv2/payment/v1/qr_code_pb"
import { QrCodeService } from "../gen/sast/sastshopv2/payment/v1/qr_code_service_pb"
import { resolveDataSource, type ServiceOptions } from "../data-source"
import { FeatureUnavailableError, ValidationError } from "../errors"
import { createLocalTransport, requestLocal } from "../local-connect"

export type PaymentQrChannel = "wechat" | "alipay"

export interface PaymentQrCode {
  id: string
  channel: PaymentQrChannel
  content: string
}

export interface PaymentQrCodeInput {
  channel: PaymentQrChannel
  content: string
}

export async function listPaymentQrCodes(
  options: ServiceOptions & { ownerId?: string } = {}
): Promise<PaymentQrCode[]> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock") {
    return listMockPaymentQrCodes().map(mapMockQrCode)
  }

  if (dataSource === "local") {
    const client = createClient(QrCodeService, createLocalTransport(options))
    const ownerId =
      options.ownerId !== undefined
        ? parseInt64(options.ownerId, "收款码用户 ID 不正确")
        : undefined
    const response = await requestLocal("listPaymentQrCodes", () =>
      client.getQrCode({ ownerId })
    )

    return response.qrCodes.map(mapProtoQrCode)
  }

  throw new FeatureUnavailableError("listPaymentQrCodes")
}

export async function updatePaymentQrCode(
  input: PaymentQrCodeInput,
  options: ServiceOptions = {}
): Promise<PaymentQrCode> {
  const validatedInput = validatePaymentQrCodeInput(input)

  const dataSource = resolveDataSource(options)

  if (dataSource === "mock") {
    return mapMockQrCode(updateMockPaymentQrCode(validatedInput))
  }

  if (dataSource === "local") {
    const client = createClient(QrCodeService, createLocalTransport(options))
    const response = await requestLocal("updatePaymentQrCode", () =>
      client.updateQrCode({
        channel: mapPaymentQrChannelToProto(validatedInput.channel),
        content: validatedInput.content,
      })
    )

    if (!response.qrCode) {
      throw new FeatureUnavailableError("updatePaymentQrCode")
    }

    return mapProtoQrCode(response.qrCode)
  }

  throw new FeatureUnavailableError("updatePaymentQrCode")
}

function validatePaymentQrCodeInput(input: PaymentQrCodeInput): PaymentQrCodeInput {
  if (!isPaymentQrChannel(input.channel)) {
    throw new ValidationError("收款码渠道不正确")
  }

  const result = validatePaymentQrContent(input.channel, input.content)

  if (!result.ok) {
    throw new ValidationError(
      getPaymentQrValidationMessage(input.channel, input.content, result.reason)
    )
  }

  return {
    channel: input.channel,
    content: result.content,
  }
}

function parseInt64(value: string, message: string): bigint {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ValidationError(message)
  }

  return BigInt(value)
}

function isPaymentQrChannel(channel: unknown): channel is PaymentQrChannel {
  return channel === "wechat" || channel === "alipay"
}

function getPaymentQrValidationMessage(
  channel: PaymentPlatform,
  content: string,
  reason: PaymentQrContentValidationReason
): string {
  if (reason === "empty") {
    return "收款码内容不能为空"
  }

  if (reason === "too-long") {
    return "收款码内容过长"
  }

  if (reason === "control-character") {
    return "收款码内容包含不支持的字符"
  }

  if (content.trim().startsWith("data:image/")) {
    return "收款码内容不支持，请上传对应渠道的收款码文本"
  }

  if (isPaymentQrContentAllowed(getOtherPaymentQrChannel(channel), content)) {
    return "收款码内容与渠道不匹配"
  }

  return "收款码内容不支持，请上传对应渠道的收款码文本"
}

function getOtherPaymentQrChannel(channel: PaymentPlatform): PaymentPlatform {
  return channel === "wechat" ? "alipay" : "wechat"
}

function mapMockQrCode(qrCode: PaymentQrCode): PaymentQrCode {
  return {
    id: qrCode.id,
    channel: qrCode.channel,
    content: qrCode.content,
  }
}

function mapProtoQrCode(qrCode: ProtoQrCode): PaymentQrCode {
  return {
    id: qrCode.id.toString(),
    channel: mapPaymentQrChannelFromProto(qrCode.channel),
    content: qrCode.content,
  }
}

function mapPaymentQrChannelFromProto(channel: Channel): PaymentQrChannel {
  if (channel === Channel.WECHAT) {
    return "wechat"
  }

  if (channel === Channel.ALIPAY) {
    return "alipay"
  }

  throw new FeatureUnavailableError("paymentQrChannel")
}

function mapPaymentQrChannelToProto(channel: PaymentQrChannel): Channel {
  if (channel === "wechat") {
    return Channel.WECHAT
  }

  if (channel === "alipay") {
    return Channel.ALIPAY
  }

  throw new ValidationError("收款码渠道不正确")
}
