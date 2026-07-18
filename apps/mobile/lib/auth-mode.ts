export type AuthMode = "off" | "required"

const supportedAuthModes = new Set<AuthMode>(["off", "required"])
const defaultAuthMode: AuthMode =
  process.env.NODE_ENV === "production" ? "required" : "off"

export interface AuthModeFallback {
  providedValue: string
  fallbackValue: AuthMode
}

export function isAuthMode(value: string | undefined): value is AuthMode {
  return value !== undefined && supportedAuthModes.has(value as AuthMode)
}

export function parseAuthMode(value: string | undefined): AuthMode {
  return isAuthMode(value) ? value : defaultAuthMode
}

export function resolveAuthModeFallback(
  value: string | undefined,
): AuthModeFallback | null {
  return value !== undefined && !isAuthMode(value)
    ? {
        providedValue: value,
        fallbackValue: defaultAuthMode,
      }
    : null
}

export function getServerAuthMode(): AuthMode {
  return resolveServerAuthMode(process.env.AUTH_MODE, process.env.NODE_ENV)
}

export function resolveServerAuthMode(
  value: string | undefined,
  nodeEnv: string | undefined,
): AuthMode {
  if (value !== undefined && !isAuthMode(value)) {
    throw new Error("AUTH_MODE must be either off or required")
  }

  const mode = value ?? (nodeEnv === "production" ? "required" : "off")
  if (nodeEnv === "production" && mode === "off") {
    throw new Error("AUTH_MODE=off is not allowed in production")
  }

  return mode
}
