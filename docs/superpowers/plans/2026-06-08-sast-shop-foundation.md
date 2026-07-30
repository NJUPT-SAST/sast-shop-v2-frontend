# SAST Shop Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current single Next.js template into a shadcn monorepo foundation with separate mobile and desktop apps, shared UI/domain/API/mock packages, and Caddy subdomain routing.

**Architecture:** The root becomes a plain pnpm workspace. `apps/mobile` and `apps/desktop` are separate Next.js apps that do not share page code. `packages/ui`, `packages/domain`, `packages/api`, and `packages/mocks` hold reusable components, business logic, data source selection, and mock fixtures.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn-style workspace UI package, local/system font stacks, pnpm workspaces, Vitest for package-level tests, Caddy for deployment routing.

---

## Scope Check

The full MVP spec covers multiple subsystems: auth, profile, catalog, spot, errand, orders, payments, mobile UI, desktop UI, and deployment. This plan intentionally implements only the foundation milestone. It produces a working, testable monorepo with app shells and data-source plumbing so subsequent feature plans can build vertical business flows without reshaping the repository again.

All app shells and shared styles must use local or system fonts only. Do not import from `next/font/google`, do not reference Google Fonts stylesheets, and do not introduce build-time remote font fetching.

## File Structure

Create or modify these files:

```text
package.json
pnpm-workspace.yaml
tsconfig.base.json
eslint.config.mjs
postcss.config.mjs

apps/mobile/package.json
apps/mobile/next.config.ts
apps/mobile/tsconfig.json
apps/mobile/app/globals.css
apps/mobile/app/layout.tsx
apps/mobile/app/page.tsx
apps/mobile/components/mobile-shell.tsx
apps/mobile/lib/app-config.ts

apps/desktop/package.json
apps/desktop/next.config.ts
apps/desktop/tsconfig.json
apps/desktop/app/globals.css
apps/desktop/app/layout.tsx
apps/desktop/app/page.tsx
apps/desktop/components/desktop-shell.tsx
apps/desktop/lib/app-config.ts

packages/ui/package.json
packages/ui/tsconfig.json
packages/ui/src/components/badge.tsx
packages/ui/src/components/button.tsx
packages/ui/src/components/card.tsx
packages/ui/src/lib/utils.ts
packages/ui/src/styles/globals.css

packages/domain/package.json
packages/domain/tsconfig.json
packages/domain/vitest.config.ts
packages/domain/src/index.ts
packages/domain/src/money/format-price.ts
packages/domain/src/orders/status.ts
packages/domain/src/payments/platforms.ts
packages/domain/src/payments/platforms.test.ts
packages/domain/src/money/format-price.test.ts
packages/domain/src/orders/status.test.ts

packages/mocks/package.json
packages/mocks/tsconfig.json
packages/mocks/src/index.ts
packages/mocks/src/fixtures/current-user.ts
packages/mocks/src/services/auth.ts

packages/api/package.json
packages/api/tsconfig.json
packages/api/vitest.config.ts
packages/api/src/index.ts
packages/api/src/data-source.ts
packages/api/src/errors.ts
packages/api/src/services/auth.ts
packages/api/src/services/auth.test.ts

infra/caddy/Caddyfile
```

Remove the root-level template app files after the two app shells compile:

```text
app/
public/
next.config.ts
tsconfig.json
next-env.d.ts
```

Keep root-level `postcss.config.mjs` because both apps can reuse it.

---

### Task 1: Workspace Configuration

**Files:**

- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Replace the root package manifest**

Replace `package.json` with:

```json
{
  "name": "sast-shop-workspace",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "dev:mobile": "pnpm --filter @sast-shop/mobile dev",
    "dev:desktop": "pnpm --filter @sast-shop/desktop dev",
    "build": "next build",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\""
  },
  "dependencies": {
    "next": "16.2.7",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.7",
    "prettier": "^3.8.1",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Replace the workspace file**

Replace `pnpm-workspace.yaml` with:

```yaml
packages:
  - "apps/*"
  - "packages/*"

allowBuilds:
  esbuild: true
  protobufjs: true
  sharp: true
  unrs-resolver: true

