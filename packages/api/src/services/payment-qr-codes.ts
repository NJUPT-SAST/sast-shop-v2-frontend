import { createClient } from "@connectrpc/connect"
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
  options: ServiceOptions = {}
): Promise<PaymentQrCode[]> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock") {
    return listMockPaymentQrCodes().map(mapMockQrCode)
  }

  if (dataSource === "local") {
    const client = createClient(QrCodeService, createLocalTransport(options))
    const response = await requestLocal("listPaymentQrCodes", () =>
      client.getQrCode({})
    )

    return response.qrCodes.map(mapProtoQrCode)
  }

  throw new FeatureUnavailableError("listPaymentQrCodes")
}

export async function updatePaymentQrCode(
  input: PaymentQrCodeInput,
  options: ServiceOptions = {}
): Promise<PaymentQrCode> {
  validatePaymentQrCodeInput(input)

  const dataSource = resolveDataSource(options)

  if (dataSource === "mock") {
    return mapMockQrCode(updateMockPaymentQrCode(input))
  }

  if (dataSource === "local") {
    const client = createClient(QrCodeService, createLocalTransport(options))
    const response = await requestLocal("updatePaymentQrCode", () =>
      client.updateQrCode({
        channel: mapPaymentQrChannelToProto(input.channel),
        content: input.content,
      })
    )

    if (!response.qrCode) {
      throw new FeatureUnavailableError("updatePaymentQrCode")
    }

    return mapProtoQrCode(response.qrCode)
  }

  throw new FeatureUnavailableError("updatePaymentQrCode")
}

function validatePaymentQrCodeInput(input: PaymentQrCodeInput) {
  if (!input.content.trim()) {
    throw new ValidationError("收款码内容不能为空")
  }
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

  return Channel.ALIPAY
}
