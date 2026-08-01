# Order Switching UX Design

## Context

The mobile order page currently mixes order type and user perspective in a way that makes the switching model feel unclear. The target model is:

- Order type: `spot` and `errand`.
- Spot perspectives: buyer and seller.
- Errand perspectives: participant and captain.

All entrances should remain visible. The UI should avoid unsupported cross-combinations such as errand seller or spot captain, and it should not present unavailable paths as "coming soon" empty states.

The design follows the PRD requirement that order lists are type-specific, use Brief fields on the list, persist filters through URL parameters, and only load Detail data on the detail page.

## Design Goals

1. Make order type the only primary navigation level.
2. Make perspective switching feel contextual, not like another primary tab row.
3. Keep search and status filters lightweight and outside cards.
4. Use richer status badges with controlled semantic tones, including dark mode.
5. Use theme colors for active controls and amounts.
6. Preserve mobile ergonomics from 320px to 428px.

## Page Structure

The order page is a single-column mobile task surface:

1. Header row: title `订单` and current result count.
2. Primary type tabs: `现货` and `跑腿`.
3. Type heading row:
   - Left: `现货订单` or `跑腿订单`.
   - Right: custom `PerspectiveSwitch`.
4. Search input.
5. Horizontal status filters.
6. Order cards.
7. Empty state for the current valid combination.

Search and status filters are not wrapped in a card. They sit directly in the page flow so the list reads as a compact tool surface instead of a stack of panels.

## Perspective Switch

Use a custom project component instead of forcing a stock control.

Component name: `PerspectiveSwitch`.

Behavior:

- Renders two options for the current type.
- Spot labels: `我买`, `我卖`.
- Errand labels: `拼单`, `团长`.
- Uses theme color for the active indicator.
- Aligns visually with the current type heading:
  - Baseline aligned with `现货订单` / `跑腿订单`.
  - Right edge aligned with the page content edge.
  - Fixed height to avoid layout shift.
- Supports keyboard and screen readers with `role="radiogroup"` and `aria-checked`.
- Supports left/right arrow key navigation.
- The sliding indicator is decorative; React state and URL parameters are the source of truth.

Dark mode:

- The inactive surface uses dark `muted`.
- The active indicator uses the theme primary color or a high-contrast active surface, depending on contrast.
- Text contrast must meet WCAG AA.

## State Model

URL parameters:

- `type=spot|errand`
- `view=buyer|seller|participant|captain`
- `status=<status>`
- `q=<search>`

Defaults:

- `type=spot`
- Spot default view: `buyer`
- Errand default view: `participant`
- Status default: `all`
- Query default: empty string

Switching rules:

- Switching type restores that type's last valid view in local component state.
- First visit to a type uses its default view.
- If a URL has an invalid view for the selected type, coerce it to that type's default view.
- Switching type or view resets `status` to `all` and clears `q`.
- Browser back and forward restore the URL state.

Valid combinations:

| Type     | View          | Meaning                                                |
| -------- | ------------- | ------------------------------------------------------ |
| `spot`   | `buyer`       | Spot orders where current user is buyer                |
| `spot`   | `seller`      | Spot orders where current user is seller               |
| `errand` | `participant` | Errand demand orders where current user is participant |
| `errand` | `captain`     | Errand tasks where current user is captain             |

## Status Filters

Status filters are scoped by type and view.

Spot buyer:

- `全部`
- `待支付`
- `处理中`
- `已完成`
- `已取消`

Spot seller:

- `全部`
- `待收款`
- `已付款`
- `处理中`
- `已完成`
- `已取消`

Errand participant:

- `全部`
- `未接单`
- `采购中`
- `待分发`
- `分发中`
- `待支付`
- `已完成`
- `已取消`

Errand captain:

- `全部`
- `采购中`
- `待分发`
- `分发中`
- `收款中`
- `已完成`
- `已取消`

Use a horizontal, scrollable status control. The selected state uses theme foreground/background contrast, not a second brand color.

## Badge Tones

Status badges need more color than the current `Badge` variants provide, but colors should be controlled by UI-level tone variants or helpers rather than raw Tailwind classes in page JSX.

Proposed tones:

| Tone        | Example statuses |
| ----------- | ---------------- |
| `neutral`   | 未接单           |
| `warning`   | 采购中           |
| `info`      | 待分发, 分发中   |
| `payment`   | 待支付           |
| `attention` | 待收款           |
| `review`    | 已付款           |
| `success`   | 已完成           |
| `danger`    | 已取消           |

Implementation can either extend `Badge` with controlled tone variants or add an order-specific helper that maps tone to approved semantic classes. The preferred path is extending `Badge` so other surfaces can reuse the tones.

Dark mode:

- Every tone has light and dark color pairs.
- Tone text and backgrounds must meet WCAG AA.
- Avoid scattering `dark:*` classes through order card markup; keep the mapping centralized.

## Order Cards

Cards remain compact and list-oriented.

Each card shows:

- Order number in mono text.
- Order title or top product names.
- Status badge.
- Store name or order source.
- Summary from Brief fields.
- Amount in theme primary.

Do not show logistics placeholders or unsupported shipping actions. The list page only uses Brief data; detail pages fetch Detail data later.

## Empty And Error States

Empty states are valid per type and view. They should not say "暂未开放" when the entrance is part of the intended model.

Examples:

- `暂无现货买方订单`
- `暂无现货卖方订单`
- `暂无跑腿拼单订单`
- `暂无团长任务`

Errors should preserve partial data when possible. If one type fails while another succeeds, show the current type's error only when the user enters that type.

## Component Choices

Use existing shared UI where it fits:

- `Tabs` for primary type switching.
- `InputGroup` for search.
- `Badge` with extended tone support for statuses.
- `Empty` for valid empty states.
- `Card` for order cards.

Use a custom component where it improves UX:

- `PerspectiveSwitch` for perspective switching.

This custom component must still follow accessibility expectations and use theme tokens.

## Dark Mode

Dark mode is in scope for this redesign.

The implementation should introduce or complete dark semantic tokens for:

- `background`
- `foreground`
- `card`
- `card-foreground`
- `muted`
- `muted-foreground`
- `secondary`
- `secondary-foreground`
- `border`
- `input`
- `ring`
- badge tone colors

The order page should consume tokens through shared UI components and helpers. It should not hardcode page-local color palettes.

## Testing And Verification

Code verification:

- Run `pnpm lint`.
- Run targeted unit tests if order filter helpers are extracted.

Visual verification:

- Start `pnpm dev:mobile`.
- Check mobile viewport 390 x 844.
- Check 320px width for text overflow.
- Check desktop-width mobile app container.
- Verify light and dark mode screenshots.
- Verify keyboard focus for primary tabs, `PerspectiveSwitch`, search, status filters, and order cards.

Interaction verification:

- Type switch restores that type's last view.
- Invalid URL view is coerced to default.
- Type or view change resets status and search.
- Browser back and forward restore URL state.
- Status badge colors remain readable in light and dark mode.

## Out Of Scope

- Order detail page redesign.
- Payment dialog changes.
- Captain task processing workflow.
- New backend endpoints.
- Full desktop order management redesign.
