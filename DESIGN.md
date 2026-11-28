---
name: SAST Shop
register: product
theme: system (light / dark via prefers-color-scheme)
tokens: packages/ui/src/styles/globals.css
---

# SAST Shop Design System

## Overview

SAST Shop is a compact, task-oriented campus commerce interface built for Feishu mobile (`apps/mobile`) and desktop (`apps/desktop`). Warm neutral surfaces, crisp bordered cards, clear semantic status badges, and a single **Action Coral** interactive accent keep focus on products, prices, order states, and payment verification.

- **Quiet chrome, compact density**: Task flows prioritize scannability and rapid completion over marketing whitespace, decorative gradients, or full-screen hero banners.
- **Single brand accent**: Action Coral (`#c9431f` light / `#ff9a78` dark) carries primary actions, links, active states, and focus rings. No secondary brand color exists.
- **System color scheme**: Shared semantic CSS variables and native controls switch automatically via `@media (prefers-color-scheme: dark)` in `packages/ui/src/styles/globals.css` without reload. Product photos and brand illustrations retain their original colors; payment QR codes keep a white quiet zone for reliable scanning.

## Color Tokens

All UI surfaces, text, borders, and statuses consume semantic tokens defined in `packages/ui/src/styles/globals.css` (mapped via `@theme inline`). Avoid hardcoding raw hex values in app code.

### Core & Domain Tokens

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--background` | `#f6f3ef` | `#111114` | Page canvas (warm cream / near-black) |
| `--foreground` | `#1d1d1f` | `#f5f5f7` | Primary ink |
| `--card` / `--popover` | `#ffffff` | `#1b1b20` | Elevated card, sheet, dialog, and popover surface |
| `--primary` | `#c9431f` | `#ff9a78` | Action Coral / Soft Coral interactive accent |
| `--primary-foreground` | `#ffffff` | `#2b1008` | Text/icon on `--primary` |
| `--secondary` | `#f0ebe5` | `#24242a` | Secondary button and subtle control surface |
| `--secondary-foreground` | `#333333` | `#f5f5f7` | Text on `--secondary` |
| `--muted` | `#eeeae5` | `#202026` | Muted fills, drag handles, subtle hover surfaces |
| `--muted-foreground` | `#6e6e73` | `#a1a1aa` | Secondary labels, hints, placeholders |
| `--accent` | `#fff0e8` | `#24242a` | Soft coral-tinted highlight surface |
| `--destructive` | `#d70015` | `#ff453a` | Errors, destructive actions, cancellations |
| `--border` | `#e3dcd4` | `#303038` | Card, divider, and header borders |
| `--input` | `#d9d0c7` | `#3a3a42` | Text input borders |
| `--ring` | `#c9431f` | `#ff9a78` | Keyboard `focus-visible` ring |
| `--image-surface` | `#f3ede5` | `#28231f` | Product image container & loading placeholder fill |
| `--section-highlight` | `#fff0e8` | `#3a211a` | Emphasized notice/section tint (`--section-highlight-foreground`: `#71301e` / `#ffd8c9`) |
| `--service-fee` | `#92540f` | `#f0ba70` | Errand / service fee text accent |

### Semantic Status Badges

`Badge` variants pair background, foreground, and 1px border tokens so status remains legible in both light and dark modes (never rely on color alone — always include clear status text):

| Variant | Light (bg / fg / border) | Dark (bg / fg / border) | Typical Use |
| --- | --- | --- | --- |
| `neutral` | `#f5f5f7` / `#333333` / `#e0e0e0` | `#24242a` / `#d6d6dc` / `#3a3a42` | Closed, cancelled, neutral tags |
| `warning` | `#fff4d8` / `#8a4b00` / `#f2d18b` | `#3d2a08` / `#ffd98a` / `#76540c` | Pending acceptance, caution |
| `info` | `#e8f7ff` / `#006b9a` / `#bfe6f8` | `#082f42` / `#8bdfff` / `#155f80` | In progress, purchasing, distributing |
| `payment` | `#eaf2ff` / `#0759bd` / `#c8dcff` | `#102a4d` / `#8ec5ff` / `#1f4f87` | Awaiting payment / bill states |
| `attention` | `#fff0e7` / `#a33b00` / `#ffd0b8` | `#4a1f05` / `#ffbc91` / `#873d12` | Action required, partial delivery |
| `review` | `#f1eaff` / `#6731a6` / `#ddccff` | `#2b184f` / `#c7a8ff` / `#593894` | Reported payment awaiting confirmation |
| `success` | `#e8f8ee` / `#08723d` / `#bfe8cd` | `#0b3320` / `#8fe0ad` / `#176239` | Completed, confirmed, active |
| `danger` | `#fff0f0` / `#c21f32` / `#ffd1d6` | `#4a1118` / `#ff9aa6` / `#8a2632` | Failed, error, rejected |

