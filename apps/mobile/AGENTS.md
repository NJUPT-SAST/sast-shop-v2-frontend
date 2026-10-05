<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 移动端约定

同时遵守根目录 `AGENTS.md`；保留上方 Next.js 自动生成块。

## 布局与控件

- 一级页面为商城、团购、订单、我的；不显示二级页式顶部导航。底部四个导航之间保留中间的圆形上架入口，二级页面使用已有返回逻辑。
- 上架 Drawer 用于选择功能/录入方式，保留扩展其他上架入口的结构；手动条码录入使用独立弹层，不把输入表单直接替换到入口选择层。
- 小屏底部弹层使用 Drawer；适配较宽视口时可使用现有 `ResponsiveDialog`。保留拖拽横条、顶部圆角、安全区和底部留白，层级高于底部导航，不改成 Sheet。
- 抽屉根容器限制高度并裁切溢出，滚动只发生在内部列表/表单，操作区保持可见。个人中心的地址簿、收款码和交易协议查看层不额外添加底部关闭按钮；其他弹层按功能保留合适的关闭方式。
- 复用 `MobileShell`、`useMobileKeyboard` 和 `MobileFixedFooter` 的键盘及占位逻辑；输入法打开时隐藏导航并移除占位，避免将底栏顶到键盘上方或重复添加底部 padding。
- 使用既有 `app-scrollbar`，不引入自绘或滚动时显隐的额外滚动条。页面滚动限制在内容区，不能延伸到底部导航之后。
- 触屏操作不依赖 hover；保留按压和 `focus-visible` 反馈。图标按钮使用明确的无障碍名称及通常 44×44 的触控范围，图形大小可比触控范围小。
- 标题与右侧功能入口垂直对齐，统一相关入口的图标和文字风格；状态 badge 与列表/详情保持一致。

## 业务交互

- “我的”用户信息只显示 Avatar 和用户名；“收款码”按微信/支付宝展示上传状态，整张卡片负责上传或更改，不在管理入口展示实际二维码。
- 地址用中国大陆省市区级联 Select，编辑保留输入与字段错误；可点击地址卡片支持聚焦及 Enter/Space。
- 分发商品卡通过整块主信息区域展开，保留连贯动画；采购中的商品卡沿用点击主信息编辑采购数量的流程。点击单价可独立打开改价弹窗，字号与邻近信息一致，使用稳定的可点击样式，不增加一行重复的改单价说明。
- 扩展操作与卡片展开互不触发，不嵌套 button。只在接口提供原价/变更依据时使用“改价后”等比较文案，不能拿模板参考价推断实际价变化。
- 商品条码右侧扫码入口复用共享飞书环境判断和 `InputGroup`；SDK 未就绪、扫码取消或失败时保留手输和重试，扫描中禁止重复扫描或保存竞争。
- 当前底部导航再次点击：有滚动位置时回到顶部，已在顶部时执行已有刷新流程并防抖，不直接重建路由。

## 验收

- 以 390×844 为常用视口，涉及支付、固定底栏和表单时增加矮屏与键盘检查；必要时核对真实 computed style。
- 视觉核查结束后按用户习惯保留移动端视口；临时 UA/SDK 模拟需恢复或明确说明。相机和飞书原生底栏必须注明是否经过真机验证。
- 优先复用已有组件行为测试；间距、字号或图标微调使用视觉验收，不新增逐个 class/源码字符串的镜像断言。
