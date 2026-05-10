# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SAST Shop v2 frontend** — campus marketplace for 南邮 SAST: secondhand (`secondhand`), crowdfunding (`crowdfund`, with `vote_first` and `presale` modes), and official direct sale (`direct_sale`). Stack: Next.js 16 (App Router, React 19) + Tauri 2.9 wrapper + TypeScript strict + Tailwind v4 + **HeroUI v3** + TanStack Query + Zustand + Zod + react-hook-form. UI copy is Chinese (`zh-CN`) by default.

**Dual runtime:** `pnpm dev` runs the Next.js dev server at <http://localhost:3000>; `pnpm tauri dev` wraps the same build in a native window. The `next.config.ts` is locked to `output: "export"` because Tauri loads the static `out/` directory — do not remove it, and do not introduce APIs that require a Node server (no `headers()`, no Route Handlers, no server actions in the main app).

## Development Commands

```bash
pnpm dev              # Next.js dev server (port 3000) — also auto-started by Tauri & Playwright
pnpm build            # Static export to out/ (Tauri reads from here)
pnpm check            # Biome: lint + format + organize imports (write)
pnpm typecheck        # tsc --noEmit
pnpm test             # Vitest single pass; pnpm test path/to/file.test.ts to scope
pnpm test:watch       # Vitest watch
pnpm test:coverage    # Vitest with v8 coverage + JUnit; thresholds enforced (lines 70 / fns 60 / branches 60)
pnpm test:e2e         # Playwright (auto-starts dev server via webServer config)
pnpm test:e2e:ui      # Playwright UI mode
pnpm tauri dev        # Tauri shell (uses @tauri-apps/cli binary; pnpm resolves it)
pnpm tauri build      # Build desktop installer
pnpm docs:dev         # Fumadocs site at port 3001 (separate workspace under docs/)
```

The Go backend is expected at `localhost:8080`. `next.config.ts` rewrites `/api/*` there in dev — set `NEXT_PUBLIC_API_PROXY_TARGET` to override. In production (Tauri / Nginx), the same `/api` path is served externally; set `NEXT_PUBLIC_API_URL` to call a different host.

## Architecture

### Route groups (`app/`)

Three top-level destinations, each backed by a "shell" client component that owns the auth boundary and chrome:

| Path                | Layout                       | Shell file                 | `AuthGuard` mode | Purpose                              |
| ------------------- | ---------------------------- | -------------------------- | ---------------- | ------------------------------------ |
| `app/(shop)/...`    | `app/(shop)/layout.tsx`      | `shop-shell.tsx`           | `anonymous-ok`   | Buyer storefront (browse / order)    |
| `app/admin/...`     | `app/admin/layout.tsx`       | `admin-shell.tsx`          | `admin`          | Admin console (reviews / listings)   |
| `app/auth/callback` | (none)                       | inline                     | —                | Feishu OAuth landing → invalidate `authMe` → `router.replace(redirect)` |

Both shells render `PCSidebar` + `MobileTabBar` (responsive split) and gate children through `AuthGuard`. The `(shop)` route group is required because `app/(shop)/page.tsx` is the literal `/` route — never move it to a top-level `app/page.tsx`.

### Data layer (`lib/api/`)

Strict pipeline. Components must not call `fetch` directly; **only `lib/api/queries.ts` calls `lib/api/client.ts`**, and only `client.ts` calls `fetch`. Order:

1. `endpoints.ts` — every URL string lives here (`endpoints.orders.pay(id)` etc.); makes API-doc verification a single grep.
2. `client.ts` — `request<T>()` wrapper. Owns: base-URL selection, `credentials: "include"` cookies, JSON serialization, `Idempotency-Key` (only when `idempotent: true` — currently `useCreateOrder`), 401 → `onUnauthorized` callback, error normalization into `ApiError`.
3. `queries.ts` — TanStack Query hooks. Owns query keys (`queryKeys.*`), invalidation strategy, optimistic updates, and the order-detail polling loop (5s while `pending_payment` / `pending_confirm` / `awaiting_payment`).
4. `types.ts` — domain types + `as const` enum arrays so unions can be both compile-time types and runtime iterables (used by filter dropdowns).

`providers.tsx` registers the unauthorized handler exactly once: a 401 redirects the browser to `/api/auth/feishu/login?redirect=<here>`. Inside Tauri, the same URL is opened externally via `openExternal` (currently a clipboard fallback — see `lib/tauri.ts`).

### State stores (`lib/stores/`, Zustand)

- `auth-store.ts` — synchronous read mirror of `useAuthMe`. The writer is `AuthGuard` (the only place that calls `setUser`); everywhere else uses `useAuthStore` selectors. Helpers: `selectIsAuthenticated`, `selectIsAdmin`.
- `upload-store.ts` — in-flight image uploads keyed by id, used by `ImageUpload` + listing forms to gate submit until all PUTs succeed.

### Order state machine (`lib/utils/order-state.ts`)

Order pages are dumb; this module derives the 13 `OrderViewKey`s from the `(status, shipping_mode, shipping_status, payment_mode)` tuple. When changing order behavior, **edit this module and its tests** — never sprinkle new conditions into components. Provides:

- `getOrderViewKey(order)` / `getOrderLabel(order)` — current view + badge/label
- `getOrderProgressSteps(order)` — 5-step indicator
- `getBuyerActions(order)` / `getSellerActions(order)` — what buttons to render

The variable-shipping-fee branch (`shipping_fee_pending` / `paying` / `paid`) only applies between `paid` and `shipped`; everything else falls back to the main flow.

### Schemas (`lib/schemas/`)

