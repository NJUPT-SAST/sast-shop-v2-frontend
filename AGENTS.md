# 项目概述

这是一个面向飞书网页应用的在线商城前端 monorepo。当前已经拆分为 `apps/mobile` 移动端商城、`apps/desktop` 桌面端界面，以及 `packages/api`、`packages/domain`、`packages/mocks`、`packages/ui` 共享包。已经落地的技术栈包括 Next.js 16 App Router、React 19、TypeScript strict、Tailwind CSS v4、ESLint 9、Vitest 和 pnpm workspace。

已落地 shadcn-style workspace UI 包、`@remixicon/react` 图标、ConnectRPC Web v2、Buf/Protobuf-ES v2 代码生成、fauxrpc mock tooling、Docker/GitHub Actions 部署工作流和 `DESIGN.md` 设计规范。`fauxrpc` 仍是外部 CLI，仓库不提交 CLI 二进制。

# 常用命令

优先使用 `pnpm`。

```bash
pnpm install
pnpm dev:mobile
pnpm dev:desktop
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format
pnpm proto:generate
pnpm mock:schema
pnpm mock:fauxrpc
pnpm mock:generate:user
```

- `pnpm dev:mobile` 启动 `apps/mobile`，默认端口为 `3001`。
- `pnpm dev:desktop` 启动 `apps/desktop`，默认端口为 `3002`。
- `pnpm proto:generate` 使用 `buf.gen.yaml` 从 `buf.build/sast/sast-shop-v2` 生成 Protobuf-ES v2 TypeScript 到 `packages/api/src/gen`，生成物提交入库。
- `pnpm mock:schema` 生成 `.mock/fauxrpc/sast-shop-v2.binpb`；`pnpm mock:fauxrpc` 再在 `127.0.0.1:6660` 启动 fauxrpc mock backend。
- 交付前至少运行 `pnpm lint`；涉及路由、构建配置、服务端代码或依赖变更时同时运行 `pnpm build`。
- `pnpm build` 在沙箱内可能因 Turbopack 端口权限失败；审批模式下可通过。

# 当前目录入口

- `apps/mobile/app/`：移动端商城 App Router 入口。
- `apps/desktop/app/`：桌面端 App Router 入口。
- `apps/mobile/next.config.ts`、`apps/desktop/next.config.ts`：子应用 Next 配置入口。
- `packages/api/src/`：前端 API facade，维护 `mock`、`local`、`remote` 数据源边界；当前 Auth/User/Profile/Address/Payment QR Code 已有 mock/local 闭环，`remote` 仍明确未接入。
- `packages/api/src/gen/`：Buf/Protobuf-ES v2 生成物；不要手写或手改生成文件。
- `packages/domain/src/`：领域逻辑与纯函数。
- `packages/mocks/src/`：fixture 和 mock 数据。
- `packages/ui/src/`：共享 UI 组件、样式和工具函数。
- `apps/mobile/app/profile/`、`apps/desktop/app/profile/`：个人资料、地址簿与收款码页面；页面只调用 `@sast-shop/api` facade。
- `packages/ui/src/components/dialog.tsx`、`packages/ui/src/components/drawer.tsx`：shadcn overlay 基础组件；桌面 profile 用 Dialog，移动端 profile 用 Drawer。
- `buf.gen.yaml`：Connect Web 官方推荐的本地生成配置。
- `mock/fauxrpc/`：fauxrpc stub 与说明；schema 输出在 `.mock/`，不提交。
- `eslint.config.mjs`：Next core-web-vitals 与 TypeScript ESLint 配置。
- 各 workspace package 的 `tsconfig.json`：开启 `strict` 并配置对应 package 的编译边界。
- `pnpm-workspace.yaml`：pnpm 构建依赖白名单；变更 native/build 依赖时注意同步。

# 相关文档

需要读取飞书文档时使用 `lark-wiki`、`lark-doc` 等 skills。

- PRD：https://njupt-sast.feishu.cn/wiki/TQAcwn0yTixmEBkhGhPcHyT3n3c
- 后端数据库设计：https://njupt-sast.feishu.cn/wiki/QBzywhf7XiavnjkMeYJcj2w7ntd
- proto 接口：https://buf.build/sast/sast-shop-v2

# 环境变量

- 每个 app 提交 `.env.example`；本地开发复制为 `.env.local`，生产环境复制为 `.env`。
- `.env.local` 与 `.env` 不提交。
- `NEXT_PUBLIC_DATA_SOURCE` 支持 `mock`、`local`、`remote`；当前默认 `mock`。
- `NEXT_PUBLIC_CONNECT_BASE_URL` 只用于 `local` 数据源，本地 fauxrpc URL 写在各 app 的 `.env.local` 中，默认 `http://127.0.0.1:6660`。
- Next.js 会内联 `NEXT_PUBLIC_*`；部署镜像构建阶段必须注入目标环境值。

# 开发规范

