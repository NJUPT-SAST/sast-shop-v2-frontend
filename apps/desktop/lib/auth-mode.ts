import "server-only"

export type AuthMode = "off" | "required"

const supportedAuthModes = new Set<AuthMode>(["off", "required"])
const defaultAuthMode: AuthMode =
  process.env.NODE_ENV === "production" ? "required" : "off"

export function parseAuthMode(value: string | undefined): AuthMode {
  return value !== undefined && supportedAuthModes.has(value as AuthMode)
    ? (value as AuthMode)
    : defaultAuthMode
}

export function getServerAuthMode(): AuthMode {
  const value = process.env.AUTH_MODE
  if (value !== undefined && !supportedAuthModes.has(value as AuthMode)) {
    throw new Error("AUTH_MODE must be either off or required")
  }
  const mode = parseAuthMode(value)
  if (process.env.NODE_ENV === "production" && mode === "off") {
    throw new Error("AUTH_MODE=off is not allowed in production")
  }
  return mode
}