ignoredBuiltDependencies:
  - sharp
  - unrs-resolver
```

- [ ] **Step 3: Create the shared TypeScript config**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true
  }
}
```

- [ ] **Step 4: Replace ESLint config**

Replace `eslint.config.mjs` with:

```js
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "apps/*/.next/**",
      "packages/*/dist/**",
    ],
  },
];

export default eslintConfig;
```

- [ ] **Step 5: Install workspace dependencies**

Run:

```bash
pnpm install
```

Expected: pnpm updates `pnpm-lock.yaml` without dependency resolution errors.

- [ ] **Step 6: Verify root checks are real**

Run:

```bash
pnpm exec eslint app/layout.tsx app/page.tsx
pnpm lint
pnpm typecheck
pnpm test
pnpm build
rg "next/font/google|fonts.googleapis.com|Geist|font-geist" app README.md package.json pnpm-lock.yaml
```

Expected: ESLint, lint, typecheck, test, and build exit with code 0. The font search prints no matches. At this intermediate stage the root Next app still exists, so these scripts validate the root app directly instead of using recursive workspace scripts.

- [ ] **Step 7: Commit workspace configuration**

Run:

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs pnpm-lock.yaml app/globals.css app/layout.tsx README.md
git commit -m "chore: configure pnpm workspace"
```

---

### Task 2: Shared UI Package

**Files:**

- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/lib/utils.ts`
- Create: `packages/ui/src/styles/globals.css`
- Create: `packages/ui/src/components/button.tsx`
- Create: `packages/ui/src/components/badge.tsx`
- Create: `packages/ui/src/components/card.tsx`

- [ ] **Step 1: Create `packages/ui/package.json`**

```json
{
  "name": "@workspace/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "tsc --noEmit"
  },
  "exports": {
    "./globals.css": "./src/styles/globals.css",
    "./components/button": "./src/components/button.tsx",
    "./components/badge": "./src/components/badge.tsx",
    "./components/card": "./src/components/card.tsx",
    "./lib/utils": "./src/lib/utils.ts"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.6.0"
  },
  "peerDependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create `packages/ui/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "baseUrl": "."
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 3: Create class name helper**

Create `packages/ui/src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Create shared CSS variables**

Create `packages/ui/src/styles/globals.css`:

```css
@import "tailwindcss";

:root {
  --background: #f6f3ef;
  --foreground: #1d1d1f;
  --card: #ffffff;
  --card-foreground: #1d1d1f;
  --primary: #c9431f;
  --primary-foreground: #ffffff;
  --muted: #eeeae5;
  --muted-foreground: #6e6e73;
  --border: #e3dcd4;
  --ring: #c9431f;
  --radius: 0.625rem;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --font-sans:
    ui-sans-serif, -apple-system, "PingFang SC", "Microsoft YaHei",
    "Helvetica Neue", Arial, sans-serif;
  --font-mono:
    ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
}

* {
  border-color: var(--border);
}

body {
  margin: 0;
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}
```

- [ ] **Step 5: Create Button**

Create `packages/ui/src/components/button.tsx`:

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border bg-background hover:bg-muted",
        ghost: "hover:bg-muted",
        destructive: "bg-red-600 text-white hover:bg-red-700",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-6",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
```

- [ ] **Step 6: Create Badge**

Create `packages/ui/src/components/badge.tsx`:

```tsx
import * as React from "react";
import { cn } from "../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "outline" | "muted";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variant === "default" && "bg-primary text-primary-foreground",
        variant === "outline" && "border text-foreground",
        variant === "muted" && "bg-muted text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 7: Create Card**

Create `packages/ui/src/components/card.tsx`:

```tsx
import * as React from "react";
import { cn } from "../lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-1.5 p-4", className)} {...props} />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("font-semibold leading-none", className)} {...props} />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-0", className)} {...props} />;
}
```

- [ ] **Step 8: Verify UI package**

Run:

```bash
pnpm --filter @workspace/ui typecheck
rg "next/font/google|fonts.googleapis.com" packages/ui apps || true
```

Expected: TypeScript exits with code 0. The `rg` command prints no matches.

- [ ] **Step 9: Commit UI package**

Run:

```bash
git add packages/ui
git commit -m "feat: add shared ui package"
```

---

### Task 3: Domain Package

**Files:**

- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/vitest.config.ts`
- Create: `packages/domain/src/index.ts`
- Create: `packages/domain/src/money/format-price.ts`
- Create: `packages/domain/src/orders/status.ts`
- Create: `packages/domain/src/payments/platforms.ts`
- Create: `packages/domain/src/money/format-price.test.ts`
- Create: `packages/domain/src/orders/status.test.ts`

