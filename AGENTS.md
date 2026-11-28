# SAST 商城开发约定

适用于整个 frontend monorepo；修改子应用时同时阅读 `apps/mobile/AGENTS.md` 或 `apps/desktop/AGENTS.md`。以用户当前指令和已确认产品决定为准，不重提已解决的问题。

## 开始任务

- 先确认当前分支、工作树、相关目录和运行中服务；保留无关未提交改动，只改本次范围内的文件。
- 区分核查、修复、commit 与 push：核查先给证据，修复完成实现与验证；commit/push 仅在明确授权范围内执行，已授权不重复询问。
- 沿用当前分支（在 `main` 操作时不自行建分支/worktree）；同步远端前检查本地改动，按要求用 `pull --rebase`，不覆盖工作树或改写远端历史。
- 多步骤任务维护进度清单；中途反馈并入主线，处理临时问题后说明“回到主线”及下一步。
- 优先使用 `pnpm`、`rg`、`fd`、`eza`、`sd`，不可用时用已有替代，不为普通核查安装额外工具。

## 项目与目录

面向飞书网页应用的商城前端，基于 pnpm workspace、Next.js App Router、React、TypeScript strict、Tailwind CSS v4、Vitest 和 ConnectRPC（具体版本见各 `package.json` 与锁文件）。

| 目录                                    | 职责                                                           |
| --------------------------------------- | -------------------------------------------------------------- |
| `apps/mobile`                           | 移动端应用（端口 `3001`）；触屏、底部导航和 Drawer 交互        |
| `apps/desktop`                          | 桌面端应用（端口 `3002`）；桌面导航、Dialog 和键盘操作         |
| `packages/api/src/services`             | API facade、RPC 调用和数据映射；页面通过 `@sast-shop/api` 调用 |
| `packages/api/src/gen`                  | Buf/Protobuf-ES 生成物，提交入库，不手写或手改                 |
| `packages/api/src/lark-client.ts`       | 飞书环境识别、SDK 订阅和 JSAPI 调用适配                        |
| `packages/domain`                       | 金额、数量、状态等领域类型与纯函数                             |
| `packages/ui`                           | 共享组件（`@workspace/ui`）、语义样式及交易协议内容与交互      |
| `proto`、`scripts/sync-proto.mjs`       | 本地协议快照与后端 proto 同步脚本                              |
| `mock/fauxrpc`                          | ConnectRPC mock stubs；生成 schema 位于忽略的 `.mock/`         |
| `server`                                | 服务端商品图代理、商品图上传与 Pocket 照片上传处理             |
| `design/brand`                          | 品牌源图、提示词及两端资源导出脚本                             |
| `docs`                                  | 前端文档索引（见 `docs/README.md`，含接口契约与状态走查指南）  |
| `config`、`deploy`、`.github/workflows` | 共享安全/图片配置、Compose 模板与 CI/发布工作流                |

## 产品与接口依据

