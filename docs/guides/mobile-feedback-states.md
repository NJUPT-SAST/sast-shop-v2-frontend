# 移动端空状态与错误展示规范

本文档记录 `apps/mobile` 中空状态（`Empty`）、加载失败（`LoadFailure`）、路由错误边界、分页尾部状态（`InfiniteListStatus`）及局部失败提示的统一约定与当前覆盖范围。

## 核心组件与通用规则

- **组件分层**：
  - 共享基础组件：`packages/ui/src/components/empty.tsx`（`Empty`）、`packages/ui/src/components/load-failure.tsx`（`LoadFailure`）、`packages/ui/src/components/infinite-list-status.tsx`（`InfiniteListStatus`）、`packages/ui/src/components/managed-image.tsx`（`ManagedImage`）。
  - 移动端包装：`apps/mobile/components/load-failure.tsx` 默认注入 `BrandIllustration name="load-error"`；`apps/mobile/components/infinite-list-status.tsx` 默认注入 48px `load-error` 插画。
- **视觉与布局**：内容缺失使用对应业务空状态插画，读取失败使用 `load-error` 插画；两者均直接置于内容区（`surface="plain"`），不额外包裹背景卡片。
- **层级区分**：
  - 首次加载失败：在剩余页面或 Drawer 内容区居中展示（`variant="page"` 或 `"section"`）。
  - 已有缓存刷新失败或分页加载失败：使用紧凑提示（`variant="compact"`），继续保留已加载内容。
- **可访问性**：`LoadFailure` 保留 `role="alert"` 及 `aria-labelledby` / `aria-describedby` 关联；装饰性插画和回退图标设置 `aria-hidden="true"`，不重复朗读。

## 加载失败与重试覆盖范围

| 场景 | 页面或组件（`apps/mobile/`） | 展示与恢复方式 |
| --- | --- | --- |
| 条码查询失败 | `components/publish-spot-form.tsx` | `LoadFailure` 保留条码输入，提供“重试匹配” |
| 条码无匹配商品模板 | `components/publish-spot-form.tsx` | `Empty` + `barcode-empty` 插画，保留携带当前条码的“创建商品模板”入口 |
| 现货商城加载、搜索失败 | `components/cached-spot-marketplace.tsx`、`components/spot-marketplace.tsx` | 首次/搜索失败展示居中 `LoadFailure` 与重试；缓存刷新失败紧凑提示 |
| 现货商品详情失败 | `components/spot-marketplace.tsx`（详情 Drawer） | Drawer 内 `LoadFailure` 与原商品详情重试 |
| 卖家在售现货管理失败 | `components/seller-goods-manager.tsx` | 首次/刷新/编辑详情失败分别使用 `LoadFailure` 覆盖受影响区域 |
| 订单加载、筛选失败 | `components/cached-orders-view.tsx`、`components/orders-view.tsx` | 当前订单区 `LoadFailure`，保留其他类型订单与已有缓存 |
| 跑腿大厅加载、搜索失败 | `components/cached-errand-lobby.tsx`、`components/errand-demand-hall.tsx` | 内容区 `LoadFailure`；缓存刷新失败紧凑提示 |
| 商品模板加载、搜索失败 | `components/cached-product-templates.tsx`、`components/product-template-manager.tsx` | 内容区 `LoadFailure` 与重试，店铺切换与搜索入口保持可用 |
| 团购页任务、店铺失败 | `components/group-overview-client.tsx` | 失败仅覆盖对应模块；缓存刷新失败保持紧凑提示 |
| 店铺编辑加载失败 | `components/store-edit-dialog.tsx` | 弹层内 `LoadFailure` 与重试 |
| 个人资料加载失败 | `components/profile-page-client.tsx` | 资料区紧凑 `LoadFailure`，不影响下方管理入口 |
| 地址簿、收款码读取失败 | `components/profile-dialogs-provider.tsx` | Drawer 内容区 `LoadFailure` 与读取重试 |
| 支付账单读取失败 | `components/payment-dialog.tsx` | 内容区 `LoadFailure`；仅在调用方提供重试回调时展示重试按钮 |
| 西口袋 AA 收款读取失败 | `components/pocket/shared.tsx`、`components/pocket/pocket-face.tsx` | 模块内使用紧凑 `LoadFailure`（支持可选重试）及人脸页 `load-error` 插画 |
| 路由级服务端加载失败 | `app/error.tsx` 及 5 个详情 `error.tsx`（店铺、跑腿需求、采购任务、现货订单、跑腿订单） | `LoadFailure`（`variant="page"`）调用 Next.js `retry()` 重新获取服务端内容；详情页保留业务返回入口，便于直达链接失败后离开 |
| 列表分页加载失败 | `spot-marketplace`、`orders-view`、`errand-demand-hall`、`product-template-manager`、`errand-shop`、`seller-goods-manager`、`pocket/pocket-list` 的 `InfiniteListStatus` | 列表尾紧凑失败提示与继续加载，保留已加载条目（注：`pocket/pocket-list` 直接使用共享 `InfiniteListStatus`，未传入移动端 `load-error` 插画） |

## 空状态与插画约定

- **业务插画映射**（`components/brand-illustration.tsx`）：现货无库存用 `spot-empty`，搜索无结果与无效详情页用 `search-empty`，订单/账单用 `orders`，无店铺用 `store`，无商品模板用 `template`，无地址用 `address`，无收款码用 `collection`，跑腿清单用 `cart-empty`，跑腿需求为空用 `errand-empty`，条码无模板用 `barcode-empty`，西口袋列表用 `pocket`，人脸配置状态用 `face` / `face-empty` / `face-active` / `face-inactive`。
- **未知地址与缺失详情**：根级 `app/not-found.tsx` 与 5 个详情 `not-found.tsx` 均使用 `Empty` + `search-empty` 插画，并保留业务返回入口以兼容直达链接。
- **操作按钮克制原则**：无库存、无订单等自然空状态不增加无效返回按钮；仅在直达详情缺失、模板缺失、清空搜索或唯一创建入口（如创建模板、创建店铺）保留对应动作。团购页已有创建店铺按钮时，空状态不重复添加。
- **状态符号**：提交成功、任务完成与取消继续使用结果状态符号，不混用空状态插画。

## 保持局部展示的失败提示

以下场景仍有可用表单或交易上下文，**不得**替换为整页插画，也**不得**为结果不明的写入添加盲目重发按钮：

- **表单与操作级错误**：条码字段校验、扫码取消或鉴权失败、创建/编辑店铺、模板保存或删除、图片上传、地址保存及现货上架写入失败，保留在对应字段或操作旁。
- **交易结果待核实状态**：支付结果待确认、流水号状态待确认、采购或分发结果待核实、账单生成异常、缺少支付信息及不可接单状态，继续使用业务提示和现有 pending/recovery 恢复保护。
- **专用回退**：图片加载失败继续使用 `ManagedImage` 占位；登录与飞书环境拦截继续使用 `auth-bootstrap.tsx` 中的专用插画（`login`、`feishu-required`）及认证恢复入口。

## 验证基线

- **行为回归**：覆盖条码查询失败保留输入与重试、无匹配时携带条码跳转模板创建，以及详情 `error.tsx` 调用 `retry()`（而非仅清除错误）。
- **视觉验收**：在本地 RPC mock 与真实断连条件下，按 `390×844` 与 `390×520` 检查插画尺寸、重试交互与内容溢出；浏览器模拟验收不替代飞书真机扫码与 JSAPI 验证。
