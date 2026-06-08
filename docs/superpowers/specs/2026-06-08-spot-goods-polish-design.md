# 现货全链路打磨设计

## Context

SAST Shop 一期 PRD 要求 MVP 优先保证团购和支付上线，同时现货商品需要支持浏览、直接购买、发布现货和基于信任的支付核对。当前仓库已经有 `apps/mobile` 现货商城、上架现货页面、`@sast-shop/api` facade，以及 mock/local 数据源边界。本设计聚焦现货链路的小步打磨，不进入跑腿 task、订单详情、物流或 OCR 范围。

## Goals

- 让现货发布、现货浏览、商品详情和公共支付弹层形成可验收的轻量闭环。
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

### 公共支付弹层

支付弹层抽出为现货链路可复用的公共组件，移动端表现为 Drawer，桌面端表现为 Dialog。组件由业务调用方传入金额、按平台拆分的收款码、付款标识码和默认支付方式。

公共组件 API 设计：

- `amountCents`：应付金额，必传。
- `verifyCode`：付款标识码，必传。
- `qrCodes`：按平台提供收款码图片 URL，结构为 `{ wechat?: string; alipay?: string }`。
- `defaultPlatform`：默认支付方式，支持微信支付和支付宝。
- `onPay`：用户点击“支付”后的回调。
- `onCancelPayment`：用户点击“取消支付”后的回调。
- `disabled` / `submitting`：提交中状态。

支付弹层只展示 PRD 要求的支付核对信息：

- 支付平台 Tabs：微信支付、支付宝，初始值来自 `defaultPlatform`。
- 收款码区域，随当前支付平台切换。
- 金额。
- 付款标识码。
- 操作按钮：支付、取消支付、保存收款码、打开微信/支付宝扫一扫。

如果当前平台没有收款码，收款码区域展示明确缺失状态，并禁用“保存收款码”“打开微信/支付宝扫一扫”和“支付”。不使用商品图或占位图伪装成收款码。

跳转到微信/支付宝扫一扫必须执行真实跳转。实现计划阶段需要基于可用的移动端 URL scheme 或 JSAPI 能力确认最终跳转方式；如果当前环境阻止跳转，需要 toast 告知用户，并保留收款码展示与保存入口。

保存收款码使用浏览器可用能力实现：优先下载或保存二维码图片；如果移动端 WebView 限制保存，使用 toast 明确提示用户长按保存或截图，不虚构保存成功。

取消支付关闭当前支付弹层，并保持订单/商品状态不表达已付款。

当前 API 阶段只调用 `createSpotOrders` 创建现货订单，缺少独立的“标记我已支付”接口。因此“支付”按钮在本轮实现中触发 `createSpotOrders` 并进入“等待收款确认”状态。后续接入付款确认接口后，公共支付组件的 `onPay` 可切换为真实确认付款 API。

提交订单后：

- 调用 `createSpotOrders`。
- 成功 toast 提示订单已提交，并展示“等待收款确认”状态。
- 失败 toast 提示提交失败，保留支付弹层和用户选择。
- 不表达“已付款”，不跳过卖家确认收款。

### 支付设置

新增轻量本地设置，用于修改默认支付方式：

- 设置入口加入移动端个人中心现有 profile 管理列表，菜单文案为“默认支付方式”。
- 选项为微信支付、支付宝。
- 偏好存储在浏览器本地，键名使用项目命名空间，例如 `sast-shop.default-payment-platform`。
- 未设置时默认微信支付。
- 公共支付弹层读取该本地偏好作为 `defaultPlatform`；调用方仍可显式传入默认值覆盖。
- 设置只影响当前设备和当前浏览器，不同步到后端，不影响收款码管理。

## Feedback

全局反馈使用 `sonner` toast：

- 条码查询无结果。
- 上架成功。
- 上架失败。
- 订单提交成功。
- 订单提交失败。
- 跳转到支付 App 失败。
- 保存收款码失败或需要用户手动保存。
- 默认支付方式已更新。

字段级错误仍展示在对应字段下方，toast 只负责提交结果和跨字段反馈。

根布局补 `Toaster`，确保 mobile 当前链路可用，并为 desktop 后续共享反馈能力留好入口。

## Data Flow

- `ShopPage` server side 调用 `listSpotGoods`，将数据传给 `SpotMarketplace`。
- `SpotMarketplace` client side 负责本地搜索、商品详情、数量选择、按售卖人读取收款码和 `createSpotOrders`。
- `PublishSpotPage` server side 调用 `listProductTemplates`，将数据传给 `PublishSpotForm`。
- `PublishSpotForm` client side 负责条码匹配、模板选择、表单校验和 `createSpotGoods`。
- 公共支付弹层不直接调用 API，只通过 props 回调通知调用方。
- 默认支付方式通过本地存储读取和写入，不经过 `@sast-shop/api`。
- `@sast-shop/api` 的现货商品 facade 需要暴露 `sellerId`；支付 QR facade 需要支持按 `ownerId` 读取售卖人的收款码。
- `mock`、`local`、`remote` 不互相 fallback；未接入能力保持明确降级。

## Component Changes

Planned shared UI additions:

- `packages/ui/src/components/field.tsx`
- `packages/ui/src/components/input-group.tsx`
- `packages/ui/src/components/sonner.tsx`
- `apps/mobile/components/payment-dialog.tsx`
- `packages/api/src/services/spot-goods.ts`
- `packages/api/src/services/payment-qr-codes.ts`

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
- “打开微信/支付宝扫一扫”使用真实链接跳转，并在失败时给出可理解反馈。
- 默认支付方式设置为本地偏好，界面需要明确说明只在当前设备生效。

## Verification

Required checks:

- `pnpm lint`
- `pnpm --filter @workspace/ui typecheck`
- `pnpm --filter @sast-shop/mobile typecheck`

Add Vitest coverage if form parsing or reusable validation helpers are extracted.

Manual mobile smoke check:

- 上架现货：空条码、无模板、多模板候选、非法价格、非法库存、成功 toast、失败 toast。
- 现货商城：搜索有结果、搜索无结果、商品详情 Drawer、数量加减、支付平台 Tabs、支付 toast、取消支付。
- 公共支付弹层：传入金额、默认支付方式、按平台传入收款码、保存收款码、打开微信/支付宝扫一扫、跳转失败 toast、缺失收款码禁用状态。
- 支付设置：修改默认支付方式后，重新打开支付弹层时默认平台更新；刷新页面后本地设置仍保留。
- Drawer 底部操作与底部导航、安全区不互相遮挡。

Desktop smoke check only if `Toaster` or shared component changes affect desktop layout.
