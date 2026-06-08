export class FeatureUnavailableError extends Error {
  constructor(feature: string) {
    super(`${feature} is not available for the selected data source`)
    this.name = "FeatureUnavailableError"
  }
}

export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication is required")
    this.name = "AuthRequiredError"
  }
}
