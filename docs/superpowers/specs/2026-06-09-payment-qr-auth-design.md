# Payment QR, Bill Flow, and Auth Design

## Context

The current mobile spot-goods flow added a payment drawer and profile dialogs, but review found several gaps against the PRD:

- Payment shows a frontend-generated verify code instead of a backend bill verify code.
- Clicking payment can leave the drawer stuck in a disabled loading state.
- Payment QR code data can still be treated as image content.
- Uploading a spot good does not require the seller to have a payment QR code.
- Address and payment QR dialogs are globally mounted but not globally addressable.
- `ManagedImage` still uses `<img>`, causing a Next.js lint warning.
- Auth is not wired for real backend calls.

This design keeps local development smooth while aligning the production flow with the PRD.

## Goals

- Store only decoded QR text in the backend, never QR image data.
- Decode uploaded QR images in the browser and send only validated text.
- Render QR codes from backend text on the frontend, with the payment channel logo centered.
- Use backend `Bill` data for payment amount, verify code, status, and concurrency timestamps.
- Open the payment panel immediately with a skeleton while order, bill, and QR data load.
- Support environment-controlled auth: disabled for mock/local development, required for real backend.
- Prefer shared UI components; add missing shared primitives such as `Empty` before hand-writing repeated states.
- Remove the `ManagedImage` `<img>` lint warning by using `next/image`.

## Non-Goals

- Do not implement the full errand purchase, distribution, and collecting-payment workflow in this pass.
- Do not add a permanent floating global profile button.
- Do not store session tokens in `localStorage`, URL parameters, public environment variables, or React client state.
- Do not upload payment QR images to the backend.
- Do not implement payment app callback detection; the flow remains trust-based with "I have paid".

## Approach

Use a frontend-decoded, backend-text-only QR code flow.

The user uploads a QR image in the profile payment QR dialog. The browser decodes the image into text, validates that text against a channel-specific allowlist, then calls the existing `QrCodeService.UpdateQrCode` facade with the decoded text. When rendering a payment QR code, the frontend generates the QR bitmap/SVG from that text and overlays the WeChat or Alipay logo.

This matches the product intent and avoids storing sensitive image data.

## QR Upload Flow

1. User opens the global payment QR dialog.
2. User selects an image for WeChat or Alipay.
3. The client validates file size and image MIME type.
4. The client decodes QR text locally.
5. If decoding fails, show a toast.
6. If decoded text does not match the selected channel allowlist, show a toast and do not save.
7. If valid, call `updatePaymentQrCode({ channel, content })`.
8. On success, update local state and render the QR code from the saved text.

The save request sends only the decoded text.

## QR Text Validation

Validation uses an allowlist, not a blacklist.

Common checks:

- Trimmed content must be non-empty.
- Content length must be capped.
- Control characters are rejected.
- Content must match the selected channel's known URL or scheme patterns.

WeChat accepts only explicitly recognized WeChat payment QR text forms, such as known WeChat payment schemes or trusted payment hosts. Alipay accepts only explicitly recognized Alipay payment QR text forms, such as known Alipay schemes or trusted payment hosts.

Unknown or ambiguous QR content is rejected with a user-facing toast.

The API facade also validates content so image data cannot re-enter the data layer through tests or non-UI callers.

## QR Rendering

Add a mobile/shared business component for payment QR display:

- Props: `content`, `channel`, `alt`, and optional sizing.
- Generates a QR code from text.
- Overlays the channel logo in the center.
- Uses shared UI primitives for loading and error states.

`PaymentDialog` and the profile QR list both render QR content through this component. They no longer treat QR content as an image URL.

## Spot Payment Flow

Clicking "buy now" opens the payment panel immediately in a skeleton state.

The payment flow then:

