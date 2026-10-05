# SAST 商城开发约定

本文件适用于整个 frontend monorepo；修改子应用时同时阅读 `apps/mobile/AGENTS.md` 或 `apps/desktop/AGENTS.md`。以用户当前指令和已确认的产品决定为准，不重新提出已解决的问题。

## 开始任务

- 先确认当前分支、工作树、相关目录和正在运行的服务。保留用户及其他任务的未提交改动，只修改本次范围内的文件。
- 区分核查、修复、提交和推送：用户要求核查时先提供证据；要求修复时完成实现与验证。commit 和 push 仅在已明确授权的工作范围内执行，已授权的操作不重复询问。
- 沿用当前分支；用户明确要求在 `main` 操作时，不自行创建分支或 worktree。同步远端前检查本地改动，按用户要求使用 `pull --rebase`，不覆盖工作树或改写远端历史。
- 多步骤任务维护进度清单。收到中途反馈时并入当前任务；处理临时问题后说明“回到主线”及下一步。
- 优先使用 `pnpm`、`rg`、`fd`、`eza`、`sd`；工具不可用时使用已有替代，不为普通核查安装额外工具。

## 项目与目录

这是面向飞书网页应用的商城，采用 pnpm workspace、Next.js App Router、React、TypeScript strict、Tailwind CSS v4、Vitest 和 ConnectRPC。具体版本以各 `package.json` 和锁文件为准。

| 目录                                    | 职责                                                           |
| --------------------------------------- | -------------------------------------------------------------- |
| `apps/mobile`                           | 移动端应用，开发端口 `3001`；触屏、底部导航和 Drawer 交互      |
| `apps/desktop`                          | 桌面端应用，开发端口 `3002`；桌面导航、Dialog 和键盘操作       |
| `packages/api/src/services`             | API facade、RPC 调用和数据映射；页面通过 `@sast-shop/api` 调用 |
| `packages/api/src/gen`                  | Buf/Protobuf-ES 生成物，提交入库，不手写或手改                 |
| `packages/api/src/lark-client.ts`       | 飞书环境识别、SDK 订阅和 JSAPI 调用适配                        |
| `packages/domain`                       | 金额、数量、状态等领域类型与纯函数                             |
| `packages/ui`                           | 共享组件、语义样式及交易协议内容与交互                         |
| `mock/fauxrpc`                          | ConnectRPC mock stubs；生成 schema 放在忽略的 `.mock/`         |
| `design/brand`                          | 品牌源图、提示词及两端图标导出脚本                             |
| `config`、`.github/workflows`、`docker` | 共享配置、CI、部署和容器启动约束                               |

## 产品与接口依据

