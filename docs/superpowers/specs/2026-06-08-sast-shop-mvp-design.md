# SAST Shop MVP Design

## Context

The current `sast-shop` app is still close to the default Next.js template. A UI-only reference implementation exists in `../frontend-v2`, and product requirements are documented in Feishu PRD and backend design documents referenced from `AGENTS.md`.

The MVP scope follows the PRD phase one:

- Spot marketplace.
- Group buying and errand purchasing.
- Publishing spot goods and replenishment entries.
- Orders and trust-based payment confirmation.
- User profile, address book, and quick payment QR codes.

Admin or operations back office is out of scope for this phase.

## Goals

- Build both mobile and desktop web apps in a shadcn monorepo.
- Deploy mobile and desktop apps under different subdomains.
- Reuse components, domain logic, API facades, and mocks, but do not reuse page code between mobile and desktop.
- Support `mock`, `local`, and `remote` data sources through environment variables.
- Keep login, user profile, address book, and payment QR codes mockable until the real backend is available.
- Preserve the functional behavior of `frontend-v2`, while allowing mobile UI/UX adjustments.
- Use local or system fonts only. Do not use Google Fonts or any build-time remote font fetching.

## Non-Goals

- No admin dashboard in phase one.
- No OCR review workflow.
- No crowdfunding or direct sale flows from later PRD phases.
- No hard dependency on the real backend for the first usable build.
- No single responsive page implementation shared between mobile and desktop.

## Recommended Approach

Use the existing `frontend-v2` as a functional and interaction reference, then implement the production code as a shadcn monorepo with two apps and shared packages.

This balances speed and maintainability: the MVP can reach a complete user-facing shape quickly, while the mock/local/remote API boundary prevents mock data from becoming embedded in page components.

## Monorepo Architecture

```text
apps/
  mobile/
    app/
      (main)/
      (secondary)/
    components/
    features/
    lib/

  desktop/
    app/
      (main)/
      (detail)/
    components/
    features/
    lib/

packages/
  ui/
    src/
      components/
      hooks/
      lib/
      styles/globals.css

  domain/
    src/
      money/
      time/
      orders/
      errand/
      payments/

  api/
    src/
      client/
      services/
      mappers/
      errors.ts
      env.ts

  mocks/
    src/
      fixtures/
      services/

  config/
    eslint/
    typescript/
    tailwind/

infra/
  caddy/
    Caddyfile
```

Use plain pnpm workspaces for the first implementation. Do not add Turborepo until build times or task orchestration become a real bottleneck.

`packages/ui` follows the shadcn monorepo model. Apps import shared UI components from the workspace package, for example:

```tsx
import { Button } from "@workspace/ui/components/button";
```

App-specific layout components, feature components, and pages stay inside each app.

## Deployment

Use different subdomains for mobile and desktop. The concrete production hostnames are deployment configuration values; the Caddyfile should be templated or edited per environment. The examples below show the required routing shape:

```caddyfile
m.sast-shop.example.com {
  reverse_proxy mobile:3000
}

shop.sast-shop.example.com {
  reverse_proxy desktop:3000
}
```

Different subdomains make Feishu in-app URLs, OAuth callback handling, JSAPI signing, cache policy, and future analytics easier to reason about.

## Environment Configuration

Both apps use the same environment variable semantics:

```env
NEXT_PUBLIC_DATA_SOURCE=mock
NEXT_PUBLIC_LOCAL_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_REMOTE_API_BASE_URL=https://api.sast-shop.example.com
NEXT_PUBLIC_APP_ORIGIN=https://m.sast-shop.example.com
```

`NEXT_PUBLIC_DATA_SOURCE` accepts:

- `mock`: all services use `packages/mocks`, including login and user profile.
- `local`: services call the local backend.
- `remote`: services call the deployed backend.

When a local or remote backend feature is not implemented, the API layer should throw `FeatureUnavailableError` instead of silently falling back to mock data.

## Font Policy

Both apps and the shared UI package must use local or system font stacks. The codebase must not import from `next/font/google`, reference Google Fonts stylesheets, or depend on remote font fetching during build. The default sans stack is:

```css
ui-sans-serif, -apple-system, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif
```

## API Boundary

`packages/api` exposes endpoint-independent service functions:

```text
getCurrentUser()
loginWithLarkCode(code)
getJSAPIAuthConfig(url)
listStores()
listSpotGoods(params)
getSpotGoods(id)
createSpotOrder(input)
listOrders(params)
getOrderDetail(id)
createErrandDemand(input)
acceptErrandDemand(input)
updateErrandPurchaseItem(input)
submitPayment(input)
confirmPayment(input)
listAddresses()
saveAddress(input)
listPaymentQRCodes()
savePaymentQRCode(input)
```

The page layer handles loading, empty states, errors, and user actions. It does not know whether data came from mock, local, or remote.

ConnectRPC clients, DTO mapping, proto type conversions, and normalized errors live in `packages/api`.

## Mobile App Information Architecture

Mobile is optimized for Feishu in-app use, single-column task flows, bottom navigation, sticky secondary headers, drawers, and safe-area-aware bottom actions.

```text
m.sast-shop.example.com
  /
  /group
  /shop
  /orders
  /publish
  /profile

  /group/shop/[id]
  /group/purchase/[id]
  /group/purchase/[id]/payment
  /group/errand/[id]
  /orders/[id]
  /publish/spot
  /publish/group-buy-item
  /publish/errand
```