- 审查业务流程使用最新 PRD 与流程图；涉及金额、分摊、权限、状态流转时，追踪 **页面 → API facade → ConnectRPC → 后端实现 → 状态映射**，不凭文案、mock 样例或旧讨论推断规则。
- 参考：[产品需求](https://njupt-sast.feishu.cn/wiki/TQAcwn0yTixmEBkhGhPcHyT3n3c)、[数据库设计](https://njupt-sast.feishu.cn/wiki/QBzywhf7XiavnjkMeYJcj2w7ntd)、本地 `proto/` 快照（见 `proto/README.md`）与 [Buf 模块](https://buf.build/sast/sast-shop-v2)。读飞书文档使用可用的 `lark-wiki`/`lark-doc` 技能。
- UI 只能依赖当前接口真实支持的字段和 RPC；缺失时明确降级或记录后端阻塞，不伪造业务状态。
- 核查结论区分为“确认缺陷”“待产品确认”“后端阻塞”并附代码或接口证据；文档与实现不一致时说明差异，不把猜测当事实。
- 设计以 `DESIGN.md` 和现有页面为准，保持颜色、组件和紧凑业务布局一致，不套用营销式大留白。

## 环境、数据源与飞书

| 配置                               | 约定                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `AUTH_MODE=off`                    | 仅用于本地 `mock`/`local`，跳过登录及登录时的飞书环境检查；生产禁止                                             |
| `AUTH_MODE=required`               | 两端读取会话前检查飞书环境；普通浏览器提示“请在飞书中打开应用”                                                  |
| `NEXT_PUBLIC_FORCE_FEISHU_UI=true` | 仅用于移动端本地视觉验收以展示专属入口；不模拟 SDK，不绕过登录或签名，生产关闭                                  |
| `NEXT_PUBLIC_DATA_SOURCE`          | `mock`/`local` 经 ConnectRPC 接入；`remote` 尚未实现，不得静默 fallback；默认值见各 app 配置，不假设两端相同    |
| `NEXT_PUBLIC_APP_ORIGIN`           | 当前应用访问源；浏览器通过同源 `/api/connect` 代理访问后端                                                      |
| `CONNECT_BASE_URL`                 | 服务端私有上游地址；`NEXT_PUBLIC_CONNECT_BASE_URL` 仅用于本地开发，禁止向公开 bundle 暴露生产私有地址           |
| `NEXT_PUBLIC_FEEDBACK_FORM_URL`    | 问卷地址放部署配置；核查 Repository Variable → workflow → Docker build arg 注入链路                             |

- `.env.local`、`.env` 和凭据不提交；改 env 后重启受影响的 Next 服务。`NEXT_PUBLIC_*` 在构建时内联，线上修改公开配置须重新构建部署。
- 官方 H5 SDK 和公开应用 ID 可在客户端使用；应用密钥、`SESSION_COOKIE_SECRET`、签名生成及服务端凭据必须留在服务端。
- 飞书环境判断统一调用 `isLarkClientEnvironment` / `isLarkMobileClientEnvironment`，不要仅凭 `window.h5sdk` 或 `h5sdk.browser.versions` 判断。
- 区分“在飞书内”与“SDK/API 已就绪”；依赖 SDK 的入口须复用 `subscribeLarkEnvironment` / `useSyncExternalStore` 处理延迟加载，不用空订阅固定首次渲染结果。
- 扫码、联系前仍校验 SDK 方法并完成服务端签名；SDK 迟到提示可重试，扫码取消保留输入并允许重试或手输。
- AppLink、相机、原生导航栏、输入法等行为须核对官方支持并在真机验证；浏览器 UA 模拟只证明入口与布局，不能报告为真机 JSAPI 成功。

## 实现与交互

- 页面通过 `@sast-shop/api` facade 调用接口，不直接导入生成 proto。沿用 Connect-ES v2（`createClient`、`createConnectTransport` 与生成 service definitions），不引入旧版 `protoc-gen-connect-es`。
- Server Component 可直接 await facade；仅客户端交互使用 `"use client"`。proto message 不直接跨 Server/Client 边界，必要时显式 `toJson`/`fromJson`。
- 运行时 mock 数据统一维护在 `mock/fauxrpc/stubs`，不手写运行时 fixture；单元测试可使用隔离测试数据。
- `useSearchParams()` 用于共享 bootstrap 或可预渲染路由时，须用 `Suspense` 包裹子组件，避免生产构建失败。
- 优先组合 `packages/ui`（`@workspace/ui`）组件，新增/调整 shadcn 组件使用对应技能或 CLI；透传行为 prop 并使用真实 Radix `data-*` 状态选择器。
- 样式以 `packages/ui/src/styles/globals.css` 语义 token 为准，保持单一 Action Coral 与既有状态色；基础规则放 `@layer base`，禁止引入远程 Google 字体或散落原始颜色类（CI 会拦截）。
- 界面使用自然简短的中文；个人中心与交易协议弹层短描述沿用不加末尾句号风格；展示说明不重复操作按钮或同一价格。
- 列表尾部复用 `InfiniteListStatus` 且与末张卡片留距；局部间距问题局部修复，不全局硬设行高或 padding。
- 主导航使用品牌矢量图标，通用控件用 Remixicon，模块/空状态插画用 `BrandIllustration` 及 `design/brand` 导出素材；小尺寸用矢量或 compact 高分辨率资源。
- 商品/店铺图片加载与失败使用共享占位，不暴露默认破图；品牌装饰图不得替代真实头像、商品图或微信/支付宝平台标志。
- 可点击卡片保证键盘可访问，可展开卡片维护 `aria-expanded` 并使用现有 Collapsible 动画（支持减少动态效果）；子操作不得嵌套在 `button` 内。

## 交易与失败恢复

- 金额沿用整数分及现有解析/格式化函数；包装费、单价、分摊规则核对当前后端实现。更新所需 `updatedAt` 等版本字段必须来自写入响应或重新拉取的详情。
- 交易写操作须先等待 `ensureAgreement()`；协议内容在 `packages/ui/src/content/transaction-agreement.json`，同意至少等待 5 秒，鉴权开启时 localStorage 按版本与用户隔离，mock 模式沿用本地测试记录。拒绝、身份确认失败或存储失败时严禁写入。
- 防止重复点击及扫码/提交竞争；异步完成后不向已关闭或已切换的表单回填，优先保留用户输入、局部错误与恢复入口。
- 超时、断网或写入响应缺失等结果不明场景，先刷新详情核实并沿用现有 pending/recovery 锁，不盲目重发或宣称成功；并发冲突先刷新版本再操作。
- 商品、收款码、地址等独立数据局部失败不影响整页；明确 loading、空状态与失败状态，重试只覆盖受影响区块。

## 调试与验证

常用命令：`pnpm dev:mobile`、`pnpm dev:desktop`、`pnpm mock:schema`、`pnpm mock:fauxrpc`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm audit:prod`、`pnpm proto:generate`。

- 启动前核对端口与已有进程，优先复用相符服务；`fauxrpc` 为外部 CLI，按 `mock/fauxrpc/README.md` 启动 `127.0.0.1:6660`，不把二进制提交入库。结束临时服务时只停止自己启动的进程。
- 本地 mock 联调须核对数据源、`AUTH_MODE=off`、应用 origin 和代理上游，验证实际 RPC 数据与错误分支，不以“页面打开”代替联调。
- 代码改动至少跑 lint、typecheck 和受影响的行为测试；纯文案/样式微调不加实现镜像测试，登录/交易/状态流转/异步互斥/失败恢复须补能复现问题的回归测试。
- 回归测试保留被测的环境识别、状态映射等真实逻辑，仅 mock RPC 或 SDK 回调边界。
- 跨端/共享改动或提交前较大变更依次执行 `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build`；路由、服务端、构建配置或依赖改动必须构建，依赖改动额外跑 `pnpm audit:prod`，不通过关闭 CI 检查过关。
- 依赖升级同步更新 `package.json`、锁文件及必要的 `pnpm-workspace.yaml` overrides/build 白名单，并验证 `--frozen-lockfile` 安装；更新 GitHub Actions 保留 SHA 固定并核对官方版本要求。
- **同一 app 的 build、next typegen 和 typecheck 必须顺序执行**，避免并发读写 `.next`。遇到缺失 `.next/types` 或旧路由缓存时先核实并针对性重建后重跑，不通过删源码、收窄 tsconfig 或隐藏错误绕过。
- 生产构建必须使用 `AUTH_MODE=required`（参照 `.github/workflows/ci.yml` 的无真实凭据配置）；涉及 `output: standalone` 或容器配置改动时，核对 `deploy/compose.*.yml` 与 CI 容器 smoke 流程（普通前端改动无需重跑容器冒烟）。
- 仅在 `proto/`、`buf.gen.yaml` 或生成接口预期变化时运行 `pnpm proto:generate` 并核对差异（同步后端 proto 见 `proto/README.md`）；CI 会检查生成物 drift。
- 视觉改动使用浏览器工具检查受影响页面、交互和溢出：移动端常用 390×844 并查矮屏，桌面端查窄/宽视口；截图标明 mock、UA 模拟或真机条件，用户要求效果图时直接展示。
- 仅格式化本次改动文件，避免 `pnpm format` 改写整个脏工作树；交付前运行 `git diff --check`。
- 如实报告结果：失败先排查并说明，未执行或真机无法验证项明确标注，不笼统称“全部通过”。

## 协作与交付

- 支持子代理时，可并行分派独立的契约核对、回归测试或代码审查，先划清文件所有权；共享缓存、端口和 Git 操作按依赖顺序执行。简单文案/样式无需重流程，复杂交易或鉴权改动应有独立审查。
- 项目级 AI Skill 通过根目录 `skills-lock.json` 锁定（`connectrpc`、`impeccable`、`modern-web-guidance`、`shadcn`），安装到 `.agents/skills/`（已加入 `.gitignore`），协作者可执行 `pnpm dlx skills experimental_install` 还原；Next.js 16.3+ 规则以各子应用 `node_modules/next/dist/docs/` 与 `apps/*/AGENTS.md` 自动生成块为准。
- 默认不写复述“做了什么”的代码注释，仅注释隐藏约束、非显然原因或必要 workaround，保留仍有效的既有注释。
- 提交前审查实际 diff 与文件范围，使用 Conventional Commits；push 前核对分支、remote、待推提交与授权，明确“只 commit 不 push”时止于提交。
- 排查 GitHub CI 读取失败 job 的完整日志；远端写操作按用户授权执行；提后端 issue 前先搜索所有状态避免重复。
- 交付说明写明改动、验证结果、仍需真机/后端核验事项及实际提交状态，不把本地修复说成已上线。
