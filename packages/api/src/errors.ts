export class FeatureUnavailableError extends Error {
  constructor(feature: string) {
    super(`${feature} is not available for the selected data source`)
    this.name = "FeatureUnavailableError"
  }
}

export class ApiRequestError extends Error {
  constructor(feature: string, cause?: unknown) {
    super(`${feature} request failed`, { cause })
    this.name = "ApiRequestError"
  }
}

export class ApiConfigurationError extends Error {
  constructor(key: string) {
    super(`${key} must be configured`)
    this.name = "ApiConfigurationError"
  }
}

export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication is required")
    this.name = "AuthRequiredError"
  }
}
