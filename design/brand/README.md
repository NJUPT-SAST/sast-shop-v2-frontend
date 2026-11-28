# SAST Shop 品牌图形

沿用宣发海报的奶油白、单一珊瑚橙与柔和黏土质感。Logo 由购物袋和笑脸组成；小尺寸导航使用同形单色符号，颜色跟随主题与选中状态。

## 素材

- `logo-master.png`：透明 Logo 原图，1254 × 1254。
- `logo-small.svg`：从笑脸购物袋轮廓简化的小尺寸矢量标志。
- `errand-empty-master.png`：透明团长角色原图，1254 × 1254。
- `*-master.png`、`*-prompt.txt`：各功能模块透明原图与完整生成提示词（`store-window-edit-prompt.txt` 为店铺橱窗局部调整提示词）。
- 双端 `app/icon.svg`：任意分辨率清晰的小尺寸矢量标志。
- 双端 `app/favicon.ico`：由 `logo-small.svg` 生成的 16、32、48、64 像素图层。
- 双端 `app/icon.png`：收紧透明留白后的 512 × 512 透明图标。
- 双端 `app/apple-icon.png`：保留黏土质感的 180 × 180 不透明主屏图标（底色 `#f6f3ef`）。
- 移动端 `public/brand/logo.webp`：512 × 512 无损透明 Logo。
- 移动端 `public/brand/errand-empty.webp`：384 × 384 透明角色（`quality: 82`、`alphaQuality: 100`），页面展示为 128 × 128。
- 双端 `public/brand/{模块名}.webp`：384 × 384 无损透明素材，用于大尺寸空状态（如 96 像素）。
- 双端 `public/brand/{模块名}-compact.webp`：收紧透明留白后的 256 × 256 无损透明素材，用于不超过 64 像素的入口。

| 模块名                | 设计元素             | 使用位置                                     |
| --------------------- | -------------------- | -------------------------------------------- |
| errand                | 跑腿团长角色         | 团购页跑腿大厅入口                           |
| template              | 商品卡片与条码标签   | 商品模板入口、无模板空状态                   |
| transaction-agreement | 协议纸张与签字笔     | 双端交易协议入口                             |
| feishu-required       | 手机与提示气泡       | 双端非飞书环境的打开提示                     |
| login                 | 笑脸购物袋与身份卡   | 双端登录等待与失败恢复提示                   |
| manual                | 圆角键盘             | 手动录入入口与配图                           |
| scan                  | 扫描框与条码         | 移动端发布抽屉“上架现货”扫码入口             |
| address               | 定位针               | 我的地址簿入口、无地址空状态                 |
| collection            | 抽象收款码卡片       | 我的收款码入口                               |
| wallet                | 钱包                 | 我的默认支付方式入口                         |
| help                  | 问号对话框           | 我的帮助与反馈入口                           |
| orders                | 订单收据             | 无订单空状态                                 |
| store                 | 店铺门面             | 无店铺空状态、无店铺 Logo 兜底               |
| spot-empty            | 空商品货架与价签     | 商城暂无在售现货                             |
| sold-out              | 黏土售罄吊牌         | 售罄商品主图半透明覆盖层（`managed-image`）  |
| search-empty          | 放大镜与商品卡片     | 搜索无结果、无效链接                         |
| cart-empty            | 空购物篮             | 跑腿清单暂无商品                             |
| load-error            | 云朵与断开的连接     | 内容加载失败、网络或服务暂不可用             |
| barcode-empty         | 条码标签与放大镜     | 条码没有匹配的商品模板                       |
| face                  | 柔和人脸识别图标     | 我的“人脸录入”入口、处理中配合加载指示       |
| face-empty            | 未录入人脸状态       | 人脸尚未录入空状态                           |
| face-active           | 已启用人脸状态       | 人脸已录入并启用状态                         |
| face-inactive         | 已停用人脸状态       | 人脸已停用或授权到期状态                     |
| pocket                | 黏土 Pocket 图标     | 移动端发布抽屉“发起 Pocket”入口              |
| camera                | 圆角相机             | 人脸、合照选图抽屉中的拍照入口               |
| photo-album           | 叠放照片             | 人脸、合照选图抽屉中的相册入口               |

## 使用位置

- 浏览器与主屏图标通过 Next.js `app/` 文件约定自动注入。商城导航与桌面品牌标识使用共享 `SastShopMark` 单色版本；团购、订单、我的使用 `SastGroupMark`、`SastOrdersMark`、`SastProfileMark`（移动端底部导航 24px，桌面侧栏导航 20px）。
- 功能图形通过 `BrandIllustration` 组合到入口、登录等待、空状态与内容加载失败页；尺寸不超过 64px 时自动选用 `-compact.webp` 并跳过 Next.js 二次压缩（`sold-out-compact.webp` 由 `managed-image.tsx` 直接引用）。个人中心入口均按 32px 展示。
- 等待中的团长角色（`errand-empty.webp`）用于跑腿大厅无待接单需求且无搜索词时的空状态；空状态与加载失败插画直接置于页面或内容区，不套背景卡片，仅保留创建内容、清空搜索、重试等有效操作。支付与订单成功/取消等结果继续使用状态控件和文字。
- 人脸状态使用 `face-empty`、`face-active`、`face-inactive`，处理中配合 `face` 与加载指示，失败沿用 `load-error`；所有插画均为空 `alt` 的装饰图，必须配合明确状态文字，不单靠图形传达业务状态。
- 商家 Logo、用户头像、商品图片和微信/支付宝平台标识使用真实数据与标志；收款码插画为不可扫描的抽象图案；完整宣发海报不直接放入购物首屏。移动端错误及空状态走查范围见 [走查清单](../../docs/guides/mobile-feedback-states.md)。

## 导出

安装项目依赖后，在仓库根目录运行：

```bash
node design/brand/export-assets.mjs
```

仅导出指定功能模块时传入模块名（需位于 `export-assets.mjs` 的 `moduleNames` 列表中）：

```bash
node design/brand/export-assets.mjs transaction-agreement
```

脚本复用 Next.js 已安装的 `sharp`（无额外依赖）：全量运行时同时生成双端 `app/` 图标、移动端 `logo.webp`/`errand-empty.webp` 及全部 26 个模块的双端 `public/brand/` 无损透明 WebP；指定模块名时仅导出该模块到双端 `public/brand/`。