1. Creates the spot order through the spot order facade.
2. Reads the `bill` embedded in the returned `SpotOrderDetail`.
3. Loads the seller's QR code text for available payment channels.
4. Shows the ready payment panel with backend bill amount and `bill.verifyCode`.
5. When the user clicks "I have paid", calls `BillService.PayBill` with `billId`, selected `channel`, and `updatedAt`.
6. On success, switches the panel to the submitted state.

The frontend does not call `BillService.CreateBill` for spot orders if the spot order response already contains a bill. `BillService.CreateBill` is reserved for flows that need standalone bills.

The frontend no longer generates verify codes.

## Payment Panel States

### Loading

Use `Skeleton` for the QR square, amount row, verify-code row, and action area. This state appears immediately after opening the payment panel.

### Ready

Show:

- Payment channel tabs.
- QR code rendered from text.
- Amount from the backend bill/order.
- Backend verify code.
- Copy action for the verify code.
- Save QR action for the rendered QR code.
- Open scanner action.
- "I have paid" button with channel color.

Missing one channel disables that channel. Missing all channels shows an `Empty` state with a retry or close action.

### Submitted

After `PayBill` succeeds:

- Title changes to "Waiting for payment confirmation".
- QR code and channel switching are hidden.
- Show channel, verify code, transaction number if available, supplemental serial number if available, and guidance text.
- Do not leave the panel stuck in a loading button state.

### Error

Use `Empty` inside the payment panel for page-sized failures:

- Failed to create order or bill.
- Failed to load payment bill.
- Seller has no usable payment QR code.

Use toast for short user-action failures:

- QR image decode failed.
- Wrong channel QR image uploaded.
- File too large or invalid type.

Use inline errors for form-field failures and recoverable save failures where old content remains visible.

## Seller QR Requirement

Before creating a spot listing, the mobile publish flow checks whether the seller has at least one configured payment QR code.

If none exists:

- Open the global payment QR dialog.
- Explain that a payment QR code is required before publishing spot goods.
- Do not submit the listing until at least one QR code is saved.

## Global Dialog Access

Keep `ProfileDialogsProvider` mounted at the mobile root.

Add URL-driven dialog opening:

- `?dialog=qr-code`
- `?dialog=address`

Business flows can also open dialogs through context. No permanent floating button is added.

## Auth Design

Authentication is controlled by environment configuration.

Use `NEXT_PUBLIC_AUTH_MODE=off|required` as the public behavior switch. The value is not a secret; it only controls whether UI and client-side routing expect an authenticated session. Server-side proxy code also reads `AUTH_MODE=off|required`, defaulting to the public value when the private value is absent.

Development defaults:

- `mock` and `local` data sources run with auth disabled.
- Local fauxrpc continues to work without a real backend or real Feishu auth.

Real backend mode:

- Auth is required.
- Login obtains a session token from the backend auth service.
- The session token is stored only in an httpOnly cookie.
- Browser JavaScript cannot read the token.
- Authenticated API calls go through a Next server route/proxy.
- The proxy reads the cookie and adds the backend auth header.
- Missing or expired sessions produce an explicit unauthenticated state.

The API facade does not silently fall back between `remote`, `local`, and `mock`.

## UI Components

Use existing shared components when possible:

- `Skeleton` for loading.
- `Tabs` for payment channel switching.
- `Badge` for status and channel labels.
- `Button` for actions.
- `Field`, `FieldError`, and `InputGroup` for forms.
- `ResponsiveDialog` for desktop Dialog and mobile Drawer behavior.
- `sonner` for toast feedback.

Add a shared `Empty` component in `packages/ui` for panel-level empty and error states. It should support an icon, title, description, and action slot.

Payment QR rendering is a business component that composes shared primitives rather than becoming a generic UI primitive too early.

## UI/UX Treatment

This is product UI. The interface should feel familiar, dense enough to finish a task, and restrained. The visual design serves payment clarity rather than brand expression.

### Payment Panel

The payment panel is a task surface, not a product card.