## Typography

- **Sans (`--font-sans`)**: `"SF Pro Text", "SF Pro Display", system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", Arial, sans-serif` — no external Google Fonts.
- **Mono (`--font-mono`)**: `ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace` — used for order numbers, barcodes, and payment remark codes.
- **Scale & weights**: Standard Tailwind utility ladder (`text-xs` 12px badges/meta, `text-sm` 14px desktop body/buttons/descriptions, `text-base` 16px mobile text inputs to prevent iOS auto-zoom, `text-lg` 18px sheet/dialog titles & key prices). Weights use `400` (body), `500` (buttons, badges, labels), and `600` (titles, prices, emphasis).
- **Numeric alignment**: Apply `tabular-nums` to all monetary amounts, quantities, counts, and order/payment codes.

## Layout & Responsive Architecture

Spacing follows Tailwind's 4px/8px grid (`p-4` card interiors, compact vertical stacks, `InfiniteListStatus` at list tails so the final card never collides with bottom edges).

### Mobile (`apps/mobile` — 320px–428px, primary viewport 390×844)
- **Viewport shell (`MobileShell`)**: Fixed `h-dvh` flex column; scrolling stays strictly inside `MobileScrollArea` with hidden `app-scrollbar` so content never scrolls behind navigation.
- **Primary routes (`/shop`, `/group`, `/orders`, `/profile`)**: No secondary top bar. Fixed bottom nav (`h-16` + `env(safe-area-inset-bottom)`, `max-w-md`) displays four module tabs flanking a raised center circular `+` publish button (`size-14 rounded-full`, opening the publish/Pocket Drawer). Hides automatically and drops its spacer when the virtual keyboard opens (`useMobileKeyboard`).
- **Secondary routes**: Sticky translucent top bar (`MobileHeader`, `min-h-13`, `bg-background/90 backdrop-blur-xl`, left back + home buttons, scroll-revealed centered title, right action slot aligned to content edges).

### Desktop (`apps/desktop` — 900px–1440px+)
- **Viewport shell (`DesktopShell`)**: Fixed `h-dvh` grid with a left sidebar (`4.5rem` icon rail expanding to `14rem` at `lg:`) containing the `SastShopMark` header, 4 primary nav links, and bottom "上架现货" CTA. Main content scrolls independently inside `max-w-7xl px-5 py-6 xl:px-8`.
- **Information density**: Multi-column scannable layouts, side-by-side forms, independent filter axes (search, view, type, status never silently reset each other), and full keyboard support without hover-only actions.

## Shapes, Borders & Elevation

Radii derive from `--radius: 0.625rem` (10px):

- **`--radius-sm` (6px)**: Compact tags and nested controls.
- **`--radius-md` (8px)**: `Button`, `Input`, `Badge`, `Select`, inline thumbnails.
- **`--radius-lg` (10px)**: Standard `Card` (`rounded-lg border border-border bg-card`).
- **`--radius-xl` (14px)**: `Dialog` content, feature entry cards.
- **Special radii**: `rounded-t-[18px]` for mobile bottom `Drawer`; `rounded-full` for circular publish FAB, avatars, and drag handles.
- **Elevation**: Cards and list items stay flat with `1px` `--border` separation; shadows (`shadow-lg`, `shadow-xl`) are reserved for floating overlays (`Drawer`, `Dialog`, center FAB).

## Components & Interaction Patterns

Shared primitives live in `packages/ui/src/components` (Radix UI + Vaul + shadcn patterns) and must preserve Radix `data-*` state attributes and accessibility semantics.

- **Buttons (`Button`)**: Variants `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`, `text`, `plain`, `destructive-text`. Touch-first sizing (`h-11` / 44px on mobile; `md:h-9` default, `md:h-8` sm, `md:h-10` lg on desktop; `size-11 md:size-9` icon buttons). Subtle press feedback (`active:not-aria-[haspopup]:translate-y-px`) and `focus-visible:ring-3 focus-visible:ring-ring/50`.
- **Text Controls (`Input`, `Textarea`, `InputGroup`)**: `h-11 md:h-9`, `rounded-md border-input bg-card`, `text-base md:text-sm`, invalid styling via `aria-invalid`.
- **Overlays (`Drawer`, `Dialog`, `ResponsiveDialog`)**: Mobile uses bottom `Drawer` (`max-h-[88dvh]`, drag handle, `overflow-hidden`, internal body scroll, `DrawerFooter` with safe-area padding) — never Sheet. Desktop uses centered `Dialog` (`rounded-xl bg-popover p-6 sm:max-w-md`). `ResponsiveDialog` switches at `min-width: 768px`.
- **Expandable Cards**: Maintain `aria-expanded` and use `Collapsible` animations; never nest interactive `<button>` elements inside clickable card headers.
- **Media & Feedback**: Use `ManagedImage` for product/store photos with `--image-surface` placeholder (no broken-image icons); use `Empty`, `LoadFailure`, `InfiniteListStatus`, `Skeleton`, and `Sonner` toasts consistently.

