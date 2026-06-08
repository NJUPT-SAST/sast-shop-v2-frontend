# SAST Shop User Profile, Address, and QR Code Design

## Summary

下一阶段优先建设用户资料、地址簿和收款码闭环。目标是把后续现货下单和离线支付确认会依赖的基础资料先纳入 `@sast-shop/api` facade，并继续保持 `mock`、`local`、`remote` 数据源边界清晰。

成功标准：mobile/desktop 都能通过页面级 facade 读取当前用户、地址簿和微信/支付宝收款码；`mock` 使用 package fixtures；`local` 使用 ConnectRPC/fauxrpc；`remote` 在真实后端未接入前继续明确不可用。

## Goals

- 扩展用户资料域的 API facade，但页面仍只 import `@sast-shop/api`。
- 增加地址簿和收款码的 mock fixtures 与 local fauxrpc stubs。
- 在 mobile 和 desktop 各自实现独立的 `/profile` 信息架构设计范围。
- 保持 DTO 为普通前端对象，不让 proto message 跨 Server Component / Client Component 边界。
- 为后续现货下单、订单支付和收款确认提供稳定数据基础。

## Non-Goals

- 不接入真实 remote 后端。
- 不实现商品、订单或账单业务闭环。
- 不引入 Connect-Query、TanStack Query 或新的数据请求框架。
- 不复用 mobile/desktop 页面代码。
- 不引入 Google Fonts 或远程字体。

## Recommended Approach

采用 Profile Foundation 闭环：当前用户资料继续复用已接入的 Auth/User facade，新增 Address 与 Payment QR Code facade。这个范围最贴近现有 ConnectRPC 基建，schema 自洽，且能在不提前引入商品和订单复杂度的情况下，建立后续业务流程会复用的数据层模式。

## Architecture

`packages/api` 继续作为唯一页面数据入口。新增的 profile facade 拆成一个面向页面的组合服务和两个资源服务：

```text
packages/api/src/services/
  auth.ts
  profile.ts
  addresses.ts
  payment-qr-codes.ts
```

`profile.ts` 面向页面组合 `getCurrentUser`、`listAddresses` 和 `listPaymentQrCodes`，输出 `ProfileOverview`。`addresses.ts` 和 `payment-qr-codes.ts` 负责资源级 CRUD facade、mock/local/remote 分支和 DTO mapping。

ConnectRPC 继续遵循 Connect-ES v2 官方方向：service definitions 从 `packages/api/src/gen/**/*_pb.ts` 导入，client 使用 `createClient()` 和 `createConnectTransport({ baseUrl })`。生成物不手写、不手改。

## API Facade

建议导出以下普通 TypeScript DTO 和函数：

```text
ProfileOverview
ShippingAddress
PaymentQrCode
PaymentQrChannel = "wechat" | "alipay"

getProfileOverview(options)
listAddresses(options)
getAddress(id, options)
createAddress(input, options)
updateAddress(id, input, options)
deleteAddress(id, options)
listPaymentQrCodes(options)
updatePaymentQrCode(input, options)
```

DTO 中的 id 使用 string，金额和渠道使用前端领域类型，时间如果出现则使用 ISO string。facade 内部负责 `bigint`、Protobuf enum、optional fields 的显式转换。地址输入保持接近 proto：收件人、手机号、省市区、详细地址、是否默认。收款码输入包含渠道和内容。

## Data Flow

### mock

`packages/mocks` 新增地址和收款码 fixtures。mock service 返回可预测数据，并为 create/update/delete 返回模拟后的结果。mock 数据不进入页面组件，也不混入 local 或 remote 分支。

### local

`local` 数据源调用：

- `AddressService.GetAddress`
- `AddressService.CreateAddress`
- `AddressService.UpdateAddress`
- `AddressService.DeleteAddress`
- `QrCodeService.GetQrCode`
- `QrCodeService.UpdateQrCode`

本轮为这些 RPC 增加 `mock/fauxrpc/stubs` 提交版 stub。单元测试仍用 mocked fetch，不依赖 fauxrpc 常驻。手动验收时运行 `pnpm mock:fauxrpc`，并设置 `NEXT_PUBLIC_DATA_SOURCE=local` 与 `NEXT_PUBLIC_CONNECT_BASE_URL=http://127.0.0.1:6660`。