- [ ] **Step 1: Create package manifest**

Create `packages/domain/package.json`:

```json
{
  "name": "@sast-shop/domain",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "exports": {
    ".": "./src/index.ts"
  },
  "devDependencies": {
    "vitest": "^3.2.4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create TypeScript and Vitest config**

Create `packages/domain/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts"]
}
```

Create `packages/domain/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 3: Write money formatting test**

Create `packages/domain/src/money/format-price.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatPrice } from "./format-price";

describe("formatPrice", () => {
  it("formats cents as Chinese yuan", () => {
    expect(formatPrice(1234)).toBe("¥12.34");
  });

  it("keeps integer yuan compact", () => {
    expect(formatPrice(1200)).toBe("¥12");
  });
});
```

- [ ] **Step 4: Run the money test and verify it fails**

Run:

```bash
pnpm --filter @sast-shop/domain test -- src/money/format-price.test.ts
```

Expected: FAIL because `./format-price` does not exist.

- [ ] **Step 5: Implement money formatting**

Create `packages/domain/src/money/format-price.ts`:

```ts
export function formatPrice(cents: number) {
  const yuan = cents / 100;
  const formatted = Number.isInteger(yuan) ? yuan.toFixed(0) : yuan.toFixed(2);
  return `¥${formatted}`;
}
```

- [ ] **Step 6: Write order status test**

Create `packages/domain/src/orders/status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getOrderStatusMeta } from "./status";

describe("getOrderStatusMeta", () => {
  it("returns buyer-facing pending payment copy", () => {
    expect(getOrderStatusMeta("pending_payment")).toEqual({
      label: "待支付",
      tone: "orange",
    });
  });
});
```

- [ ] **Step 7: Implement order status metadata**

Create `packages/domain/src/orders/status.ts`:

```ts
export type OrderStatus =
  | "pending_payment"
  | "pending_confirm"
  | "paid"
  | "processing"
  | "complete"
  | "cancelled";

export type StatusTone = "orange" | "blue" | "amber" | "emerald" | "muted";

const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; tone: StatusTone }
> = {
  pending_payment: { label: "待支付", tone: "orange" },
  pending_confirm: { label: "待确认收款", tone: "blue" },
  paid: { label: "已付款", tone: "amber" },
  processing: { label: "处理中", tone: "blue" },
  complete: { label: "已完成", tone: "emerald" },
  cancelled: { label: "已取消", tone: "muted" },
};

export function getOrderStatusMeta(status: OrderStatus) {
  return ORDER_STATUS_META[status];
}
```

- [ ] **Step 8: Implement payment platform metadata**

Create `packages/domain/src/payments/platforms.ts`:

```ts
export type PaymentPlatform = "wechat" | "alipay";

export const PAYMENT_PLATFORM_META: Record<
  PaymentPlatform,
  { label: string; tone: PaymentPlatform }
> = {
  wechat: {
    label: "微信支付",
    tone: "wechat",
  },
  alipay: {
    label: "支付宝",
    tone: "alipay",
  },
};
```

- [ ] **Step 9: Add payment platform metadata test**

Create `packages/domain/src/payments/platforms.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PAYMENT_PLATFORM_META } from "./platforms";

describe("PAYMENT_PLATFORM_META", () => {
  it("returns semantic payment platform metadata", () => {
    expect(PAYMENT_PLATFORM_META.wechat).toEqual({
      label: "微信支付",
      tone: "wechat",
    });
    expect(PAYMENT_PLATFORM_META.alipay).toEqual({
      label: "支付宝",
      tone: "alipay",
    });
  });
});
```