- Header: title first, one short sentence of guidance second. Do not repeat the product name or order summary in the panel.
- Loading state: show skeletons in the same spatial positions as the final QR square, amount row, verify-code row, and bottom actions. Avoid centered spinners.
- Ready state: QR code is the visual anchor. Amount and verify code sit below it as separate scan-friendly rows.
- Verify code: use a high-contrast badge-like treatment, a monospace numeric style, and a copy button. Do not rely on color alone.
- Primary action: label is "我已支付"; button color follows the selected channel only in the ready state.
- Submitted state: remove QR and tabs. The focus shifts to "待确认收款", payment channel, verify code, and optional serial number.
- Error state: use `Empty` inside the panel with a direct title, short explanation, and one primary recovery action.

### QR Management Dialog

The QR management dialog is a settings surface.

- Use two equal channel items for WeChat and Alipay.
- Each item shows the generated QR preview when configured.
- Empty channel items show a neutral icon, "未上传", and an upload action.
- Configured channel items use "修改", not "上传", and never show delete.
- Decode failures, wrong-channel uploads, invalid files, and overlarge files use toast feedback because they are immediate user-action errors.
- Save failures preserve the existing QR preview and show an inline error near the affected channel.

### Empty and Error States

Add `Empty` as the standard panel-level empty/error component.

`Empty` supports:

- Icon slot.
- Title.
- Description.
- Optional action slot.

Use `Empty` for payment-panel failures, missing seller QR codes, unauthenticated states, and not-yet-connected order tabs. Do not use ad hoc bordered cards for these states.

### Auth States

When auth is required and the user is not authenticated:

- Show a focused `Empty` state in the affected surface.
- The title should name the blocker, for example "需要登录后继续".
- The description should name the next step, not explain implementation details.
- The action label should be a verb-object phrase, such as "登录飞书账号".

### Order Page

The order page stays utilitarian.

- Use tabs or segmented controls for "我买的" and "我卖的".
- Persist filters in URL parameters without visual ceremony.
- Not-yet-connected tabs use shared `Empty` with specific copy, not placeholder cards.
- Keep cards compact and scan-friendly: order number, status, title, quantity, amount, and store/seller are enough for the list.

### Motion

Motion communicates state only.

- Drawer open/close uses existing `ResponsiveDialog` behavior.
- QR decode/save does not animate beyond loading feedback.
- State changes use normal component transitions from the design system.
- Respect reduced motion.

## ManagedImage

Migrate `ManagedImage` from `<img>` to `next/image`.

Keep the existing public behavior:

- Loading skeleton.
- Empty state.
- Error placeholder.
- Caller-provided class names.

This removes the Next lint warning without changing existing product image call sites more than necessary.

## Order Page Scope

This pass lightly improves the order page but does not implement all errand states.

In scope:

- Add buyer/seller perspective switching.
- Persist perspective, status, and query in URL parameters.
- Use shared `Empty` for not-yet-connected errand and captain task states.

Out of scope:

- Full errand purchase handling.
- Captain shopping, distribution, and collecting-payment task details.
- Complete order detail pages for every status.

## Testing

Add or update tests for:

- QR text validation: allows known channel text, rejects wrong channel, rejects overlong or malformed text.
- QR image parsing utility: decode success, decode failure, invalid file type, too-large file.
- Payment QR facade: content validation and local Connect request mapping.
- Bill facade: create, pay, confirm, get, and supplement serial number local Connect request mapping.
- Spot payment state flow: loading, ready, submitted, and error states.
- Publish spot goods: missing QR code opens the QR dialog instead of submitting.
- Auth mode: disabled local mode does not require a session; required mode without a session surfaces unauthenticated state; required mode with a session adds backend auth.
- `ManagedImage`: loading, empty, error, and successful render behavior after `next/image` migration.

Verification commands:

- `pnpm lint`
- `pnpm typecheck`
- Relevant package tests with `pnpm --filter ... test`
- Mobile visual smoke check for the payment panel and QR management dialog when UI changes are complete.