## Shop Transaction UI

- **Identity & avatars**: Show a person's avatar beside their name in payment and order details using API identity, with an initial fallback when unavailable.
- **Payment platform marks**: Display the WeChat Pay or Alipay symbol beside the platform name (following the selected collection code or bill channel). Platform symbols use their own brand colors; adjacent names and buttons stay in semantic app colors.
- **Bill & payment status**: Keep submitted-payment status inside the bill card. Clearly distinguish a payer's payment report from confirmed receipt, and avoid a second card repeating the same status.
- **Payment remark code ("付款标识码")**: Explain via `PaymentCodeHelp` (adjacent `?` icon opening a `Drawer` on mobile or `Popover` on desktop) with `TextHighlight` subtle marker underlines on key instructions. Treat transaction-number supplementation as a secondary aid inside the bill card when the payer forgot the remark.
- **Drawer reachability**: Reserve safe-area bottom spacing below Drawer content and footer actions; scroll only the inner body so actions remain reachable on short screens.
- **Errand distribution rows**: Use compact todo rows — a checkbox records full distribution or revokes a recorded result, while adjacent 44px touch controls expose partial distribution and skipping. Partial and skipped results show the mixed/indeterminate state with explicit quantity/status text.
- **Header & copy controls**: Align mobile secondary-page header actions with content edges on wide screens. Keep copy buttons (`CopyButton`) at 24px in normal layout flow so hover/pressed states never cover adjacent numbers.
- **Business cancellation**: Place order/demand/task cancellation actions at the page header's right edge as red text-only buttons (`destructive-text`, no icons), always guarded by confirmation dialogs and pending/unverified-result recovery checks. Form cancellations and row-level actions remain in context.

## Loading States

- Match each route's real title, filters, card proportions, responsive columns, and detail sections; mobile and desktop use their own page structures, and payment verification uses a separate fallback from purchasing.
- Keep navigation mounted in the shared shell, reserve space for fixed bottom bars, and keep placeholders non-interactive without invented prices, names, counts, or statuses.
- Reuse the same card skeleton for initial loading and pagination. Retain existing content during local refreshes, scoping placeholders to the updating region.
- Group placeholders under an accessible loading status, hide decorative shapes (`aria-hidden`), and use shared `Skeleton` tokens with reduced-motion support.

## Brand Assets & Iconography

Source files and prompts live in `design/brand/` and export via `node design/brand/export-assets.mjs` to both apps' `public/brand/` as lossless transparent WebP (`384×384` for empty states; `256×256` `-compact` for `≤64px` entries).

- **Visual language**: Matte warm clay illustrations combining cream-white and Action Coral (`#c9431f`), rendered via `BrandIllustration` with empty `alt=""` (decorative; pages always provide clear text titles/status).
- **Navigation & utility icons**: Primary navigation uses custom monochrome marks (`SastShopMark`, `SastGroupMark`, `SastOrdersMark`, `SastProfileMark` at 24px mobile / 20px desktop) inheriting theme/active color. Utility controls use Remixicon (`@remixicon/react`).
- **Boundaries**: Never replace real user avatars, product photos, store logos, or WeChat/Alipay symbols with brand illustrations; collection-code illustrations are intentionally abstract and non-scannable.

## Motion & Accessibility

- **Motion**: Keep transitions brief and functional (`slide-up`/`slide-down` 160ms ease-out; `collapsible-down`/`collapsible-up` 200ms `cubic-bezier(0.16, 1, 0.3, 1)`). Respect `@media (prefers-reduced-motion: reduce)` across custom animations, Radix collapsibles, Vaul drawers, dialogs, and buttons.
- **Accessibility baseline**: WCAG 2.1 AA contrast, visible keyboard focus (`focus-visible`), minimum `44×44px` touch targets on mobile (including distribution controls, icon buttons, and bottom bar actions), semantic HTML first, and clear Chinese copy without unexplained jargon.