- [ ] **Step 10: Export domain API**

Create `packages/domain/src/index.ts`:

```ts
export { formatPrice } from "./money/format-price";
export {
  getOrderStatusMeta,
  type OrderStatus,
  type StatusTone,
} from "./orders/status";
export {
  PAYMENT_PLATFORM_META,
  type PaymentPlatform,
} from "./payments/platforms";
```

- [ ] **Step 11: Verify domain package**

Run:

```bash
pnpm --filter @sast-shop/domain test
pnpm --filter @sast-shop/domain typecheck
```

Expected: both commands exit with code 0.

- [ ] **Step 12: Commit domain package**

Run:

```bash
git add packages/domain
git commit -m "feat: add shared domain package"
```

---

### Task 4: Mock Package

**Files:**

- Create: `packages/mocks/package.json`
- Create: `packages/mocks/tsconfig.json`
- Create: `packages/mocks/src/index.ts`
- Create: `packages/mocks/src/fixtures/current-user.ts`
- Create: `packages/mocks/src/services/auth.ts`

- [ ] **Step 1: Create package manifest**

Create `packages/mocks/package.json`:

```json
{
  "name": "@sast-shop/mocks",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "tsc --noEmit"
  },
  "exports": {
    ".": "./src/index.ts"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

Create `packages/mocks/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create mock user fixture**

Create `packages/mocks/src/fixtures/current-user.ts`:

```ts
export interface MockUser {
  id: string;
  name: string;
  department: string;
  avatarUrl: string;
}

export const currentUser: MockUser = {
  id: "mock-user-001",
  name: "南邮同学",
  department: "SAST",
  avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=SAST",
};
```

- [ ] **Step 4: Create mock auth service**

Create `packages/mocks/src/services/auth.ts`:

```ts
import { currentUser } from "../fixtures/current-user";

export async function getMockCurrentUser() {
  return currentUser;
}

export async function loginWithMockCode(code: string) {
  return {
    sessionToken: `mock-session-${code || "default"}`,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    user: currentUser,
  };
}
```

- [ ] **Step 5: Export mocks**

Create `packages/mocks/src/index.ts`:

```ts
export { currentUser, type MockUser } from "./fixtures/current-user";
export { getMockCurrentUser, loginWithMockCode } from "./services/auth";
```

- [ ] **Step 6: Verify mock package**

Run:

```bash
pnpm --filter @sast-shop/mocks typecheck
```

Expected: TypeScript exits with code 0.

- [ ] **Step 7: Commit mock package**

Run:

```bash
git add packages/mocks
git commit -m "feat: add mock data package"
```

---

### Task 5: API Package and Data Source Switching

**Files:**

- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/vitest.config.ts`
- Create: `packages/api/src/index.ts`
- Create: `packages/api/src/data-source.ts`
- Create: `packages/api/src/errors.ts`
- Create: `packages/api/src/services/auth.ts`
- Create: `packages/api/src/services/auth.test.ts`

- [ ] **Step 1: Create package manifest**

Create `packages/api/package.json`:

```json
{
  "name": "@sast-shop/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@sast-shop/mocks": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^3.2.4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create TypeScript and Vitest config**

Create `packages/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts"]
}
```

Create `packages/api/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 3: Write auth service tests**

Create `packages/api/src/services/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FeatureUnavailableError } from "../errors";
import { getCurrentUser, loginWithLarkCode } from "./auth";