- 界面语言使用中文，不需要 i18n。
- 移动端优先，同时适配桌面端；优先用 Tailwind 响应式工具处理布局。
- 已经在 `~/sast-shop/frontend-v2` 实现了一套 UI/UX 设计稿代码；最终实现不必逐像素一致，但核心功能、信息架构和交互应保持一致。
- 使用 Next App Router 约定。默认优先 Server Component；只有需要浏览器状态、事件处理、飞书 JSAPI 或客户端副作用时才使用 `"use client"`。
- 飞书开放平台、Lark SDK、密钥和服务端凭据只能放在服务端边界内，不能泄露到 Client Component 或公开环境变量。
- 接入 shadcn/ui 时使用 shadcn skill/CLI，并保持组件风格与本项目中文移动端商城场景一致。
- 图标按计划使用 remixicon；接入前先安装依赖。若临时使用其他图标库，需要保持风格统一并在依赖中体现。
- 网络请求使用 ConnectRPC 与 Buf 生成代码；页面只调用 `@sast-shop/api` facade，不直接 import proto 生成文件。
- 使用 Connect-ES v2 官方方向：`createClient` + `createConnectTransport({ baseUrl })` + Buf 生成的 service definitions；不要引入过时的 `protoc-gen-connect-es`。
- Server Component 可以直接 await facade；proto message 不跨 Server/Client 边界。若未来需要跨边界传递，使用 `toJson/fromJson` 显式处理序列化。
- `mock`、`local`、`remote` 不要静默互相 fallback；未接入能力应抛 `FeatureUnavailableError` 或展示明确降级状态。

# 前端体验要求

- 这是商城业务界面，不要做营销式落地页；首屏应直接呈现可用的购物、商品、分类、订单或个人中心体验。
- 控件选择贴合实际操作：按钮带清晰命令或图标，二元设置用开关/复选框，选项集用菜单、tabs 或 segmented controls。
- 小屏上优先保证浏览、筛选、加购、结算等主流程顺畅；避免文字溢出、控件挤压和卡片套卡片。
- 页面文字、空状态、错误提示和按钮文案都使用自然中文。

## 移动端 UI/交互约定

- `apps/mobile` 的整体信息架构、底部导航、一级/二级页面标题逻辑和主要交互参考 `../frontend-v2`；设计细节同时对齐 `DESIGN.md` 与 PRD 示意图。
- 一级页面默认从商城进入；底部导航顺序为商城、团购、订单、我的。一级页面不显示顶部导航栏；二级页面才按原型显示顶部标题与返回逻辑。
- 尽可能使用 `packages/ui` 中的 shadcn-style 组件。Tabs、Drawer、Dialog、Spinner、Item 等不要用手绘替代；缺组件时先补共享 UI 组件，再在业务页面组合。
- 移动端底部弹层使用 Drawer，不用 Sheet。Drawer 需要有顶部小横条、上方圆角、纯净背景，层级高于底部导航栏，宽度占满视口；地址簿、快捷收款码等抽屉不放明显关闭按钮。
- 页面滚动只发生在内容区域，滚动条不能延伸到底部导航栏后方，也不要挤压页面导致内容偏移；滚动底部留白按导航栏高度控制，避免空白过多。
- 商品或店铺图片加载中使用合适的图标占位，加载失败使用裂图占位，不直接暴露浏览器默认破图样式。
- 当前页面的底部导航点击不刷新路由：有滚动位置时回到顶部；已在顶部时触发下拉刷新 loading。刷新行为需要防抖，短时间只允许执行一次。

# 验证要求

- 文档或纯配置变更：检查内容准确性即可。
- 前端代码变更：运行 `pnpm lint`，必要时运行 `pnpm build`。
- 视觉/交互变更：按影响范围启动 `pnpm dev:mobile` 或 `pnpm dev:desktop`，在移动端和桌面端视口检查关键流程。
- 接入数据、鉴权、飞书接口或服务端逻辑：额外关注 secrets、权限边界、错误处理和降级状态。
- 接入数据层、生成物或 proto 配置时，运行 `pnpm proto:generate` 并确认 `buf.gen.yaml`、`packages/api/src/gen` 无 drift。

# Agent Orchestration

仓库内的 agent 规则来源见 `.agents/rules/agents.md`。如果当前运行环境支持 Task/子代理，按该文件进行分派；如果不支持，则在主线程完成同等检查并说明未分派原因。

## Immediate Agent Usage

No user prompt needed:

1. Complex feature requests - Use **planner** agent
2. Code just written/modified - Use **code-reviewer** agent
3. Bug fix or new feature - Use **tdd-guide** agent
4. Architectural decision - Use **architect** agent

## Parallel Task Execution

ALWAYS use parallel Task execution for independent operations:

```markdown
# GOOD: Parallel execution

Launch 3 agents in parallel:

1. Agent 1: Security analysis of auth module
2. Agent 2: Performance review of cache system
3. Agent 3: Type checking of utilities

# BAD: Sequential when unnecessary

First agent 1, then agent 2, then agent 3
```

## Multi-Perspective Analysis

For complex problems, use split role sub-agents:

- Factual reviewer
- Senior engineer
- Security expert
- Consistency reviewer
- Redundancy checker