- 产品流程审查使用最新 PRD 和流程图；涉及金额、分摊、权限、状态流转时，追踪 **页面 → API facade → ConnectRPC → 后端实现 → 状态映射**。不要只根据文案、mock 样例或旧讨论推断规则。
- PRD：[产品需求](https://njupt-sast.feishu.cn/wiki/TQAcwn0yTixmEBkhGhPcHyT3n3c)；[数据库设计](https://njupt-sast.feishu.cn/wiki/QBzywhf7XiavnjkMeYJcj2w7ntd)；[proto](https://buf.build/sast/sast-shop-v2)。读取飞书文档使用可用的 `lark-wiki`、`lark-doc` 等技能。
- UI 只能使用当前接口支持的字段和功能。人数、金额构成、原价比较、取消、结算预览等展示或操作，先确认对应数据和 RPC；缺失时明确降级或记录后端阻塞，不伪造业务状态。
- 核查结论分为“确认缺陷”“待产品确认”“后端阻塞”，给出代码或接口证据。文档与实现不一致时说明差异，不能把猜测写成事实。
- 设计参考 `DESIGN.md`、现有页面及可用的 `../frontend-v2` 原型。颜色和组件保持一致；营销式大留白、整屏展示等参考描述不适用于商城任务页，优先采用用户已确认的紧凑布局。

## 环境、数据源与飞书

| 配置                               | 约定                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `AUTH_MODE=off`                    | 仅用于本地 mock/local，跳过登录及登录时的飞书环境检查；生产环境禁止                                             |
| `AUTH_MODE=required`               | 两端在读取登录会话前检查飞书环境；普通浏览器提示“请在飞书中打开应用”                                            |
| `NEXT_PUBLIC_FORCE_FEISHU_UI=true` | 仅用于移动端本地视觉验收，展示专属入口；不模拟 SDK，不绕过登录或签名，生产关闭                                  |
| `NEXT_PUBLIC_DATA_SOURCE`          | `mock`、`local` 经 ConnectRPC 接入；`remote` 尚未实现，不能静默 fallback；默认值查看各 app 配置，不假设两端相同 |
| `NEXT_PUBLIC_APP_ORIGIN`           | 当前应用访问源；应用通过同源 `/api/connect` 代理访问后端                                                        |
| `CONNECT_BASE_URL`                 | 服务端私有上游地址；`NEXT_PUBLIC_CONNECT_BASE_URL` 仅用于已有本地开发配置，不向公开 bundle 暴露生产私有地址     |
| `NEXT_PUBLIC_FEEDBACK_FORM_URL`    | 业务 URL 放在部署配置中；检查 Repository Variable → workflow → Docker build arg 的注入链路                      |

- `.env.local`、`.env` 和凭据不提交。使用各 app 的 `.env.example`；修改 env 后重启受影响的 Next 服务。`NEXT_PUBLIC_*` 在构建时内联，线上修改公开配置需要重新构建部署。
- 官方 H5 SDK 和公开应用 ID 可在客户端使用；应用密钥、session secret、签名生成及服务端凭据必须留在服务端。
- 环境判断统一调用 `isLarkClientEnvironment` / `isLarkMobileClientEnvironment`。不要仅凭 `window.h5sdk` 存在或 `h5sdk.browser.versions` 判断；当前 CDN SDK 不保证暴露 `browser` 字段。
- 区分“在飞书内”和“SDK/API 已就绪”。依赖 SDK 的入口需处理加载后的状态更新，复用 `subscribeLarkEnvironment` / `useSyncExternalStore`，不能用空订阅固定首次渲染结果。
- 执行扫码、联系前仍检查 SDK 方法并完成必要的服务端签名；环境识别不替代签名或服务端会话校验。SDK 迟到显示可重试提示，扫码取消保留输入并允许重试或手动录入。
- 飞书 AppLink、相机、原生导航栏、输入法等行为需核对官方支持并在真实客户端验证。浏览器 UA 模拟只证明入口和布局，不能报告为真机 JSAPI 成功。

## 实现与交互

- 页面使用 `@sast-shop/api` facade，不直接导入生成 proto。沿用 Connect-ES v2：`createClient`、`createConnectTransport` 和生成的 service definitions，不引入旧版 `protoc-gen-connect-es`。
- Server Component 可直接 await facade；客户端交互才使用 `"use client"`。proto message 不直接跨 Server/Client 边界，需要时显式使用 `toJson/fromJson`。
- 运行时 mock 数据统一维护在 `mock/fauxrpc/stubs`，通过 ConnectRPC 获取；组件/API facade 不添加手写运行时 fixture。单元测试可使用隔离的测试数据。
- `useSearchParams()` 用于共享 bootstrap 或静态可预渲染路由时，使用 Suspense 包裹的子组件，避免生产构建失败。
- 优先组合 `packages/ui` 的 shadcn-style 组件；接入或修改 shadcn 组件时使用相关技能/CLI。行为 prop 继续传给 primitive，使用真实 Radix `data-*` 状态选择器。
- 样式以 `packages/ui/src/styles/globals.css` 的语义 token 为实现基准，保持单一 Action Coral；状态色使用现有语义样式。基础规则放在 `@layer base`，避免覆盖工具类。不添加远程 Google 字体或散落的原始颜色值。
- 界面使用自然中文，描述保持必要且简短；个人中心/交易协议弹层的可见短描述沿用不加末尾句号的文案风格。展示型说明不重复操作按钮或同一价格。
- 遵循现有信息层级和紧凑间距；列表尾部复用 `InfiniteListStatus`，不要紧贴最后一张卡片。局部间距问题局部修复，不全局强制固定行高或 padding。
- 主导航沿用品牌矢量图标，通用功能控件使用已有 Remixicon；品牌插画使用 `BrandIllustration` 及 `design/brand` 导出的对应模块素材。小尺寸图标使用矢量或 compact 高分辨率资源，避免压缩、透明留白造成模糊。
- 商品/店铺图片加载和失败使用共享占位，不暴露默认破图。品牌装饰图不能替代真实头像、商品图或微信/支付宝平台标志。
- 可点击卡片保持键盘可访问性，可展开卡片维护 `aria-expanded`；子操作不能嵌套在 button 内。展开/收起使用现有 Collapsible 动画，支持减少动态效果设置。

## 交易与失败恢复

- 金额沿用整数分和现有解析/格式化函数；包装费、单价、数量分配等规则核对当前后端，不能凭印象计算。更新需要的 `updatedAt` 等版本字段必须来自写入响应或重新拉取的详情。
- 涉及交易的写操作先等待 `ensureAgreement()`。协议内容维护在 `packages/ui/src/content/transaction-agreement.json`，同意至少等待 5 秒；鉴权开启时 localStorage 记录按现有版本和用户隔离，关闭鉴权的 mock 沿用本地测试记录。拒绝、身份确认失败或存储失败时不得继续写入。
- 防止重复点击、扫码与提交竞争；异步完成后避免回填到已关闭或已切换的表单。优先保留用户输入、局部错误及可用恢复入口。
- 超时、网络中断、写入成功但响应缺失等结果不明情况，先刷新详情核实；沿用现有 pending/recovery 锁，不盲目重发或宣称成功。并发冲突先刷新版本，避免覆盖新数据。
- 商品、收款码、地址等独立数据的局部失败不应使整页失效；明确 loading、空状态、失败状态，重试只覆盖受影响部分。

## 调试与验证

常用命令：

```bash
pnpm dev:mobile
pnpm dev:desktop
pnpm mock:schema
pnpm mock:fauxrpc
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit:prod
pnpm proto:generate
```

- 启动前核对端口和已有进程，优先复用相符的服务。`fauxrpc` 是外部 CLI；先确认可用，再按 `mock/fauxrpc/README.md` 启动 `127.0.0.1:6660`，不要把二进制提交入库。
- 本地 mock 联调核对 data source、`AUTH_MODE=off`、当前 app origin 和代理上游，验证实际 RPC 数据与错误分支，不能只看到页面就认为联调成功。记录自己启动的进程，结束临时验证服务时只停止这些进程。
- 普通前端代码改动至少运行 lint、typecheck 和受影响的行为测试。纯文案/样式微调不添加实现镜像测试；登录、交易、状态流转、异步互斥或失败恢复需补能复现问题的回归测试。
- 回归测试保留被修复的环境识别、状态映射等逻辑，mock RPC 或 SDK 回调边界；不要把待验证的函数 mock 成固定结果而遗漏缺陷。
- 跨端/共享逻辑改动、提交前的较大变更运行 `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build`。路由、服务端、构建配置或依赖改动必须构建；依赖改动额外运行 `pnpm audit:prod`，不关闭 CI 检查来获得通过。
- 依赖升级同步 package 文件、锁文件及必要的 `pnpm-workspace.yaml` overrides/build 白名单，验证冻结锁文件安装。更新 GitHub Actions 保留现有 SHA 固定方式，核对官方版本及运行环境要求。
- **同一 app 的 build、生成 Next 类型和 typecheck 顺序执行**，不要并发读写 `.next`。类型检查遇到丢失的 `.next/types` 或已删除路由，先核实生成缓存，再有针对性地重新生成并重跑；不通过删除源码、收窄 tsconfig 或隐藏错误解决。
- 生产构建必须使用 `AUTH_MODE=required`，可参照 `.github/workflows/ci.yml` 的无真实凭据验证配置。当前 `output: standalone` 的运行和资源布局按 `Dockerfile` / `docker/entrypoint.sh` 核对。
- 修改容器或启动脚本时额外检查 shell 语法和容器健康端点，复用 CI smoke 流程；普通前端修改无需重复全部容器验证。
- 仅在 proto/schema、`buf.gen.yaml` 或生成接口预期变化时运行 `pnpm proto:generate` 并核对生成差异；普通 UI 或 facade 逻辑修复不顺带拉取浮动 proto。CI 会检查生成物 drift。
- 视觉改动用 Codex in-app Browser 检查影响页面、操作及溢出。移动端通常 390×844，并检查矮屏；桌面检查窄/宽视口。截图标明 mock、UA 模拟或真机条件，用户要求效果图时直接展示图片。
- 只格式化本次修改文件，避免 `pnpm format` 改写整个脏工作树。交付前运行 `git diff --check`；文档-only 修改检查准确性、引用和格式即可。
- 如实报告检查结果：失败先排查，缓存修复后重跑并说明；未执行或真机无法验证的项目明确注明，不能称“全部通过”。

## 协作与交付

- 当前环境支持子代理时，将独立的契约核对、回归测试或代码审查并行分派；先划清文件所有权，避免多人改同一文件。共享缓存、端口和 Git 操作按依赖顺序执行。
- 简单文案和局部样式无需固定数量的代理、完整规划文档或覆盖率门槛；复杂交易/鉴权修改应有独立审查。缺少代理工具时在主线程完成检查，不因此停工。
- `.agents/rules/` 下的 development-workflow、code-review、git-workflow 等是通用参考；本文件规定本仓库的授权、验证和分派方式。不要引用不存在的 `.agents/rules/agents.md` 或要求不可用的固定角色工具。
- 默认不添加解释“做了什么”的代码注释；仅为隐藏约束、非显然原因或必要 workaround 写注释，保留仍有效的既有注释。
- 提交前审查实际 diff 与文件范围，使用 Conventional Commits。push 前核对分支、remote、待推送提交和授权；明确要求“只 commit 不 push”时止于提交。
- GitHub CI 排查读取失败 job 和完整日志，定位锁文件、生成物、环境或构建问题；依赖 PR 合并、远端分支删除等远端写操作按用户授权执行。后端需求提 issue 前搜索所有状态的现有 issue，避免重复。
- 交付说明包含改动、验证、仍需真机/后端核验的事项及实际提交状态；不要把本地修复写成已经上线。
