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

export class ResourceNotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} was not found`)
    this.name = "ResourceNotFoundError"
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

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ValidationError"
  }
}
