import {
  mockShippingAddresses,
  type MockShippingAddress,
} from "../fixtures/addresses"

export type MockShippingAddressInput = Omit<MockShippingAddress, "id">

export function listMockAddresses(): MockShippingAddress[] {
  return mockShippingAddresses
}

export function getMockAddress(id: string): MockShippingAddress | null {
  return mockShippingAddresses.find((address) => address.id === id) ?? null
}

export function createMockAddress(
  input: MockShippingAddressInput
): MockShippingAddress {
  return {
    id: "1003",
    ...normalizeDefaultAddress(input),
  }
}

export function updateMockAddress(
  id: string,
  input: MockShippingAddressInput
): MockShippingAddress {
  return {
    id,
    ...normalizeDefaultAddress(input),
  }
}

export function deleteMockAddress(id: string): { deletedId: string } {
  return { deletedId: id }
}

function normalizeDefaultAddress(
  input: MockShippingAddressInput
): MockShippingAddressInput {
  if (!input.isDefault) {
    return input
  }

  return {
    ...input,
    isDefault: true,
  }
}
