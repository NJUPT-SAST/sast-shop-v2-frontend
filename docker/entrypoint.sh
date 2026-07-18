#!/bin/sh
set -eu

: "${APP_FILTER:?APP_FILTER is required}"
: "${NEXT_PUBLIC_FEISHU_APP_ID:?NEXT_PUBLIC_FEISHU_APP_ID is required}"
: "${NEXT_PUBLIC_APP_ORIGIN:?NEXT_PUBLIC_APP_ORIGIN is required}"
: "${CONNECT_BASE_URL:?CONNECT_BASE_URL is required}"

case "${AUTH_MODE:-required}" in
  required) ;;
  *)
    echo "AUTH_MODE must be required in production" >&2
    exit 1
    ;;
esac

case "${NEXT_PUBLIC_DATA_SOURCE:-}" in
  mock|local) ;;
  remote)
    echo "NEXT_PUBLIC_DATA_SOURCE=remote is not available" >&2
    exit 1
    ;;
  *)
    echo "NEXT_PUBLIC_DATA_SOURCE must be mock or local" >&2
    exit 1
    ;;
esac

node -e '
  const connectUrl = new URL(process.env.CONNECT_BASE_URL);
  const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_ORIGIN);
  if (connectUrl.protocol !== "https:" || connectUrl.username || connectUrl.password) process.exit(1);
  if (appOrigin.protocol !== "https:" || appOrigin.username || appOrigin.password || appOrigin.pathname !== "/" || appOrigin.search || appOrigin.hash) process.exit(1);
' || {
  echo "CONNECT_BASE_URL and NEXT_PUBLIC_APP_ORIGIN must be valid production HTTPS URLs" >&2
  exit 1
}

exec pnpm --filter "$APP_FILTER" start
