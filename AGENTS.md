# Repository Guidelines

## Project Structure & Module Organization

This is a **pnpm monorepo** (`pnpm-workspace.yaml`) with two packages:

| Package  | Root    | Port | Build output                                   |
| -------- | ------- | ---- | ---------------------------------------------- |
| Main app | `/`     | 3000 | `out/` (static export for Tauri)               |
| Docs     | `docs/` | 3001 | `docs/.next/` (server mode, deploy separately) |

Run `pnpm install` from repo root — single `pnpm-lock.yaml` covers all packages.

### Main app (`/`)

- `app/` Next.js App Router (`page.tsx`, `layout.tsx`, `providers.tsx`, global styles in `globals.css`).
- `components/` Application components. **HeroUI is consumed directly from `@heroui/react` — there is no `components/ui/` mirror.**
- `lib/` Shared utilities (`lib/tauri.ts`, `lib/env.ts`).
- `hooks/` Shared hooks (e.g., `hooks/use-mobile.ts`).
- `e2e/` Playwright specs.
- `public/` Static assets (SVGs, icons).
- `src-tauri/` Tauri desktop wrapper (Rust code, config, icons).
- Root configs: `next.config.ts`, `tsconfig.json`, `biome.json`, `lefthook.yml`, `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `postcss.config.mjs`.

### Docs site (`docs/`)

- `docs/app/` Next.js App Router for Fumadocs.
- `docs/lib/source.ts` Fumadocs content loader — import as `@/lib/source`.
- `docs/source.config.ts` Content collection config (points to `content/docs/`).
- `docs/content/docs/` MDX files + `meta.json` sidebar config.
- `docs/.source/` **Auto-generated** at dev/build time (gitignored). Contains `collections/server` module.
- `docs/postcss.config.mjs` + Tailwind v4 CSS in `docs/app/global.css`.

**Critical docs import rules:**

- Always `import { source } from "@/lib/source"` — never `@/app/source`.
- Always `import { RootProvider } from "fumadocs-ui/provider/next"` — not `fumadocs-ui/provider`.
- `collections/server` resolves via tsconfig path alias to `docs/.source/server`. TypeScript errors here mean `.source/` hasn't been generated yet — run `pnpm docs:dev` once.

### HeroUI v3 Usage

All components import directly from `@heroui/react`:

```tsx
import { Button, Card, Modal, toast } from "@heroui/react"
```

**v3 conventions you must follow:**

- **No `<HeroUIProvider>`** — v3 removed the provider. `app/providers.tsx` mounts `<I18nProvider locale={lang}>`, the TanStack Query `QueryClientProvider`, and `<Toast.Provider />`.
- **Compound components** — `Card.Header`, `Card.Body`, `Card.Footer`, `Toast.Provider`, etc. Don't flatten props.
- **`onPress`, not `onClick`** — Buttons fire `onPress` so React Aria handles keyboard + touch correctly.
- **Variants are semantic** — `primary` / `secondary` / `tertiary` / `outline` / `ghost` / `danger`. Don't pass raw color tokens.
- **BEM class overrides** — extend in `globals.css` under `@layer components` (e.g., `.button--primary { @apply font-semibold; }`).
- **Toast is built in** — `import { toast } from "@heroui/react"`. No `sonner`.
- **Icons** — use `@iconify/react` (`<Icon icon="mdi:github" />`). HeroUI does not bundle a specific icon set.

## Build, Test, and Development Commands

```bash
# Main app (port 3000)
pnpm dev              # Start Next.js dev server
pnpm build            # Build for production (outputs to out/)
pnpm lint             # Biome lint
pnpm lint:fix         # Biome lint --write
pnpm format           # Biome format --write
pnpm format:check     # Biome format (check only)
pnpm check            # Biome check --write (lint + format + organize imports)
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

# Docs site (port 3001) — pnpm workspace package at docs/
pnpm docs:dev         # Start Fumadocs dev server (also generates docs/.source/)
pnpm docs:build       # Build docs for production
pnpm docs:start       # Start docs production server
```

## Coding Style & Naming Conventions

- Language: TypeScript with React 19 and Next.js 16.
- Lint + format: `biome.json` is the source of truth — single tool replacing ESLint + Prettier. Keep code warning-free.
- Styling: Tailwind CSS v4 (utility-first) + HeroUI BEM class overrides under `@layer components`. `app/globals.css` imports Tailwind first, then `@heroui/styles`.
- Components: PascalCase names/exports; HeroUI primitives import directly from `@heroui/react`.
- Routes: Next app files are lowercase (`page.tsx`, `layout.tsx`).
- Code: camelCase variables/functions; hooks start with `use*`.

## Testing Guidelines

- **Unit + component**: Vitest + React Testing Library (`@testing-library/react`, `@testing-library/jest-dom/vitest`). Config in `vitest.config.ts`; globals + Next mocks in `vitest.setup.ts`.
- **E2E**: Playwright (`playwright.config.ts` auto-starts `pnpm dev`).
- Name tests `*.test.ts` / `*.test.tsx`; co-locate next to source. E2E specs go in `e2e/`.
- Query by accessible role / name (HeroUI components ship correct ARIA roles) — avoid test IDs.
- Coverage thresholds in `vitest.config.ts`: 70% lines / 60% branches+functions.

## Commit & Pull Request Guidelines

- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `ci:`. Enforced via `commitlint` in the `commit-msg` lefthook.
- `pre-commit` hook runs Biome (`--write` on staged files) + `tsc --noEmit`.
- `pre-push` hook runs `pnpm test` (Vitest).
- Link issues in the footer: `Closes #123`.
- PRs should include: brief scope/intent, screenshots for UI changes, validation steps, and pass `pnpm check` + `pnpm typecheck` + `pnpm test`.
- Keep changes focused; avoid unrelated refactors.

## Security & Configuration Tips

- Use `.env.local` for secrets; do not commit `.env*` files.
- Only expose safe client values via `NEXT_PUBLIC_*` (validated by `lib/env.ts`).
- Tauri: minimize capabilities in `src-tauri/tauri.conf.json`; avoid broad filesystem access.
- The main app uses `output: "export"`, so `headers()` is unavailable in `app/layout.tsx`. Locale defaults to `zh-CN`; switch via a client hook if you add a language toggle.
