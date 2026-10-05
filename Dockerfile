# syntax=docker/dockerfile:1.7

FROM node:26-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@11.5.1 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY apps/desktop/package.json ./apps/desktop/package.json
COPY packages/api/package.json ./packages/api/package.json
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/ui/package.json ./packages/ui/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS builder
ARG APP_NAME
ARG APP_FILTER
ARG APP_PORT
ARG NEXT_PUBLIC_DATA_SOURCE
ARG NEXT_PUBLIC_APP_ORIGIN
ARG NEXT_PUBLIC_FEISHU_APP_ID
ARG NEXT_PUBLIC_FEISHU_REDIRECT_URI
ARG NEXT_PUBLIC_FEEDBACK_FORM_URL
ARG BUILD_REVISION=unknown
ENV NEXT_PUBLIC_DATA_SOURCE=$NEXT_PUBLIC_DATA_SOURCE
ENV NEXT_PUBLIC_APP_ORIGIN=$NEXT_PUBLIC_APP_ORIGIN
ENV NEXT_PUBLIC_FEISHU_APP_ID=$NEXT_PUBLIC_FEISHU_APP_ID
ENV NEXT_PUBLIC_FEISHU_REDIRECT_URI=$NEXT_PUBLIC_FEISHU_REDIRECT_URI
ENV NEXT_PUBLIC_FEEDBACK_FORM_URL=$NEXT_PUBLIC_FEEDBACK_FORM_URL
RUN case "$APP_NAME" in mobile|desktop) ;; *) exit 1 ;; esac \
    && test -n "$APP_FILTER" \
    && test -n "$APP_PORT" \
    && test -n "$NEXT_PUBLIC_DATA_SOURCE" \
    && test -n "$NEXT_PUBLIC_APP_ORIGIN" \
    && test -n "$NEXT_PUBLIC_FEISHU_APP_ID" \
    && test -n "$NEXT_PUBLIC_FEISHU_REDIRECT_URI"
COPY . .
RUN pnpm --filter "$APP_FILTER" build

FROM node:26-alpine AS runner
WORKDIR /app
ARG APP_NAME
ARG APP_PORT
ARG NEXT_PUBLIC_DATA_SOURCE
ARG NEXT_PUBLIC_APP_ORIGIN
ARG NEXT_PUBLIC_FEISHU_APP_ID
ARG NEXT_PUBLIC_FEISHU_REDIRECT_URI
ARG NEXT_PUBLIC_FEEDBACK_FORM_URL
ARG BUILD_REVISION=unknown
LABEL org.opencontainers.image.source="https://github.com/NJUPT-SAST/sast-shop-v2-frontend" \
      org.opencontainers.image.revision="$BUILD_REVISION"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV APP_NAME=$APP_NAME
ENV PORT=$APP_PORT
ENV NEXT_PUBLIC_DATA_SOURCE=$NEXT_PUBLIC_DATA_SOURCE
ENV NEXT_PUBLIC_APP_ORIGIN=$NEXT_PUBLIC_APP_ORIGIN
ENV NEXT_PUBLIC_FEISHU_APP_ID=$NEXT_PUBLIC_FEISHU_APP_ID
ENV NEXT_PUBLIC_FEISHU_REDIRECT_URI=$NEXT_PUBLIC_FEISHU_REDIRECT_URI
ENV NEXT_PUBLIC_FEEDBACK_FORM_URL=$NEXT_PUBLIC_FEEDBACK_FORM_URL
ENV NEXT_PUBLIC_FORCE_FEISHU_UI=false
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/public ./apps/${APP_NAME}/public
COPY --chown=nextjs:nodejs docker/entrypoint.sh /usr/local/bin/sast-shop-entrypoint
RUN chmod 0555 /usr/local/bin/sast-shop-entrypoint \
    && mkdir -p "/app/apps/${APP_NAME}/.next/cache" \
    && chown -R nextjs:nodejs "/app/apps/${APP_NAME}/.next/cache"
USER nextjs
EXPOSE $APP_PORT
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health/live').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/local/bin/sast-shop-entrypoint"]
