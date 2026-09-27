import { createClient } from "@connectrpc/connect";
import type { ShippingAddress as ProtoShippingAddress } from "../gen/sast/sastshopv2/user/v1/address_pb";
import { AddressService } from "../gen/sast/sastshopv2/user/v1/address_service_pb";
import { resolveDataSource, type ServiceOptions } from "../data-source";
import { FeatureUnavailableError, ValidationError } from "../errors";
import { createLocalTransport, requestLocal } from "../local-connect";

export interface ShippingAddress {
  id: string;
  recipientName: string;
  recipientPhone: string;
  province: string;
  city: string;
  district: string;
  detailAddress: string;
  isDefault: boolean;
}

export type ShippingAddressInput = Omit<ShippingAddress, "id">;

export async function listAddresses(
  options: ServiceOptions = {},
): Promise<ShippingAddress[]> {
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(AddressService, createLocalTransport(options));
    const response = await requestLocal("listAddresses", () =>
      client.getAddress({}),
    );

    return response.shippingAddresses.map(mapProtoAddress);
  }

  throw new FeatureUnavailableError("listAddresses");
}

export async function getAddress(
  id: string,
  options: ServiceOptions = {},
): Promise<ShippingAddress> {
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const addressId = parseAddressId(id);
    const client = createClient(AddressService, createLocalTransport(options));
    const response = await requestLocal("getAddress", () =>
      client.getAddress({ addressId }),
    );
    const address = response.shippingAddresses.find(
      (address) => address.id.toString() === id,
    );

    if (!address) {
      throw new FeatureUnavailableError("getAddress");
    }

    return mapProtoAddress(address);
  }

  throw new FeatureUnavailableError("getAddress");
}

export async function createAddress(
  input: ShippingAddressInput,
  options: ServiceOptions = {},
): Promise<ShippingAddress> {
  validateAddressInput(input);

  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(AddressService, createLocalTransport(options));
    const response = await requestLocal("createAddress", () =>
      client.createAddress(input),
    );

    if (!response.shippingAddresses) {
      throw new FeatureUnavailableError("createAddress");
    }

    return mapProtoAddress(response.shippingAddresses);
  }

  throw new FeatureUnavailableError("createAddress");
}

export async function updateAddress(
  id: string,
  input: ShippingAddressInput,
  options: ServiceOptions = {},
): Promise<ShippingAddress> {
  validateAddressInput(input);

  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const addressId = parseAddressId(id);
    const client = createClient(AddressService, createLocalTransport(options));
    const response = await requestLocal("updateAddress", () =>
      client.updateAddress({ addressId, ...input }),
    );

    if (!response.shippingAddresses) {
      throw new FeatureUnavailableError("updateAddress");
    }

    return mapProtoAddress(response.shippingAddresses);
  }

  throw new FeatureUnavailableError("updateAddress");
}

export async function deleteAddress(
  id: string,
  options: ServiceOptions = {},
): Promise<void> {
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const addressId = parseAddressId(id);
    const client = createClient(AddressService, createLocalTransport(options));
    await requestLocal("deleteAddress", () =>
      client.deleteAddress({ addressId }),
    );
    return;
  }

  throw new FeatureUnavailableError("deleteAddress");
}

function parseAddressId(id: string): bigint {
  if (!/^[1-9]\d*$/.test(id)) {
    throw new ValidationError("地址 ID 不正确");
  }

  const parsed = BigInt(id);
  if (parsed > 9223372036854775807n) {
    throw new ValidationError("地址 ID 不正确");
  }
  return parsed;
}

function validateAddressInput(input: ShippingAddressInput) {
  if (!input.recipientName.trim()) {
    throw new ValidationError("收件人不能为空");
  }

  if (!/^1[3-9]\d{9}$/.test(input.recipientPhone)) {
    throw new ValidationError("手机号格式不正确");
  }

  if (
    !input.province.trim() ||
    !input.city.trim() ||
    !input.district.trim() ||
    !input.detailAddress.trim()
  ) {
    throw new ValidationError("地址信息不完整");
  }
}

function mapProtoAddress(address: ProtoShippingAddress): ShippingAddress {
  return {
    id: address.id.toString(),
    recipientName: address.recipientName,
    recipientPhone: address.recipientPhone,
    province: address.province,
    city: address.city,
    district: address.district,
    detailAddress: address.detailAddress,
    isDefault: address.isDefault,
  };
}
