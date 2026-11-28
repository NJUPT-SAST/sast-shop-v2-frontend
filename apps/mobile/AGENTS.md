<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 移动端约定

同时遵守根目录 `AGENTS.md`；保留上方 Next.js 自动生成块。

## 布局与控件

- 一级页面为商城、团购、订单、我的，不显示二级页式顶部导航；底部四个导航之间保留中间圆形发布入口（`MobilePublishEntry`），二级页面使用已有返回逻辑。
- 底部中间“发布”Drawer 用于选择发布功能（飞书 UI 环境下展示“上架现货”扫码入口，以及“发起 Pocket”），保留扩展入口的结构，不把表单直接替换进入口选择层。
- 小屏底部弹层使用 Drawer，适配较宽视口时用现有 `ResponsiveDialog`；保留拖拽横条、顶部圆角、安全区和底部留白，层级高于底部导航，不改成 Sheet。
- 抽屉根容器限制高度并裁切溢出，滚动只发生在内部列表/表单，操作区保持可见。个人中心的地址簿、收款码和交易协议查看层不额外加底部关闭按钮；其他弹层按功能保留合适关闭方式。
- 复用 `MobileShell`、`useMobileKeyboard` 和 `MobileFixedFooter` 的键盘及占位逻辑；输入法打开时隐藏导航并移除占位，避免底栏被顶到键盘上方或重复底部 padding。
- 使用既有 `app-scrollbar`，不引入自绘或滚动显隐滚动条；页面滚动限制在内容区，不延伸到底部导航之后。
- 触屏不依赖 hover，保留按压和 `focus-visible` 反馈；图标按钮提供明确无障碍名称及约 44×44 触控区（图形可小于触控区）。
- 标题与右侧功能入口垂直对齐，统一图标与文字风格；状态 badge 在列表与详情保持一致。

## 业务交互

- “我的”用户信息仅显示 Avatar 与用户名；“收款码”按微信/支付宝展示上传状态，整张卡片负责上传或更改，不在管理入口直接展示二维码。
- 地址使用中国大陆省市区级联 Select，编辑保留输入与字段错误；可点击地址卡片支持聚焦及 Enter/Space。
- 分发商品卡通过主信息区展开并保留折叠动画；采购中商品卡沿用点击主信息编辑采购数量。点击单价可独立打开改价弹窗，字号与邻近信息一致，使用稳定可点击样式，不增加重复改价说明行。
- 子操作与卡片展开互不触发且不嵌套 `button`。仅在接口提供原价/变更依据时展示“改价后”等比较文案，不拿模板参考价推断实际价变化。
- 商品条码右侧扫码入口复用共享飞书环境判断与 `InputGroup`；SDK 未就绪、扫码取消或失败时保留手输与重试，扫描中禁止重复扫描或保存竞争。
- 再次点击当前底部导航：已滚动时回到顶部，已在顶部时执行已有刷新流程并防抖，不直接重建路由。

## 验收

- 常用视口为 390×844，涉及支付、固定底栏和表单时加测矮屏与键盘弹出；必要时核对真实 computed style。
- 视觉核查结束后保留移动端视口；临时 UA/SDK 模拟须恢复或说明。相机与飞书原生底栏必须注明是否经过真机验证。
- 优先复用已有组件行为测试；间距、字号或图标微调用视觉验收，不新增逐 class/源码字符串的镜像断言。
