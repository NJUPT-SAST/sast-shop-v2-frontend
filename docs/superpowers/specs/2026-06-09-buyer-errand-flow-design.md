# Buyer Errand Flow Design

## Context

SAST Shop phase one covers spot goods, group/errand purchasing, publishing spot goods, orders, and trust-based payment. The current app has solid spot, payment, profile, address, and QR code foundations, but the mobile group page is still mostly a store grid with placeholder restock actions. The orders page lists spot orders and explicitly shows placeholder states for errand orders and captain tasks.

The old `../frontend-v2` implementation has a useful buyer-side errand interaction model: a store detail page, product-template grid, bottom cart bar, cart drawer, per-item errand fee, expected delivery time, and a confirmation dialog. This design ports that flow into the current monorepo while respecting the new API facade boundary, shadcn-style components, and single Action Blue theme.

## Goals

- Add a PRD-aligned buyer-side errand vertical slice.
- Let users open a store from `/group`, choose product templates, configure quantity and per-unit service fee, choose expected delivery, and submit an errand demand.
- Show buyer errand orders in `/orders` under `跑腿订单 / 我买的`.
- Keep page components behind `@sast-shop/api` facade functions and never import generated proto files directly from app code.
- Keep `mock`, `local`, and `remote` data source behavior explicit; do not silently fallback.
- Use `../frontend-v2` as a behavioral and information-architecture reference, while applying `$impeccable` product-UI guidance for the final visual hierarchy, density, copy, states, and interaction polish.

## Non-Goals

- Do not implement captain demand hall, partial acceptance, shopping task processing, distribution, collecting-payment review, or errand payment in this slice.
- Do not add order detail pages for buyer errand orders in this slice.
- Do not implement store or product-template management in this slice.
- Do not introduce a second accent color for errand actions.
- Do not add OCR, logistics, refund, or admin flows.

## Recommended Approach

Build a facade-backed buyer errand vertical.

Add errand facade services in `packages/api`, map generated ConnectRPC messages into frontend-safe types, add focused tests, then build mobile UI on top of those facades. This keeps the new flow production-shaped from the start and avoids a UI-only layer that would need to be unwound later.

## UI/UX Direction

Use `$impeccable` as the UI/UX quality bar. This is a task-focused product surface inside Feishu, not a public e-commerce landing page. The interface should feel reliable, fast, and clear: state first, amount breakdowns visible, standard controls, restrained color, and no decorative retail treatment.

`../frontend-v2` is useful for behavior and information architecture: store detail, product-template selection, bottom cart entry, cart review, per-item service fee, expected delivery, and confirmation. The final implementation does not need to match its exact visual composition. In particular, keep the current single Action Blue system, avoid the old orange action color, avoid heavy card walls, and prefer compact task surfaces that make quantity, fee, deadline, and submission state easy to scan.

## Routes And Surfaces

### `/group`

Keep the existing store grid, but make store cards navigate to `/group/shop/[id]`.

The restock cards can remain lightweight placeholders for this slice. Their visual treatment should stay aligned with the current group page and not imply that captain flows are already complete.

### `/group/shop/[id]`

Add a secondary mobile page for buyer errand demand creation.

The page loads:

- Store information from `listStores`.
- Store product templates from `listProductTemplates({ storeId })`.

The page renders:

- Store header with name, address, and logo/image placeholder.
- Sticky task hint: `发起跑腿需求`, with concise copy explaining quantity, per-item service fee, and expected delivery.
- Product-template grid, based on the reference `../frontend-v2/components/group/shop-detail/product-card.tsx`.
- Bottom cart bar, disabled when no item is selected.
- Cart drawer for review and submission.

Product cards show:

- Product image or managed placeholder.
- Title.
- Description/specification.
- Store listed price.
- Add button or quantity stepper.

Product detail opens in a mobile Drawer through `ResponsiveDialog`, showing the larger image, listed price, description/specification, barcode, and a note that listed price is only an estimate. If the template card already gives enough context, the detail drawer should stay concise rather than becoming a decorative product showcase.

### Cart Drawer

The cart drawer follows the reference interaction but uses current shared primitives.

It includes:

- Selected items with quantity controls.
- Per-unit errand fee input for each item.
- Expected delivery selector.
- Explanation that final settlement depends on captain purchase and distribution results.
- Estimated product amount.
- Service fee total.
- Estimated total.
- Confirmation dialog before submit.

Validation:

- At least one item is required.
- Quantity must be a positive integer.
- Per-unit service fee must be a non-negative amount in cents.
- Expected delivery must be at least two hours in the future.
- Product templates without usable `updatedAt` can still render, but submission should omit the timestamp rather than invent one.

