<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 桌面端约定

同时遵守根目录 `AGENTS.md`；保留上方 Next.js 自动生成块。

## 布局与控件

- 与移动端共享业务能力、领域规则与状态含义；保留桌面侧栏导航、多列信息、并排表单和键盘操作，不直接放大移动端页面。
- 表单、确认与交易协议使用 Dialog；内容区可滚动、底部操作保持可见，并支持聚焦、Tab、Enter、Escape 及关闭后焦点恢复。
- 页面宽度与间距服务于浏览和操作，避免窄列两侧大留白；搜索、视角切换、类型与状态筛选各司其职，不同筛选轴互不重置或混用状态。
- 品牌素材通过 `design/brand/export-assets.mjs` 同步，不手工复制缩放；可用 hover 提示辅助操作，但所有必需入口必须常显且可键盘完成。

## 业务交互与验证

- 采购记录、数量分配、包装费、实际单价和改价沿用当前接口与桌面交互；分发阶段不用参考价填补缺失实际价，也不展示无依据的“改价后”。
- 卡片/行展开与改价、确认、联系等子操作独立，不嵌套 `button`，维护 `aria-expanded` 与折叠动画。
- 校验分配数量边界、版本冲突、结果不明与失败恢复，不用重试按钮自动重复交易。
- 飞书联系入口使用共享环境识别与 SDK 订阅；缺少客户端组件时明确提示，不静默无响应，也不自行回退到普通浏览器 OAuth 跳转。
- 常规验收检查约 900、1280、1440px 宽度，避免窄窗口按钮挤压、横向溢出或 Dialog 操作区被遮挡。
- 共享代码改动同时检查移动端；桌面专属调整重点回归键盘操作、独立筛选、协议拒绝不写与失败恢复流程。