describe("auth service", () => {
  it("returns mock user in mock mode", async () => {
    const user = await getCurrentUser({ dataSource: "mock" });
    expect(user.name).toBe("南邮同学");
  });

  it("throws for local mode before backend client is wired", async () => {
    await expect(
      getCurrentUser({ dataSource: "local" }),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it("returns a mock session in mock mode", async () => {
    const session = await loginWithLarkCode("abc", { dataSource: "mock" });
    expect(session.sessionToken).toBe("mock-session-abc");
  });
});
```

- [ ] **Step 4: Run the auth tests and verify they fail**

Run:

```bash
pnpm --filter @sast-shop/api test -- src/services/auth.test.ts
```

Expected: FAIL because `../errors` and `./auth` do not exist.

- [ ] **Step 5: Implement data source types**

Create `packages/api/src/data-source.ts`:

```ts
export type DataSource = "mock" | "local" | "remote";

export interface ServiceOptions {
  dataSource?: DataSource;
}

export function resolveDataSource(options: ServiceOptions = {}): DataSource {
  return options.dataSource ?? "mock";
}
```

- [ ] **Step 6: Implement normalized errors**

Create `packages/api/src/errors.ts`:

```ts
export class FeatureUnavailableError extends Error {
  constructor(feature: string) {
    super(`${feature} is not available for the selected data source`);
    this.name = "FeatureUnavailableError";
  }
}

export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication is required");
    this.name = "AuthRequiredError";
  }
}
```

- [ ] **Step 7: Implement auth service**

Create `packages/api/src/services/auth.ts`:

```ts
import { getMockCurrentUser, loginWithMockCode } from "@sast-shop/mocks";
import { resolveDataSource, type ServiceOptions } from "../data-source";
import { FeatureUnavailableError } from "../errors";

export async function getCurrentUser(options: ServiceOptions = {}) {
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock") {
    return getMockCurrentUser();
  }

  throw new FeatureUnavailableError("getCurrentUser");
}

export async function loginWithLarkCode(
  code: string,
  options: ServiceOptions = {},
) {
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock") {
    return loginWithMockCode(code);
  }

  throw new FeatureUnavailableError("loginWithLarkCode");
}
```

- [ ] **Step 8: Export API package**

Create `packages/api/src/index.ts`:

```ts
export {
  resolveDataSource,
  type DataSource,
  type ServiceOptions,
} from "./data-source";
export { AuthRequiredError, FeatureUnavailableError } from "./errors";
export { getCurrentUser, loginWithLarkCode } from "./services/auth";
```

- [ ] **Step 9: Verify API package**

Run:

```bash
pnpm --filter @sast-shop/api test
pnpm --filter @sast-shop/api typecheck
```

Expected: both commands exit with code 0.

- [ ] **Step 10: Commit API package**

Run:

```bash
git add packages/api
git commit -m "feat: add api data source facade"
```

---

### Task 6: Mobile App Shell

**Files:**

- Create: `apps/mobile/package.json`
- Create: `apps/mobile/next.config.ts`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/app/globals.css`
- Create: `apps/mobile/app/layout.tsx`
- Create: `apps/mobile/app/page.tsx`
- Create: `apps/mobile/components/mobile-shell.tsx`
- Create: `apps/mobile/lib/app-config.ts`

- [ ] **Step 1: Create mobile package manifest**

Create `apps/mobile/package.json`:

```json
{
  "name": "@sast-shop/mobile",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start --port 3001",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "tsc --noEmit"
  },
  "dependencies": {
    "@sast-shop/api": "workspace:*",
    "@sast-shop/domain": "workspace:*",
    "@workspace/ui": "workspace:*",
    "next": "16.2.7",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create mobile Next config**

Create `apps/mobile/next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@workspace/ui",
    "@sast-shop/api",
    "@sast-shop/domain",
    "@sast-shop/mocks",
  ],
};

export default nextConfig;
```

- [ ] **Step 3: Create mobile TypeScript config**

Create `apps/mobile/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create mobile globals**

Create `apps/mobile/app/globals.css`:

```css
@import "@workspace/ui/globals.css";
```

- [ ] **Step 5: Create mobile app config**

Create `apps/mobile/lib/app-config.ts`:

```ts
import type { DataSource } from "@sast-shop/api";

export const mobileAppConfig = {
  appName: "SAST 商城",
  dataSource: (process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock") as DataSource,
  appOrigin:
    process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://m.sast-shop.example.com",
};
```

- [ ] **Step 6: Create mobile shell**

Create `apps/mobile/components/mobile-shell.tsx`:

