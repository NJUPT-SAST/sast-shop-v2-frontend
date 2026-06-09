export type AuthMode = "off" | "required"

const supportedAuthModes = new Set<AuthMode>(["off", "required"])

export interface AuthModeFallback {
  providedValue: string
  fallbackValue: AuthMode
}

export function isAuthMode(value: string | undefined): value is AuthMode {
  return value !== undefined && supportedAuthModes.has(value as AuthMode)
}

export function parseAuthMode(value: string | undefined): AuthMode {
  return isAuthMode(value) ? value : "off"
}

export function resolveAuthModeFallback(
  value: string | undefined,
): AuthModeFallback | null {
  return value !== undefined && !isAuthMode(value)
    ? {
        providedValue: value,
        fallbackValue: "off",
      }
    : null
}