The mobile app should prefer card lists, drawers, full-screen secondary flows, and stable bottom bars. Hover-only behavior is not allowed for required actions.

## Desktop App Information Architecture

Desktop is optimized for scanning, filtering, comparison, and dense operational workflows.

```text
shop.sast-shop.example.com
  /
  /group
  /shop
  /orders
  /publish
  /profile

  /group/shops/[id]
  /group/purchases/[id]
  /group/purchases/[id]/payment
  /orders/[id]
```

The desktop app should use sidebar navigation, breadcrumbs, filters, tables or dense lists, split detail views, and right-side or bottom action regions.

## Reuse Strategy

Reuse base UI in `packages/ui`:

```text
Button, Badge, Dialog, Drawer, Sheet, Popover, Tabs, Input,
Select, Form, Card, Avatar, Empty, Skeleton, Tooltip, Toast
```

Reuse domain logic in `packages/domain`:

```text
formatPrice()
formatTime()
ORDER_STATUS_LABELS
PAYMENT_PLATFORM_META
ERRAND_TASK_STATUS_META
getAvailableOrderActions()
calculateErrandPaymentSummary()
```

Reuse small business components when they do not impose page layout:

```text
PaymentQrCode
OrderStatusBadge
PriceText
AvatarGroup
PaymentVerifyCode
ProductImage
StoreLogo
Stepper
```

Do not reuse page-level components:

```text
MobileOrderList != DesktopOrderList
MobilePurchaseTaskPage != DesktopPurchaseTaskPage
MobilePaymentDrawer != DesktopPaymentPanel
MobileShopDetail != DesktopShopDetail
```

## Business Domains

### Auth

Supports Feishu OAuth login, session persistence, and JSAPI config. In mock mode, the app generates a mock session and current user.

### Profile

Includes user profile, address book, and quick payment QR codes. These capabilities must be available before order or payment workflows require them.

### Catalog

Includes stores, product templates, and barcode lookup. Barcode plus store ID uniquely identifies a product template. If one barcode matches multiple stores, users must choose a store.

### Spot

Includes spot goods listing, spot publishing, direct purchase, and payment. Spot purchases do not use a cart.

### Errand

Separates buyer-facing `demand` from captain-facing `task`.

Buyers see demands in order lists and detail pages. Captains process tasks for accepting, purchasing, repricing, distributing, collecting payment, and completion.

Partial acceptance moves whole `demand_item` rows into a new demand and task. The original demand keeps unaccepted rows and remains available.

### Orders

Provides unified list and detail pages for spot and errand-related orders. Lists use brief data. Detail pages fetch detail data.

### Payments

Supports quick payment QR codes, bills, payment submission, payment verification codes, and seller or captain payment confirmation. Payment remains a trust-based offline confirmation flow.

## State Flows

Spot order:

```text
待支付 -> 待确认收款 -> 已付款/处理中 -> 已完成
       -> 已取消
```

Errand demand:

```text
未接单 -> 采购中 -> 待分发 -> 分发中 -> 待支付 -> 已完成
       -> 已取消
```

Errand task:

```text
采购中 -> 待分发 -> 分发中 -> 收款中 -> 已完成
       -> 已取消
```

## Error Handling

Normalize errors in `packages/api/errors.ts`:

```text
AuthRequiredError
PermissionDeniedError
ConflictError
ValidationError
FeatureUnavailableError
NetworkError
```

UI behavior:

- `AuthRequiredError`: prompt login or mock login.
- `ConflictError`: show that the state changed and ask the user to refresh or retry.
- `FeatureUnavailableError`: show a clear unavailable message in local or remote mode.
- `ValidationError`: show field-level or action-level validation messages.
- `NetworkError`: show retry affordance.

## Loading, Empty, and Pending States

- List pages use skeletons.
- Empty states use a shared `Empty` component with direct Chinese copy.
- Submit buttons keep stable dimensions during pending states.
- Payment and confirmation actions prevent duplicate submissions.
- Mobile bottom bars keep safe-area spacing.
- Desktop filters and table structure remain visible while data loads.

## Testing Strategy

`packages/domain`:

- Unit-test money formatting, payment summary calculation, status mappings, and available actions.

`packages/api`:

- Unit-test data source switching, mock service state transitions, DTO mapping, and error normalization.

`apps/mobile` and `apps/desktop`:

- Smoke-test route rendering.
- Test critical forms, payment panels, and status action buttons.
- E2E-test the core mock flows:
  - mock login,
  - spot purchase and payment,
  - seller or captain payment confirmation,
  - errand demand creation,
  - captain acceptance and purchase flow,
  - distribution and collection flow,
  - address and payment QR code editing.

## Implementation Sequence

1. Convert the repository into the shadcn monorepo shape.
2. Add `apps/mobile`, `apps/desktop`, and shared packages.
3. Move or recreate shadcn UI components in `packages/ui`.
4. Add environment parsing and data source selection.
5. Build `packages/domain`, `packages/mocks`, and `packages/api` facades.
6. Implement mobile shell and main routes.
7. Implement desktop shell and main routes.
8. Implement profile and payment QR code workflows.
9. Implement catalog and spot workflows.
10. Implement errand demand/task workflows.
11. Implement order list/detail and payment confirmation flows.
12. Add tests and verification scripts.