```tsx
import { Button } from "@workspace/ui/components/button";

const navItems = ["团购", "现货", "订单", "发布", "我的"];

export function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-background pb-16 text-foreground">
      <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-4">
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t bg-background/95 px-4 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid h-14 max-w-md grid-cols-5 gap-1">
          {navItems.map((item) => (
            <Button
              key={item}
              variant="ghost"
              className="h-full rounded-none px-1 text-xs"
            >
              {item}
            </Button>
          ))}
        </div>
      </nav>
    </div>
  );
}
```

- [ ] **Step 7: Create mobile layout**

Create `apps/mobile/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { MobileShell } from "@/components/mobile-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAST 商城",
  description: "SAST 商城移动端",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <MobileShell>{children}</MobileShell>
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Create mobile home page**

Create `apps/mobile/app/page.tsx`:

```tsx
import { getCurrentUser } from "@sast-shop/api";
import { formatPrice } from "@sast-shop/domain";
import { Badge } from "@workspace/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { mobileAppConfig } from "@/lib/app-config";

export default async function Page() {
  const user = await getCurrentUser({ dataSource: mobileAppConfig.dataSource });

  return (
    <div className="flex flex-1 flex-col gap-4 py-6">
      <section className="flex flex-col gap-2">
        <Badge variant="outline">移动端</Badge>
        <h1 className="text-2xl font-semibold">你好，{user.name}</h1>
        <p className="text-sm text-muted-foreground">
          当前使用 {mobileAppConfig.dataSource} 数据源。
        </p>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>今日待处理</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            示例金额 {formatPrice(1299)}，后续业务计划会接入真实列表。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 9: Verify mobile app**

Run:

```bash
pnpm --filter @sast-shop/mobile typecheck
rg "next/font/google|fonts.googleapis.com" apps/mobile packages || true
pnpm --filter @sast-shop/mobile build
```

Expected: `typecheck` and `build` exit with code 0. The `rg` command prints no matches.

- [ ] **Step 10: Commit mobile shell**

Run:

```bash
git add apps/mobile
git commit -m "feat: add mobile app shell"
```

---

### Task 7: Desktop App Shell

**Files:**

- Create: `apps/desktop/package.json`
- Create: `apps/desktop/next.config.ts`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/app/globals.css`
- Create: `apps/desktop/app/layout.tsx`
- Create: `apps/desktop/app/page.tsx`
- Create: `apps/desktop/components/desktop-shell.tsx`
- Create: `apps/desktop/lib/app-config.ts`

- [ ] **Step 1: Create desktop package manifest**

Create `apps/desktop/package.json`:

```json
{
  "name": "@sast-shop/desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3002",
    "build": "next build",
    "start": "next start --port 3002",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "tsc --noEmit"
  },
  "dependencies": {
    "@sast-shop/api": "workspace:*",
    "@sast-shop/domain": "workspace:*",
    "@workspace/ui": "workspace:*",
    "next": "16.2.7",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create desktop Next config**

Create `apps/desktop/next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@workspace/ui",
    "@sast-shop/api",
    "@sast-shop/domain",
    "@sast-shop/mocks",
  ],
};

export default nextConfig;
```

- [ ] **Step 3: Create desktop TypeScript config**

Create `apps/desktop/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create desktop globals**

Create `apps/desktop/app/globals.css`:

```css
@import "@workspace/ui/globals.css";
```

- [ ] **Step 5: Create desktop app config**

Create `apps/desktop/lib/app-config.ts`:

```ts
import type { DataSource } from "@sast-shop/api";

export const desktopAppConfig = {
  appName: "SAST 商城 PC 端",
  dataSource: (process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock") as DataSource,
  appOrigin:
    process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://shop.sast-shop.example.com",
};
```

- [ ] **Step 6: Create desktop shell**

Create `apps/desktop/components/desktop-shell.tsx`:

```tsx
import { Button } from "@workspace/ui/components/button";

const navItems = ["工作台", "团购", "现货", "订单", "发布", "我的"];

export function DesktopShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh grid-cols-[240px_1fr] bg-background text-foreground">
      <aside className="border-r px-4 py-6">
        <div className="mb-6 text-lg font-semibold">SAST 商城</div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Button key={item} variant="ghost" className="justify-start">
              {item}
            </Button>
          ))}
        </nav>
      </aside>
      <main className="min-w-0">
        <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 7: Create desktop layout**

Create `apps/desktop/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { DesktopShell } from "@/components/desktop-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAST 商城 PC 端",
  description: "SAST 商城桌面端",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <DesktopShell>{children}</DesktopShell>
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Create desktop home page**

Create `apps/desktop/app/page.tsx`:

```tsx
import { getCurrentUser } from "@sast-shop/api";
import { getOrderStatusMeta } from "@sast-shop/domain";
import { Badge } from "@workspace/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { desktopAppConfig } from "@/lib/app-config";

export default async function Page() {
  const user = await getCurrentUser({
    dataSource: desktopAppConfig.dataSource,
  });
  const pendingPayment = getOrderStatusMeta("pending_payment");

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-end justify-between gap-4">
        <div>
          <Badge variant="outline">PC 端</Badge>
          <h1 className="mt-3 text-2xl font-semibold">工作台</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            你好，{user.name}。当前使用 {desktopAppConfig.dataSource} 数据源。
          </p>
        </div>
      </section>
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>订单状态</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {pendingPayment.label} / {pendingPayment.tone}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Verify desktop app**

Run:

```bash
pnpm --filter @sast-shop/desktop typecheck
rg "next/font/google|fonts.googleapis.com" apps/desktop packages || true
pnpm --filter @sast-shop/desktop build
```

Expected: `typecheck` and `build` exit with code 0. The `rg` command prints no matches.

- [ ] **Step 10: Commit desktop shell**

Run:

```bash
git add apps/desktop
git commit -m "feat: add desktop app shell"
```

---

### Task 8: Caddy Routing and Root Template Cleanup

**Files:**

- Modify: `package.json`
- Create: `infra/caddy/Caddyfile`
- Remove: `app/`
- Remove: `public/`
- Remove: `next.config.ts`
- Remove: `tsconfig.json`
- Remove: `next-env.d.ts`

- [ ] **Step 1: Create Caddyfile**

Create `infra/caddy/Caddyfile`:

```caddyfile
{
  email admin@sast-shop.example.com
}

m.sast-shop.example.com {
  reverse_proxy mobile:3001
}

shop.sast-shop.example.com {
  reverse_proxy desktop:3002
}
```

- [ ] **Step 2: Remove unused root Next template files**

Run:

```bash
git rm -r app public next.config.ts tsconfig.json next-env.d.ts
```

Expected: Git stages removal of the root template app. Root `package.json` remains as workspace metadata.

- [ ] **Step 3: Convert root package scripts to final workspace mode**

Replace `package.json` with:

```json
{
  "name": "sast-shop-workspace",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev:mobile": "pnpm --filter @sast-shop/mobile dev",
    "dev:desktop": "pnpm --filter @sast-shop/desktop dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\""
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "eslint": "^9",
    "eslint-config-next": "16.2.7",
    "prettier": "^3.8.1",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 4: Refresh lockfile**

Run:

```bash
pnpm install --config.confirmModulesPurge=false
```

Expected: pnpm updates `pnpm-lock.yaml` without dependency resolution errors.

- [ ] **Step 5: Verify all packages**

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Expected: all three commands exit with code 0.

- [ ] **Step 6: Commit routing and cleanup**

Run:

```bash
git add package.json pnpm-lock.yaml infra/caddy/Caddyfile
git commit -m "chore: add caddy routing and remove root template"
```

---

## Verification Checklist

After all tasks are complete, run:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
rg "next/font/google|fonts.googleapis.com" apps packages || true
```

Expected:

- TypeScript succeeds for all workspace packages.
- Vitest succeeds for `packages/domain` and `packages/api`.
- Both Next apps build.
- ESLint reports no errors.
- The font search prints no matches.

Then run the apps manually:

```bash
pnpm dev:mobile
pnpm dev:desktop
```

Expected:

- Mobile app starts on `http://localhost:3001`.
- Desktop app starts on `http://localhost:3002`.
- Both apps render mock user data from `@sast-shop/api`.