### remote

`remote` 继续抛 `FeatureUnavailableError`。页面展示明确中文降级状态，例如“真实后端暂未接入，无法管理地址簿”。不得静默 fallback 到 mock。

## Mobile Scope

mobile 新增或补齐 `/profile`，作为飞书内移动端个人中心：

- 当前用户资料区：头像、姓名、数据源状态。
- 默认地址摘要：无地址时展示空状态，有地址时展示收件人和地址。
- 地址簿入口：单列列表，新增和编辑使用移动端二级页面，删除使用确认弹层。
- 收款码入口：展示微信/支付宝配置状态，编辑使用移动端二级页面。

移动端布局使用单列、底部安全区操作、自然中文文案。必要交互不能依赖 hover。

## Desktop Scope

desktop 新增或补齐 `/profile`，作为 PC 工作台里的资料管理页：

- 左侧或顶部展示当前用户资料和数据源状态。
- 地址簿使用表格或密集列表，便于扫描默认地址、联系人和手机号。
- 收款码使用分栏或列表，展示渠道、配置状态和编辑操作。
- 页面结构与 mobile 独立实现，但复用 `@sast-shop/api` DTO、domain helpers 和基础 UI。

## Error Handling

- 缺少 `NEXT_PUBLIC_CONNECT_BASE_URL` 时，local 分支抛 `ApiConfigurationError`。
- Connect request 失败时包装为 `ApiRequestError`。
- local 响应缺少关键 message 字段时抛 `FeatureUnavailableError`。
- 输入不完整或格式不合法时使用 `ValidationError` 作为设计目标；若实现阶段需要先补错误类型，应保持与 `packages/api/errors.ts` 的现有模式一致。
- UI 对 `FeatureUnavailableError`、`ApiConfigurationError` 和 `ApiRequestError` 展示明确中文状态，并保留重试或返回入口。

## Testing Plan

`packages/api`：

- 覆盖 address 和 QR code facade 的 `mock`、`local`、`remote` 分支。
- 覆盖 local Connect request 的 path/body。
- 覆盖 mapper：bigint id、payment channel enum、optional owner/address fields。
- 覆盖缺配置、空 response、Connect failure 的错误转换。

`packages/mocks`：

- 覆盖地址和收款码 fixtures 的稳定性。
- 覆盖默认地址和微信/支付宝渠道数据。

`apps/mobile` 和 `apps/desktop`：

- 覆盖 `/profile` route typecheck。
- 页面实现后至少运行 `pnpm lint`、`pnpm typecheck`、`pnpm test`。
- 涉及页面和路由时运行 `pnpm build`；若 Turbopack 在沙箱内遇到端口权限问题，使用审批模式运行。

## Acceptance

- `NEXT_PUBLIC_DATA_SOURCE=mock` 时，mobile/desktop `/profile` 能展示当前用户、地址簿和微信/支付宝收款码。
- `NEXT_PUBLIC_DATA_SOURCE=local` 且 fauxrpc 启动时，`/profile` 能从 fauxrpc stubs 读取地址和收款码。
- `NEXT_PUBLIC_DATA_SOURCE=remote` 时，页面展示真实后端未接入的明确降级状态。
- 页面代码不直接 import `packages/api/src/gen`。
- proto 生成物无手工修改，`pnpm proto:generate` 后无 drift。
- 设计实现后通过 `pnpm lint`、`pnpm typecheck`、`pnpm test`，并按页面变更范围验证 `pnpm build`。

## Open Implementation Notes

- `ValidationError` 尚未在当前 `packages/api/errors.ts` 中实现；implementation plan 需要决定是否本轮补齐。
- `getCurrentUser` 当前 local smoke path 固定读取 fauxrpc stub 中的 `10001` 用户；本轮不改变真实 session-aware 当前用户逻辑。
- Address 和 QR Code mutation 在 fauxrpc 下只能验证 request/response shape，不代表真实持久化语义。
