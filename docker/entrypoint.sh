#!/bin/sh
set -eu

: "${APP_NAME:?APP_NAME is required}"
: "${PORT:?PORT is required}"
: "${NEXT_PUBLIC_FEISHU_APP_ID:?NEXT_PUBLIC_FEISHU_APP_ID is required}"
: "${NEXT_PUBLIC_APP_ORIGIN:?NEXT_PUBLIC_APP_ORIGIN is required}"
: "${NEXT_PUBLIC_FEISHU_REDIRECT_URI:?NEXT_PUBLIC_FEISHU_REDIRECT_URI is required}"
: "${SESSION_COOKIE_SECRET:?SESSION_COOKIE_SECRET is required}"
: "${CONNECT_BASE_URL:?CONNECT_BASE_URL is required}"
: "${CONNECT_HEALTH_URL:?CONNECT_HEALTH_URL is required}"

case "$APP_NAME:$PORT" in
  mobile:3001|desktop:3002) ;;
  *)
    echo "APP_NAME and PORT do not identify a supported service" >&2
    exit 1
    ;;
esac

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

case "${NEXT_PUBLIC_FORCE_FEISHU_UI:-false}" in
  false|"") ;;
  *)
    echo "NEXT_PUBLIC_FORCE_FEISHU_UI must be disabled in production" >&2
    exit 1
    ;;
esac

if [ "${#SESSION_COOKIE_SECRET}" -lt 32 ]; then
  echo "SESSION_COOKIE_SECRET must contain at least 32 characters" >&2
  exit 1
fi

node -e '
  const urls = [
    ["CONNECT_BASE_URL", process.env.CONNECT_BASE_URL, false, false],
    ["CONNECT_HEALTH_URL", process.env.CONNECT_HEALTH_URL, false, false],
    ["NEXT_PUBLIC_APP_ORIGIN", process.env.NEXT_PUBLIC_APP_ORIGIN, true, false],
    ["NEXT_PUBLIC_FEISHU_REDIRECT_URI", process.env.NEXT_PUBLIC_FEISHU_REDIRECT_URI, true, false],
  ];
  const feedbackFormUrl = process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL;
  if (feedbackFormUrl) {
    urls.push(["NEXT_PUBLIC_FEEDBACK_FORM_URL", feedbackFormUrl, false, true]);
  }
  for (const [name, value, originOnly, allowQueryAndHash] of urls) {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error(name);
    if (!allowQueryAndHash && (url.search || url.hash)) throw new Error(name);
    if (originOnly && url.pathname !== "/") throw new Error(name);
    if (name === "NEXT_PUBLIC_FEISHU_REDIRECT_URI" && url.origin !== new URL(process.env.NEXT_PUBLIC_APP_ORIGIN).origin) throw new Error(name);
    if (name === "NEXT_PUBLIC_FEEDBACK_FORM_URL") {
      const allowedHosts = ["feishu.cn", "larksuite.com"];
      if (!allowedHosts.some((root) => url.hostname === root || url.hostname.endsWith(`.${root}`))) throw new Error(name);
    }
  }
' || {
  echo "production URLs must use HTTPS and must not contain credentials" >&2
  exit 1
}

server_path="/app/apps/$APP_NAME/server.js"
if [ ! -f "$server_path" ]; then
  echo "standalone server is missing for $APP_NAME" >&2
  exit 1
fi

exec node "$server_path"