Zod. `listing.ts` is a discriminated union over `type` (`secondhand` | `crowdfund` | `direct_sale`). `crowdfund` is further split by `cf_mode` (`vote_first` | `presale`); since Zod doesn't support nested discriminated unions on a single field, the four schemas (`secondhand`, `voteFirst`, `presale`, `directSale`) are exposed flat and the form is responsible for setting both `type` and `cf_mode`.

### Image upload flow

`components/image-upload.tsx`:

1. `browser-image-compression` → max 2 MB / 1920px
2. `usePresign({ purpose })` returns `{ upload_url, method, headers, public_url }`
3. PUT/POST the blob to `upload_url` directly (not through `client.ts`)
4. Push `public_url` into the listing-form draft

Valid `purpose` values are listed in `PRESIGN_PURPOSES` (`listing_image`, `qr_code`, `shipping_qr`, `avatar`).

### HeroUI v3 conventions (project-specific subset)

Components are imported directly from `@heroui/react` — there is no `components/ui/` mirror. v3 differs from v2 in ways that matter here:

- **No `<HeroUIProvider>`**. Locale-aware components use `<I18nProvider locale="zh-CN">`, mounted in `app/providers.tsx`.
- **Compound components** — `Card.Header`, `Card.Body`, `Toast.Provider`, `Radio.Control` / `Radio.Indicator` / `Radio.Content`. See `components/listing-form/shared.tsx` for the `Radio` shape.
- **`onPress`, not `onClick`** on Buttons (React Aria handles keyboard + touch).
- **Semantic variants** — `primary` / `secondary` / `tertiary` / `outline` / `ghost` / `danger`. No raw color tokens.
- **Toast** — `import { toast } from "@heroui/react"`. `<Toast.Provider />` is mounted globally; do not add `sonner`.
- **Icons** — `@iconify/react` (`<Icon icon="material-symbols:..." />`). HeroUI doesn't bundle icons.

When in doubt about a v3 component, use the `heroui-react` MCP (`mcp__heroui-react__list_components`, `get_component_docs`) — the API is still beta and training data drifts.

### Styling: `shop-*` design tokens

`app/globals.css` defines two parallel color systems:

1. **HeroUI tokens** (`--accent`, oklch space) — drive HeroUI components.
2. **`shop-*` tokens** (hex, with `[data-theme="dark"]` overrides) — drive everything else through Tailwind v4's `@theme inline` block, exposing classes like `bg-shop-bg-page`, `text-shop-text-primary`, `text-shop-warning`, `bg-shop-primary-light`. Source of truth is `design/sast-shop.pen` (open in Pencil to view).

Order matters: `@import "tailwindcss"` first, `@import "@heroui/styles"` second.

### Tauri integration

- `src-tauri/tauri.conf.json` — `frontendDist: "../out"`, `beforeDevCommand: pnpm dev`, `beforeBuildCommand: pnpm build`. The Tauri production CSP lives in this file; if you call a new external origin from the browser, add it to `connect-src` or the request will be blocked.
- `lib/tauri.ts` is the **only** caller of `invoke()`. Add new Rust commands as named exports here; gate UI calls with `isTauri()` so they're no-ops in web mode.
- `openExternal(url)` currently writes to clipboard inside Tauri (the shell plugin isn't wired). Replace with `@tauri-apps/plugin-shell` when adding it.

### Tooling

- **Lint + format**: Biome (`biome.json`). `pnpm check` is the catch-all.
- **Tests**: Vitest (jsdom, coverage thresholds enforced; excludes `e2e/`, `src-tauri/`, `out/`) + Playwright. `vitest.config.ts` excludes `app/**/page.tsx` and `app/**/layout.tsx` from coverage on purpose — those are entry points covered by E2E.
- **Git hooks** (`lefthook.yml`): pre-commit runs Biome `check --write` + `pnpm typecheck`; commit-msg runs commitlint (Conventional Commits); pre-push runs `pnpm test`. Don't `--no-verify` past these — fix the underlying issue.

## Critical notes

- **Single fetch owner**: never call `fetch`, `axios`, or `useQuery` outside `lib/api/queries.ts`. Components consume hooks; hooks consume `api.*` from `client.ts`.
- **Static export constraints**: no `headers()`, no Route Handlers, no server actions, no dynamic `generateMetadata` based on request. Locale is hard-coded to `zh-CN` in `app/layout.tsx` for this reason.
- **OAuth redirect target**: 401s only redirect *once per session* (`redirected` flag in `providers.tsx`) to avoid loops if the backend is down.
- **Order detail polls** (`useOrder`) — 5s while waiting for backend confirmation. If you add a new "waiting" status, update the `refetchInterval` predicate too.
- **Order creation is idempotent** — `useCreateOrder` sets `idempotent: true` so `client.ts` injects `Idempotency-Key`. Don't strip it; the backend dedupes on retry.
- **`lib/api/types.ts` mirrors the API doc** (Feishu wiki `DMvtwCoxtiRKOiksCQRc2S2Dnte` §8 + DB schema). When the contract changes, update the `as const` arrays *and* the form schemas in `lib/schemas/` together.
- **`design/sast-shop.pen` is encrypted** — never `Read`/`Grep` it; use the `pencil` MCP (`mcp__pencil__*`).
- **Docs subworkspace** lives in `docs/` (Fumadocs, full server mode). It does NOT inherit `output: "export"`. Run `pnpm docs:dev` (or `:build`) once before TypeScript can resolve `collections/server`. Docs is not loaded by the main app build.
- **Rust toolchain** ≥ 1.77.2 for Tauri builds.
