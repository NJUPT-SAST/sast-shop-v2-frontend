FROM node:22-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ARG APP_FILTER
RUN pnpm --filter "$APP_FILTER" build

FROM base AS runner
ENV NODE_ENV=production
ARG APP_FILTER
ENV APP_FILTER=$APP_FILTER
COPY --from=builder /app /app
CMD ["sh", "-c", "pnpm --filter \"$APP_FILTER\" start"]