Delivery default:

- Before 20:00 local time, default to today 22:00.
- At or after 20:00, default to tomorrow 22:00.
- If the computed default is less than two hours in the future, use the next valid half-hour slot.

### `/orders`

Extend `OrdersView` so `跑腿订单 / 我买的` uses buyer errand order data.

Errand order cards show:

- Demand ID.
- Store name.
- Status badge.
- Preview product titles.
- Product kind count.
- Estimated product total.
- Actual product total when present.
- Service fee total.

`跑腿订单 / 我卖的` remains out of scope because buyer errand orders are not seller orders. `团长任务` remains a clear not-yet-connected state.

## API Facades

### `errand-demands`

Add `packages/api/src/services/errand-demands.ts`.

Expose:

```ts
createErrandDemand(input, options)
```

Input shape:

```ts
interface CreateErrandDemandInput {
  storeId: string
  deadline: string
  items: Array<{
    productTemplateId: string
    quantity: number
    serviceFeePerUnitCents: number
    updatedAt?: string | null
  }>
}
```

Output shape:

```ts
interface CreateErrandDemandResult {
  errandDemandId: string
}
```

Behavior:

- Validate IDs as positive int64 strings.
- Validate quantity and fee before calling the client.
- Convert ISO timestamps to protobuf timestamps.
- Use `ErrandDemandService.CreateErrandDemand` for `mock` and `local`.
- Throw `FeatureUnavailableError` for `remote`.

### `buyer-errand-orders`

Add `packages/api/src/services/buyer-errand-orders.ts`.

Expose:

```ts
listBuyerErrandOrders(options)
```

This slice only adds list support. Buyer errand order detail mapping stays out of scope and should be designed with the future order detail route.

Type highlights:

- Status values: `open`, `shopping`, `pending_distributing`, `distributing`, `pending_payment`, `completed`, `cancelled`, `unknown`.
- Store maps through the same frontend `Store` shape used by catalog.
- Product preview maps through the same product template shape used by product-template facade.
- Money fields stay in cents.
- Timestamps become ISO strings or `null`.

Behavior:

- Use `BuyerErrandOrderService.GetBuyerErrandOrderBrief` for `mock` and `local`.
- Support optional `storeId`, `status`, `page`, and `pageSize` filters.
- Throw `FeatureUnavailableError` for `remote`.

## Data Flow

1. `/group` server component calls `listStores` and renders navigable store cards.
2. `/group/shop/[id]` server component loads store and product templates, then passes data to a client component.
3. Client component owns cart state, local validation, expected delivery selection, and submit state.
4. Submit calls `createErrandDemand`.
5. On success, clear cart, close drawer, toast success, and navigate to `/orders?source=errand&perspective=purchaser`.
6. `/orders` server component loads spot orders and buyer errand orders.
7. `OrdersView` filters and renders the relevant list client-side.

## UI And Interaction Notes

- Use Action Blue `primary` buttons instead of the orange buttons from `../frontend-v2`.
- Let `$impeccable` product-register rules guide the final composition: standard controls, clear focus states, 150-250ms state motion only, no decorative motion, no over-rounded cards, no ghost-card border plus broad shadow pairing.
- Use existing shared components first: `Button`, `Card`, `Badge`, `Input`, `InputGroup`, `ResponsiveDialog`, `Drawer`, `Empty`, `Spinner` or `Skeleton`, and `sonner`.
- Do not nest cards inside cards.
- Keep bottom cart bar above the mobile bottom nav and safe area.
- Use natural Chinese copy and clear task labels.
- Empty template state should say the store has no available product templates.
- Submission failure should keep the drawer open and preserve selected items.
- Data-source failures should show clear page-level `Empty` or card states, not fallback mock data.

## Testing And Verification

Automated checks:

- Add Vitest coverage for `createErrandDemand` input validation and request mapping.
- Add Vitest coverage for buyer errand order status and money mapping.
- Run `pnpm lint`.
- Run `pnpm build` because this adds routes and data facades.

Manual mobile smoke check:

- `/group` store card navigates to `/group/shop/[id]`.
- Store detail shows templates, empty state, and load error state correctly.
- Product detail Drawer opens and closes.
- Add item, update quantity, remove by setting quantity to zero.
- Change per-unit errand fee and see totals update.
- Expected delivery default follows the PRD rule.
- Invalid or too-soon delivery blocks submission.
- Successful submission clears cart and navigates to errand order list.
- `/orders?source=errand&perspective=purchaser` shows buyer errand orders.
- Bottom cart bar and Drawer do not collide with mobile bottom navigation.
