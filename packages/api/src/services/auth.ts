import { getMockCurrentUser, loginWithMockCode } from "@sast-shop/mocks"
import { resolveDataSource, type ServiceOptions } from "../data-source"
import { FeatureUnavailableError } from "../errors"

export async function getCurrentUser(options: ServiceOptions = {}) {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock") {
    return getMockCurrentUser()
  }

  throw new FeatureUnavailableError("getCurrentUser")
}

export async function loginWithLarkCode(code: string, options: ServiceOptions = {}) {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock") {
    return loginWithMockCode(code)
  }

  throw new FeatureUnavailableError("loginWithLarkCode")
}
