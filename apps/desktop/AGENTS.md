<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 桌面端约定

同时遵守根目录 `AGENTS.md`；保留上方 Next.js 自动生成块。

## 布局与控件

- 与移动端共享业务能力、领域规则、品牌素材和状态含义；保留桌面导航、多列信息、并排表单与键盘操作，不直接放大移动端页面。
- 表单、确认和交易协议使用 Dialog；内容区域可滚动、底部操作可见，并保留聚焦、Tab、Enter、Escape 与关闭后焦点恢复。
- 页面宽度和间距服务于浏览及操作，避免窄列内容两侧大量空白。搜索、视角切换、类型与状态筛选按各自含义组织，不让不同筛选轴相互重置或混用状态。
- 主导航沿用品牌矢量图标，通用操作使用 Remixicon，模块/空状态使用对应的 `BrandIllustration`；品牌资源同步通过 `design/brand` 导出，不逐个复制后自行缩放。
- 可使用 hover 提示辅助操作，但操作本身必须可见且可通过键盘完成；不能只在 hover 时提供必需入口。

## 业务交互与验证

- 采购记录、数量分配、包装费、实际单价和价格编辑沿用当前接口与独立桌面交互。分发阶段不使用参考价填补缺失实际价，也不展示无依据的“改价后”。
- 卡片/行的展开与价格编辑、确认、联系方式等子操作保持独立，避免嵌套 button；使用 `aria-expanded` 及现有折叠动画。
- 交易写操作必须经过协议，拒绝或确认失败不能写入。校验分配数量边界、版本冲突、结果不明与失败恢复，不用重试按钮自动重复交易。
- 飞书环境检查受 `AUTH_MODE` 控制；联系入口使用共享识别和 SDK 加载订阅。缺少客户端组件时给明确提示，不能静默无响应或自行恢复普通浏览器 OAuth 跳转。
- 通常检查约 900、1280、1440 像素宽度，确保窄窗口没有按钮挤压、横向溢出或 Dialog 操作区被遮挡。
- 共享代码改动同时检查移动端；桌面专属调整重点回归键盘操作、独立筛选、协议拒绝不写及失败后的恢复流程。
