# SAST Shop 品牌图形

沿用宣发海报的奶油白、单一珊瑚橙与柔和黏土质感。Logo 由购物袋和笑脸组成；小尺寸导航使用同形单色符号，颜色继续跟随主题与选中状态。

## 素材

- `logo-master.png`：透明 Logo 原图，1254 × 1254。
- `logo-small.svg`：从现有笑脸购物袋轮廓简化的小尺寸矢量标志。
- `errand-empty-master.png`：透明团长角色原图，1254 × 1254。
- `logo-prompt.txt`、`errand-empty-prompt.txt`：内置 imagegen 的完整生成提示词。
- 两个应用的 `app/icon.svg`：可按任意分辨率显示的小尺寸矢量标志。
- 两个应用的 `app/favicon.ico`：由矢量标志生成的 16、32、48、64 像素图层。
- 两个应用的 `app/icon.png`：从原图收紧透明留白导出的 512 × 512 透明图标。
- 两个应用的 `app/apple-icon.png`：保留黏土质感的 180 × 180 不透明主屏图标。
- 移动端 `public/brand/logo.webp`：512 × 512 无损透明 Logo。
- 移动端 `public/brand/errand-empty.webp`：384 × 384 透明角色，页面展示为 128 × 128。
- 功能模块 `*-master.png`、`*-prompt.txt`：内置 imagegen 生成的透明原图与完整提示词。
- 两个应用的 `public/brand/{模块名}.webp`：384 × 384 无损透明素材，用于 96 像素空状态。
- 两个应用的 `public/brand/{模块名}-compact.webp`：收紧透明留白后的 256 × 256 无损透明素材，用于不超过 64 像素的入口。

| 模块名                | 设计元素           | 使用位置                           |
| --------------------- | ------------------ | ---------------------------------- |
| errand                | 跑腿团长角色       | 团购页跑腿大厅入口                 |
| template              | 商品卡片与条码标签 | 商品模板入口、无模板空状态         |
| transaction-agreement | 协议纸张与签字笔   | 移动端和桌面端的交易协议入口       |
| feishu-required       | 手机与提示气泡     | 双端非飞书环境的打开提示           |
| login                 | 笑脸购物袋与身份卡 | 双端登录等待和失败恢复提示         |
| manual                | 圆角键盘           | 上架方式选择中的手动输入           |
| scan                  | 扫描框与条码       | 上架方式选择中的扫码录入           |
| address               | 定位针             | 我的地址簿入口、无地址空状态       |
| collection            | 抽象收款码卡片     | 我的收款码入口                     |
| wallet                | 钱包               | 我的默认支付方式入口               |
| help                  | 问号对话框         | 我的帮助与反馈入口                 |
| orders                | 订单收据           | 无订单空状态                       |
| store                 | 店铺门面           | 无店铺空状态、没有店铺 Logo 的兜底 |
| spot-empty            | 空商品货架与价签   | 商城暂无在售现货                   |
| search-empty          | 放大镜与商品卡片   | 搜索无结果、无效链接               |
| cart-empty            | 空购物篮           | 跑腿清单暂无商品                   |
| load-error            | 云朵与断开的连接   | 内容加载失败、网络或服务暂不可用   |
| barcode-empty         | 条码标签与放大镜   | 条码没有匹配的商品模板             |
| camera                | 圆角相机           | 人脸、合照选图抽屉中的拍照入口     |
| photo-album           | 叠放照片           | 人脸、合照选图抽屉中的相册入口     |

## 使用位置

Next.js 使用文件约定生成浏览器图标与主屏图标标签。商城底部导航、桌面品牌标识使用共享的 `SastShopMark` 单色版本。两个应用的团购、订单、我的导航使用 `SastGroupMark`、`SastOrdersMark`、`SastProfileMark`，延续圆角实心轮廓，颜色跟随主题与选中状态；移动端底部导航图标显示为 24 像素，桌面侧栏导航图标显示为 20 像素。

等待中的团长角色用于跑腿大厅没有待接单需求、且没有搜索词时的空状态。功能图形通过 `BrandIllustration` 组合到对应入口、登录等待和真实空状态；组件在不超过 64 像素时选用 compact 素材，并跳过 Next.js 二次图片压缩。页面搜索无结果使用放大镜插画，局部空状态保持紧凑。空状态直接置于页面或内容区，不增加背景卡片；操作只保留创建内容、清空搜索等有效入口。插画由内置 imagegen 生成，完整提示词保存在对应 `*-prompt.txt`；加载失败、支付与订单结果继续使用状态控件和文字。

插画为装饰图，使用空 `alt`；标题和操作由原有页面负责，图片加载失败时仍可理解当前状态。商家 Logo、用户头像、商品图片和微信/支付宝平台标识使用真实数据与标志；收款码插画是不可扫描的抽象图案。完整海报不直接放进购物首屏。

加载失败和条码未匹配素材采用内置 imagegen 的生成模式，分别保存在 [load-error-master.png](load-error-master.png)、[barcode-empty-master.png](barcode-empty-master.png)，完整提示词保存在 [load-error-prompt.txt](load-error-prompt.txt)、[barcode-empty-prompt.txt](barcode-empty-prompt.txt)。移动端错误及空状态的使用范围见 [走查清单](../../docs/mobile-feedback-states.md)。

## 导出

安装项目依赖后，在仓库根目录运行：

```bash
node design/brand/export-assets.mjs
```

仅导出指定功能图形时，可传入模块名：

```bash
node design/brand/export-assets.mjs transaction-agreement
```

功能图形同时导出到两个应用的 `public/brand/`；个人中心入口均按 32 像素展示。

人脸录入与 Pocket 使用内置 imagegen 新绘制的 `face`、`pocket` 模块，延续哑光黏土、奶白与 Action Coral 风格。原图与完整提示词保存在对应 `*-master.png`、`*-prompt.txt`；加号抽屉两类功能使用同规格图形，上架现货沿用条码扫描 `scan` 模块。

人脸状态沿用同一造型，`face-empty` 表示尚未录入、`face-active` 表示已录入、`face-inactive` 表示已停用或授权到期；处理中结合 `face` 与加载指示，失败沿用 `load-error`。所有插画保留明确的状态文字，不单靠图形传达业务状态。

照片来源卡片使用内置 imagegen 新绘制的 [camera-master.png](camera-master.png) 和 [photo-album-master.png](photo-album-master.png)，分别表示拍照和相册；完整提示词保存在 [camera-prompt.txt](camera-prompt.txt) 与 [photo-album-prompt.txt](photo-album-prompt.txt)。

导出脚本使用 Next.js 已安装的 sharp，从原图和小尺寸矢量标志生成各类资源；功能模块素材采用无损 WebP，保留透明通道，无额外依赖。
