# 现货全链路打磨设计

## Context

SAST Shop 一期 PRD 要求 MVP 优先保证团购和支付上线，同时现货商品需要支持浏览、直接购买、发布现货和基于信任的支付核对。当前仓库已经有 `apps/mobile` 现货商城、上架现货页面、`@sast-shop/api` facade，以及 mock/local 数据源边界。本设计聚焦现货链路的小步打磨，不进入跑腿 task、订单详情、物流或 OCR 范围。

## Goals

- 让现货发布、现货浏览、商品详情和支付弹层形成可验收的轻量闭环。
- 使用 shadcn-style 组件语义重做表单和反馈，不再使用散装字段和临时状态提示。
- 保持 PRD 的支付边界：平台不托管资金，支付弹层只展示平台、二维码、金额、付款标识码和操作按钮。
- 保持 facade 边界：页面和组件只调用 `@sast-shop/api`，不直接 import proto 生成物。

## Non-goals

- 不实现跑腿购物车、团长采购 task、订单详情页、物流、发货、OCR、真实支付拉起或真实相册保存。
- 不新增后端未提供字段的展示占位，不虚构运费、物流或发货能力。
- 不重做整体视觉系统，只在现货链路内提升信息结构、状态表达和组件规范。

## Surfaces

### 上架现货

`PublishSpotForm` 使用 shadcn 表单体系组织字段：

- `FieldGroup` 作为表单容器。
- `Field`、`FieldLabel`、`FieldDescription`、`FieldError` 表达字段语义、说明和错误。
- 条码输入使用 `InputGroup`，组合条码输入、扫码按钮和查询按钮。
- 表单校验使用 React Hook Form + Zod。

字段规则：

- 条码不能为空。
- 必须选择一个商品模板。
- 售价必须大于 0。
- 库存必须为正整数。

条码查询结果：

- 未查询时展示字段说明。
- 无匹配模板时 toast 提示，并在页面内展示轻量空状态。
- 多个模板命中时以候选列表展示，明确店铺和商品描述，用户必须选择其中一个。
- 提交成功后 toast 提示“已提交上架”，并将页面状态置为已提交。
- 提交失败后 toast 提示错误，字段值保留，方便重试。

### 现货商城

`SpotMarketplace` 增加轻量搜索和结果状态：

- 搜索范围为商品标题、描述、卖家和条码。
- 有结果时展示现有商品卡片，并强化售价、原价、库存和卖家信息。
- 无结果时展示清晰空状态，提示用户调整关键词。
- 数据源加载失败时保留当前明确错误提示，不静默 fallback。

商品卡片仍使用 `Card` 组合，点击打开 `ResponsiveDialog`。移动端表现为 Drawer，桌面端表现为 Dialog。

### 商品详情

详情弹层展示购买决策必需信息：

- 商品图片。
- 标题、商品规格、条码、卖家、库存。
- 售价和原价。
- 数量步进器。
- “立即购买”主按钮。

数量规则：

- 最小数量为 1。
- 有库存值时，最大数量为库存。
- 无库存值时，最大数量为 99，并展示“库存以发布者确认为准”。
- 库存为 0 时隐藏或禁用购买动作，并明确说明不可购买。

### 支付弹层

支付弹层只展示 PRD 要求的支付核对信息：

- 支付平台 Tabs：微信支付、支付宝。
- 二维码区域。
- 金额。
- 付款标识码。
- 操作按钮：保存到相册、打开微信/支付宝扫一扫、提交订单。

当前实现阶段不接入真实相册保存或真实 App 拉起。不可用操作以明确文案降级，不展示成功假象。

当前 API 阶段只调用 `createSpotOrders` 创建现货订单，不存在“标记我已支付”接口。因此主按钮使用“提交订单”，不使用“我已支付”。后续接入付款确认接口后，再把按钮文案和行为改为“我已支付”。

提交订单后：

- 调用 `createSpotOrders`。
- 成功 toast 提示订单已提交，并展示“等待收款确认”状态。
- 失败 toast 提示提交失败，保留支付弹层和用户选择。
- 不表达“已付款”，不跳过卖家确认收款。

## Feedback

全局反馈使用 `sonner` toast：

- 条码查询无结果。
- 上架成功。
- 上架失败。
- 订单提交成功。
- 订单提交失败。

字段级错误仍展示在对应字段下方，toast 只负责提交结果和跨字段反馈。

根布局补 `Toaster`，确保 mobile 当前链路可用，并为 desktop 后续共享反馈能力留好入口。

## Data Flow

- `ShopPage` server side 调用 `listSpotGoods`，将数据传给 `SpotMarketplace`。
- `SpotMarketplace` client side 负责本地搜索、商品详情、数量选择和 `createSpotOrders`。
- `PublishSpotPage` server side 调用 `listProductTemplates`，将数据传给 `PublishSpotForm`。
- `PublishSpotForm` client side 负责条码匹配、模板选择、表单校验和 `createSpotGoods`。
- `mock`、`local`、`remote` 不互相 fallback；未接入能力保持明确降级。

## Component Changes

Planned shared UI additions:

- `packages/ui/src/components/field.tsx`
- `packages/ui/src/components/input-group.tsx`
- `packages/ui/src/components/sonner.tsx`

Planned dependency additions:

- `react-hook-form`
- `zod`
- `@hookform/resolvers`
- `sonner`

Existing components to keep using:

- `Button`
- `Card`
- `Badge`
- `Input`
- `Tabs`
- `ResponsiveDialog`
- `Spinner`

## Accessibility

- All form controls have labels and field-level errors.
- Invalid controls use `aria-invalid`; invalid field containers use `data-invalid`.
- Buttons are disabled during submission.
- Payment platform choice remains keyboard reachable via Tabs.
- Drawer/Dialog titles remain present for accessibility.
- Toasts supplement page state and do not carry the only copy of field-level errors.

## Verification

Required checks:

- `pnpm lint`
- `pnpm --filter @workspace/ui typecheck`
- `pnpm --filter @sast-shop/mobile typecheck`

Add Vitest coverage if form parsing or reusable validation helpers are extracted.

Manual mobile smoke check:

- 上架现货：空条码、无模板、多模板候选、非法价格、非法库存、成功 toast、失败 toast。
- 现货商城：搜索有结果、搜索无结果、商品详情 Drawer、数量加减、支付平台 Tabs、提交订单 toast。
- Drawer 底部操作与底部导航、安全区不互相遮挡。

Desktop smoke check only if `Toaster` or shared component changes affect desktop layout.
