# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

React + Tauri desktop application starter: Next.js 16 (React 19) + Tauri 2.9 + TypeScript + Tailwind CSS v4 + **HeroUI v3** + Zustand + TanStack Query.

**Dual Runtime Model:**

- **Web mode** (`pnpm dev`): Next.js dev server at <http://localhost:3000>
- **Desktop mode** (`pnpm tauri dev`): Tauri wraps Next.js in a native window

## Development Commands

```bash
# Frontend (main app — port 3000)
pnpm dev              # Start Next.js dev server
pnpm build            # Build for production (outputs to out/)
pnpm lint             # Biome lint
pnpm lint:fix         # Biome lint with --write
pnpm format           # Biome format --write
pnpm format:check     # Biome format (check only)
pnpm check            # Biome check --write (lint + format + import sort)
pnpm typecheck        # TypeScript --noEmit

# Testing
pnpm test             # Vitest run (single pass)
pnpm test:watch       # Vitest watch mode
pnpm test:coverage    # Vitest with coverage + JUnit reporter
pnpm test:e2e         # Playwright E2E (auto-starts dev server)
pnpm test:e2e:ui      # Playwright UI mode

# Desktop (Tauri)
pnpm tauri dev        # Dev mode with hot reload
pnpm tauri build      # Build desktop installer
pnpm tauri info       # Check Tauri environment

# Docs site (pnpm workspace — port 3001)
pnpm docs:dev         # Start Fumadocs dev server
pnpm docs:build       # Build docs for production
pnpm docs:start       # Start docs production server
```

## Architecture

### Workspace Structure

This is a **pnpm monorepo** with two packages:

| Package  | Path       | Port | Purpose                                          |
| -------- | ---------- | ---- | ------------------------------------------------ |
| Main app | `/` (root) | 3000 | Next.js + Tauri desktop app (`output: "export"`) |
| Docs     | `docs/`    | 3001 | Fumadocs documentation site (full server mode)   |

Root `pnpm-lock.yaml` is the single lockfile for all packages. Run `pnpm install` from the repo root.

### Frontend Structure (main app)

- `app/` - Next.js App Router (`layout.tsx`, `page.tsx`, `providers.tsx`, `globals.css`)
- `components/` - Application components (HeroUI is consumed directly from `@heroui/react`; no `components/ui/` mirror)
- `hooks/` - Shared hooks (e.g., `use-mobile.ts`)
- `lib/tauri.ts` - Type-safe wrapper around Tauri `invoke`
- `lib/env.ts` - `NEXT_PUBLIC_*` env-var validator
- `e2e/` - Playwright specs

### Docs Structure (`docs/`)

- `docs/app/` - Next.js App Router for the docs site
  - `docs/app/layout.tsx` - Root layout with `RootProvider` (from `fumadocs-ui/provider/next`)
  - `docs/app/docs/layout.tsx` - `DocsLayout` with sidebar
  - `docs/app/docs/[[...slug]]/page.tsx` - Dynamic MDX page
  - `docs/app/api/search/route.ts` - Orama full-text search
- `docs/lib/source.ts` - Fumadocs loader (imports from `collections/server`)
- `docs/source.config.ts` - Content collection definition
- `docs/content/docs/` - MDX content files and `meta.json` sidebar config
- `docs/.source/` - **Auto-generated** by fumadocs-mdx at dev/build time (gitignored)

**Docs-specific import conventions:**

- Source loader: `import { source } from "@/lib/source"` (NOT `@/app/source`)
- Collection output: `import { docs } from "collections/server"` (tsconfig alias → `.source/`)
- Provider: `fumadocs-ui/provider/next` (NOT `fumadocs-ui/provider`)

### HeroUI v3 Usage

All components import directly from `@heroui/react` (no per-component file in this repo):

```tsx
import { Button, Card, Modal, Toast, toast } from "@heroui/react"
```

**v3 conventions you must follow:**

- **No `<HeroUIProvider>`** — v3 removed the provider. Locale-aware components (Calendar, DatePicker) use `<I18nProvider locale="zh-CN">`, mounted in `app/providers.tsx`.
- **Compound components** — `Card.Header`, `Card.Body`, `Card.Footer`, `Toast.Provider`, etc. Don't flatten props.
- **`onPress`, not `onClick`** — Buttons fire `onPress` so React Aria handles keyboard + touch correctly.
- **Variants are semantic** — `primary` / `secondary` / `tertiary` / `outline` / `ghost` / `danger`. Don't pass raw color tokens.
- **BEM class overrides** — extend in `globals.css` under `@layer components` (e.g., `.button--primary { @apply font-semibold; }`).
- **Toast is built in** — `import { toast } from "@heroui/react"`. `<Toast.Provider />` is already mounted in `app/providers.tsx`. No `sonner`.
- **Icons** — use `@iconify/react` (`<Icon icon="mdi:github" />`). HeroUI does not bundle a specific icon set.

### Tauri Integration

- `src-tauri/` - Rust backend
  - `tauri.conf.json` - Config pointing `frontendDist` to `../out`
  - `beforeDevCommand`: runs `pnpm dev`
  - `beforeBuildCommand`: runs `pnpm build`

### Styling System

- **Tailwind v4** via PostCSS (`@tailwindcss/postcss`)
- `@import "tailwindcss"` followed by `@import "@heroui/styles"` — order matters
- CSS variables for theme colors (oklch color space)
- Dark mode: HeroUI reads `data-theme="dark"` on `<html>`

### Path Aliases

`@/components`, `@/lib`, `@/hooks`, `@/i18n` — all configured in tsconfig.json.

### Tooling

- **Lint + format**: Biome (single tool — `biome.json`)
- **Tests**: Vitest (`vitest.config.ts`, `vitest.setup.ts`) + Playwright E2E (`playwright.config.ts`)
- **Git hooks**: lefthook (`lefthook.yml`) — pre-commit runs Biome + tsc, pre-push runs Vitest, commit-msg runs commitlint
- **Package manager**: pnpm 10 (`packageManager` pinned)

## Code Patterns

```tsx
// HeroUI button — onPress + semantic variant
import { Button } from "@heroui/react"

<Button variant="primary" onPress={() => doThing()}>
  Click me
</Button>
```

```tsx
// Compound layout
import { Card } from "@heroui/react"

<Card>
  <Card.Header>
    <Card.Title>Title</Card.Title>
  </Card.Header>
  <Card.Body>Body content</Card.Body>
</Card>
```

```tsx
// Calling Rust from the frontend (Tauri only) — see lib/tauri.ts
import { greet, isTauri } from "@/lib/tauri"
if (isTauri()) {
  greet("World").then((msg) => console.log(msg))
}
```

## Critical Notes

- **Always use pnpm** (lockfile present); run `pnpm install` from repo root to install all workspaces
- **Tauri production builds require static export**: `next.config.ts` (main app) has `output: "export"` — do not remove it
- **Docs does NOT use static export**: `docs/next.config.ts` is full server mode — keep them separate
- **Rust toolchain**: Requires v1.77.2+ for Tauri builds
- **Docs `.source/` is generated**: run `pnpm docs:dev` or `pnpm docs:build` once before TypeScript resolves `collections/server`
- **No `headers()` in `app/layout.tsx`**: Tauri's static export means request headers aren't available at render time. Locale defaults to `zh-CN`; switch via a client hook if you add a language toggle.
