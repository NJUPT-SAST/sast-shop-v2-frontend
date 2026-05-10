export type PublicEnv = {
  appName: string
  apiUrl: string
}

const REQUIRED = ["NEXT_PUBLIC_APP_NAME"] as const

/**
 * Reads NEXT_PUBLIC_* env vars and validates required ones.
 * Throws on first call if a required var is missing — see .env.example.
 *
 * `apiUrl` defaults to `/api` so the same client works in dev (proxied via
 * next.config rewrites) and prod (Nginx routes /api/* to Go).
 */
export function getPublicEnv(): PublicEnv {
  const missing = REQUIRED.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required public env vars: ${missing.join(", ")}. See .env.example.`)
  }
  return {
    appName: process.env.NEXT_PUBLIC_APP_NAME as string,
    apiUrl: process.env.NEXT_PUBLIC_API_URL || "/api",
  }
}
