# 项目概述

这是一个面向飞书网页应用的在线商城前端。项目当前处于 Next.js 初始阶段，已经落地的技术栈包括 Next.js 16 App Router、React 19、TypeScript strict、Tailwind CSS v4、ESLint 9 和 Lark Node SDK。

规划中的实现约束包括 shadcn/ui、remixicon、ConnectRPC、buf.build 代码生成和 fauxrpc mock。当前 `package.json` 尚未安装 shadcn/ui、remixicon、ConnectRPC、buf CLI、fauxrpc 或 Prettier；接入前先补依赖与脚本，不要假设它们已经可用。

# 常用命令

优先使用 `pnpm`。

```bash
pnpm install
pnpm dev
pnpm lint
pnpm build
pnpm start
```

- `pnpm dev` 启动本地开发服务，默认端口为 `3000`。
- `pnpm start` 需要先执行 `pnpm build`。
- 交付前至少运行 `pnpm lint`；涉及路由、构建配置、服务端代码或依赖变更时同时运行 `pnpm build`。

# 当前目录入口

- `app/layout.tsx`：根布局、字体、metadata 和全局 `<html>/<body>` 结构。正式中文界面落地时，将 `lang` 从 `en` 调整为 `zh-CN`。
- `app/page.tsx`：当前仍是 create-next-app 默认首页，后续商城首页从这里替换或重构。
- `app/globals.css`：Tailwind v4 入口与基础 theme token。
- `next.config.ts`：Next 配置入口。
- `eslint.config.mjs`：Next core-web-vitals 与 TypeScript ESLint 配置。
- `tsconfig.json`：开启 `strict`，并配置 `@/*` 指向项目根目录。
- `pnpm-workspace.yaml`：pnpm 构建依赖白名单；变更 native/build 依赖时注意同步。

# 相关文档

需要读取飞书文档时使用 `lark-wiki`、`lark-doc` 等 skills。

- PRD：https://njupt-sast.feishu.cn/wiki/TQAcwn0yTixmEBkhGhPcHyT3n3c
- 后端数据库设计：https://njupt-sast.feishu.cn/wiki/QBzywhf7XiavnjkMeYJcj2w7ntd
- proto 接口：https://buf.build/sast/sast-shop-v2

# 开发规范

- 界面语言使用中文，不需要 i18n。
- 移动端优先，同时适配桌面端；优先用 Tailwind 响应式工具处理布局。
- 已经在 `~/sast-shop/frontend-v2` 实现了一套 UI/UX 设计稿代码；最终实现不必逐像素一致，但核心功能、信息架构和交互应保持一致。
- 使用 Next App Router 约定。默认优先 Server Component；只有需要浏览器状态、事件处理、飞书 JSAPI 或客户端副作用时才使用 `"use client"`。
- 飞书开放平台、Lark SDK、密钥和服务端凭据只能放在服务端边界内，不能泄露到 Client Component 或公开环境变量。
- 接入 shadcn/ui 时使用 shadcn skill/CLI，并保持组件风格与本项目中文移动端商城场景一致。
- 图标按计划使用 remixicon；接入前先安装依赖。若临时使用其他图标库，需要保持风格统一并在依赖中体现。
- 网络请求按计划使用 ConnectRPC 与 buf.build 生成代码；不要手写与 proto 不一致的临时类型。生成产物目录落地后，在本文档补充准确路径和生成命令。
- mock 数据按计划使用 fauxrpc；当前未安装，使用前先补依赖和启动脚本。

# 前端体验要求

- 这是商城业务界面，不要做营销式落地页；首屏应直接呈现可用的购物、商品、分类、订单或个人中心体验。
- 控件选择贴合实际操作：按钮带清晰命令或图标，二元设置用开关/复选框，选项集用菜单、tabs 或 segmented controls。
- 小屏上优先保证浏览、筛选、加购、结算等主流程顺畅；避免文字溢出、控件挤压和卡片套卡片。
- 页面文字、空状态、错误提示和按钮文案都使用自然中文。

# 验证要求

- 文档或纯配置变更：检查内容准确性即可。
- 前端代码变更：运行 `pnpm lint`，必要时运行 `pnpm build`。
- 视觉/交互变更：启动 `pnpm dev`，在移动端和桌面端视口检查关键流程。
- 接入数据、鉴权、飞书接口或服务端逻辑：额外关注 secrets、权限边界、错误处理和降级状态。

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
