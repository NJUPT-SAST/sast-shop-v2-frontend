# Captain Errand Entry Design

## Context

SAST Shop phase one already has the buyer-side errand flow: users can enter a store from `/group`, choose product templates, configure quantity and per-unit service fee, submit an errand demand, and see buyer errand orders in `/orders`. The next missing product boundary is the captain-side entry point where open buyer demands become captain tasks.

The PRD defines three separate concepts that the UI must preserve:

- `demand` is the buyer-side errand order.
- `task` is the captain-side procurement task.
- `demand_item` is the stable row selected during acceptance. A captain may select whole rows, but cannot accept part of a row's quantity.

This slice creates the first real bridge from `demand` to `task` while avoiding unfinished promises around procurement, distribution, and payment review.

## Goals

- Add a captain demand hall for open errand demands.
- Let captains inspect store-level demand detail and select requester rows.
- Create an errand task through the API facade using selected `demand_item` rows.
- Keep all app code behind `@sast-shop/api`, with no direct proto imports in pages or components.
- Preserve the current UI system: restrained Action Coral, mobile-first layout, Chinese copy, standard controls, and clear state feedback.
- Give later shopping, distribution, and collecting-payment pages a reliable handoff point.

## Non-Goals

- Do not implement shopping task item processing in this slice.
- Do not implement pending-distribution price editing.
- Do not implement distribution actions.
- Do not implement collecting-payment review.
- Do not add buyer errand order detail pages.
- Do not introduce app-level fixture data or silent data-source fallback.

## Routes And Flow

### `/group`

Keep the existing store grid and buyer errand store entry. Update the restock area so the `跑腿大厅` entry routes to `/group/errand`.

If `listErrandTasks` is added in this slice, `/group` may also show a compact `正在采购` handoff section for current captain tasks. The handoff is only a bridge into future task pages and should not imply that procurement operations are complete.

### `/group/errand`

Add the captain demand hall.

The page loads store-level open demand summaries through `listErrandDemandStores`. It renders:

- Title `跑腿采购大厅`.
- Supporting text that demands are grouped by store.
- Store-name search.
- Demand cards for each store.
- Empty state `暂无待接单需求`.
- Explicit unavailable state when the data source fails.

Each demand card shows:

- Store name.
- Total amount.
- Product amount.
- Service fee amount.
- Buyer avatar group.
- Buyer count when available.
- Product kind count when available.
- Updated time.
- Consistent `查看需求` action on every card.

The entire card should be keyboard-focusable and clickable, with the visible action acting as a clear affordance rather than the only hit target.

### `/group/errand/[storeId]`

Add the captain acceptance detail page for one store.

The page loads demand detail through `getErrandDemandDetails({ storeId })`. It renders:

- Store heading.
- Instruction text `勾选完整需求行，创建采购任务`.
- Product groups based on product template.
- Requester rows under each product group.
- Bottom selected summary and `确认接单` action.

Product groups show:

- Product image or existing managed placeholder.
- Product title.
- Description/specification.
- Estimated unit price.
- Total demand quantity.
- Parent checkbox that toggles all selectable requester rows in that product group.

Requester rows show:

- Checkbox.
- Avatar on the left, with name initial fallback.
- Requester name.
- Quantity.
- Per-row service fee, always visible.
- Deadline.
- Non-visible `errandDemandItemId` and `updatedAt` retained in state for submission.

The bottom bar shows selected row count, selected item quantity, selected product amount, selected service fee amount, and `确认接单`. It must sit above the mobile bottom navigation and safe area.

The confirmation step uses the existing responsive overlay pattern: Drawer on mobile, Dialog on desktop. The copy should state that selected rows will become a captain procurement task.

## API Facades

All route and component code calls `@sast-shop/api`.

### `listErrandDemandStores`

Uses `ErrandDemandService.GetDemandList` for `mock` and `local`.

Input:

```ts
interface ListErrandDemandStoresOptions extends ServiceOptions {
  storeName?: string;
  page?: number;
  pageSize?: number;
}
```

Output:

```ts
interface ErrandDemandStoreSummary {
  storeId: string;
  storeName: string;
  participantAvatars: string[];
  totalOriginUnitPriceCents: number;
  totalServiceFeeCents: number;
  updatedAt: string | null;
}
```

The UI may derive total amount as product amount plus service fee.

### `getErrandDemandDetails`

Uses `ErrandDemandService.GetDemandDetail` for `mock` and `local`.

Input:

```ts
interface GetErrandDemandDetailsInput {
  storeId: string;
}
```

Output:

```ts
interface ErrandDemandDetailGroup {
  errandDemandId: string;
  productTemplate: ProductTemplate | null;
  estimatedUnitPriceCents: number;
  quantity: number;
  requesters: ErrandDemandRequester[];
}

interface ErrandDemandRequester {
  requesterId: string;
  requesterName: string;
  requesterAvatarUrl: string;
  quantity: number;
  serviceFeePerUnitCents: number;
  errandDemandItemId: string;
  deadline: string | null;
  updatedAt: string | null;
}
```

### `createErrandTask`

Uses `ErrandTaskService.CreateTask` for `mock` and `local`.

Input:

```ts
interface CreateErrandTaskInput {
  storeId: string;
  demandItems: Array<{
    errandDemandItemId: string;
    updatedAt?: string | null;
  }>;
}
```

Output:

```ts
interface CreateErrandTaskResult {
  errandTaskId: string;
}
```

Validation:

- `storeId` and `errandDemandItemId` must be positive int64 strings.
- `demandItems` must not be empty.
- `updatedAt`, when present, must be a valid timestamp.

### `listErrandTasks`

Uses `ErrandTaskService.GetErrandTaskList` for `mock` and `local`. This slice only needs enough fields to show task handoff cards.

Output:

```ts
interface ErrandTaskBrief {
  id: string;
  storeId: string;
  storeName: string;
  status:
    | "shopping"
    | "pending_distributing"
    | "distributing"
    | "collecting_payment"
    | "completed"
    | "cancelled"
    | "unknown";
  itemCount: number;
  createdAt: string | null;
}
```

## Data Flow

1. `/group` links the restock `跑腿大厅` entry to `/group/errand`.
2. `/group/errand` server component loads `listErrandDemandStores`.
3. The client hall component handles store search and navigation to `/group/errand/[storeId]`.
4. `/group/errand/[storeId]` server component loads `getErrandDemandDetails`.
5. The client detail component owns selection state and totals.
6. On confirmation, the client submits `createErrandTask`.
7. On success, the UI clears submit state, shows `接单成功`, and routes to the captain task handoff location.
8. On conflict or validation failure, the UI stays on the detail page, preserves context where possible, and refreshes current demand data.

## UI And Interaction Notes

- Use the Action Coral `primary` token for primary actions. Do not copy raw orange values from the old prototype.
- Cards stay at the current project radius scale and do not use broad shadows.
- No card nesting. Product groups and requester rows can use bordered rows inside a section, but avoid card-in-card styling.
- Use existing shared components first: `Button`, `Card`, `Badge`, `Input`, `ResponsiveDialog`, `Empty`, `Avatar`, and `ManagedImage`.
- Every interactive card must have focus-visible styling and keyboard activation.
- Every hall card uses the same action affordance. No item should look special unless the product explicitly defines a pinned state.
- Requester rows always show avatar and service fee.
- The product-level checkbox toggles every selectable requester row in that product group.
- Disabled requester rows remain visible with a clear reason when required row identifiers are missing.
- Selection totals update immediately and use cents from facade data.
- Confirmation copy must mention that selected demand rows become a procurement task.

## Error Handling

- Loading hall and detail pages use skeleton rows.
- Empty hall shows `暂无待接单需求`.
- Empty detail shows `这个店铺暂无可接单需求`.
- Failed hall load shows a clear retryable unavailable state.
- Failed detail load shows a clear unavailable state and a return path to the hall.
- Submit with no selected rows is disabled and does not call the API.
- Submit in progress disables controls and preserves selections.
- Submit conflict shows `部分需求已被接单，请刷新后重试` and refreshes the route.
- Submit success shows `接单成功`.
- `remote` data source throws `FeatureUnavailableError`; the UI displays unavailable copy and does not fallback to mock.

## Testing And Verification

Automated checks:

- Add Vitest coverage for `listErrandDemandStores` mapping and validation.
- Add Vitest coverage for `getErrandDemandDetails` mapping, requester row timestamps, and missing product templates.
- Add Vitest coverage for `createErrandTask` input validation and request mapping.
- Add Vitest coverage for `listErrandTasks` status mapping if that facade is included.
- Extract and test selection/totals helpers if the client detail component becomes hard to reason about.
- Run `pnpm lint`.
- Run `pnpm build` because this adds routes and API facade exports.

Manual smoke checks:

- `/group` has a working `跑腿大厅` entry.
- `/group/errand` renders loading, empty, error, search, and populated states.
- Every hall card has the same visible `查看需求` affordance.
- `/group/errand/[storeId]` displays product groups and requester rows.
- Every requester row has an avatar and visible service fee.
- Product-level checkbox toggles child rows.
- Bottom bar totals match selected rows.
- Confirmation overlay opens and closes on mobile and desktop.
- Successful submit navigates to the expected handoff location.
- Mobile 390×844 does not collide with bottom navigation or safe area.
