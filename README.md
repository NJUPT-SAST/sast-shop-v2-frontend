# SAST Shop

SAST Shop 是面向飞书网页应用的在线商城前端 monorepo，包含移动端商城、桌面端管理/运营界面、共享包、本地协议快照、FauxRPC mock 工具链与部署配置。

## 目录结构

```text
apps/
  mobile/        移动端 Next.js 应用（默认端口 3001；现货、团购、商品分类、Pocket AA）
  desktop/       桌面端 Next.js 应用（默认端口 3002；商城工作台与 /admin 管理后台）
packages/
  api/           API facade、飞书客户端适配与 Protobuf-ES 生成物（src/gen/）
  domain/        领域模型、金额、订单、支付等纯函数
  ui/            共享 UI 组件（@workspace/ui）、语义样式与交易协议内容
proto/           本地协议快照（同步脚本见 scripts/sync-proto.mjs）
mock/fauxrpc/    FauxRPC 提交版 stub 与说明（生成的 binpb 位于忽略的 .mock/）
server/          服务端商品图代理、商品图上传及 Pocket 照片上传处理
config/          共享安全头、图片配置与配置测试
design/brand/    品牌原图、提示词与资源导出脚本
deploy/          Docker Compose 基础模板
docs/            前端文档索引（见 docs/README.md，含 contracts/ 与 guides/）
```

根目录负责 pnpm workspace 编排与共享脚本/配置。

## 本地开发

```bash
pnpm install
pnpm dev:mobile
pnpm dev:desktop
```

常用检查：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit:prod
pnpm format
```

协议生成与 FauxRPC 工具：

```bash
pnpm proto:generate
pnpm mock:schema
pnpm mock:fauxrpc
pnpm mock:generate:user
```

- 运行 FauxRPC 需要本机安装 `fauxrpc` CLI；`@bufbuild/buf` 与 `@bufbuild/protoc-gen-es` 已包含在 workspace devDependencies 中。
- `pnpm proto:generate` 通过 `buf.yaml` 和 `buf.gen.yaml` 从仓库本地 `proto/` 快照生成 Protobuf-ES v2 TypeScript 产物到 `packages/api/src/gen`。生成物随仓库提交，CI 会重新生成并校验 drift。同步后端协议见 [proto/README.md](proto/README.md)。
- `pnpm mock:schema` 从本地 `proto/` 快照构建 `.mock/fauxrpc/sast-shop-v2.binpb`；`pnpm mock:fauxrpc` 在 `127.0.0.1:6660` 启动 FauxRPC 服务与 dashboard，详见 [mock/fauxrpc/README.md](mock/fauxrpc/README.md)。

## AI 协作配置

- 根目录与子应用的开发约束以 `AGENTS.md` 为主，配套 `CLAUDE.md`（`@AGENTS.md`）与 `GEMINI.md`（指向 `AGENTS.md` 的软链接）；`apps/*/AGENTS.md` 顶部的 Next.js 自动生成块及 `apps/*/node_modules/next/dist/docs/` 提供 Next.js 16.3+ 规则。
- 项目级 AI Skill（`connectrpc`、`impeccable`、`modern-web-guidance`、`shadcn`）锁定在根目录 `skills-lock.json`，安装到已忽略的 `.agents/skills/`；拉取仓库后可执行 `pnpm dlx skills experimental_install` 一键还原。

## 交易协议

移动端与桌面端共用 `packages/ui/src/content/transaction-agreement.json`，文案随应用打包，“我的”页面提供全文查看入口。交易提交前未同意时展示协议，等待 5 秒后可确认；查看全文不记录同意。

同意记录存于当前站点 localStorage，正式登录模式按用户隔离；清除浏览器数据、更换设备或站点后需重新确认。修改重要条款时递增 `version` 以触发重新确认（纯前端交互记录，不涉及后端字段）。

## 环境变量

各应用提供 `.env.example` 模板，按目标环境复制使用（`.env.local` 与 `.env` 均不提交）：

```bash
# 本地开发
cp apps/mobile/.env.example apps/mobile/.env.local
cp apps/desktop/.env.example apps/desktop/.env.local

# 非容器生产环境
cp apps/mobile/.env.example apps/mobile/.env
cp apps/desktop/.env.example apps/desktop/.env
```

本地开发常用配置示例（具体默认值以各 app 的 `.env.example` 为准，移动端默认 `NEXT_PUBLIC_DATA_SOURCE=local`，桌面端默认 `mock`）：

```dotenv
AUTH_MODE=off
NEXT_PUBLIC_DATA_SOURCE=local
NEXT_PUBLIC_APP_ORIGIN=http://localhost:3001
NEXT_PUBLIC_FEISHU_REDIRECT_URI=http://localhost:3001/
NEXT_PUBLIC_CONNECT_BASE_URL=http://127.0.0.1:6660
CONNECT_BASE_URL=http://127.0.0.1:6660
NEXT_PUBLIC_FEEDBACK_FORM_URL=
```

关键变量说明：

- `NEXT_PUBLIC_DATA_SOURCE`：`mock`、`local` 均通过 ConnectRPC 访问后端/FauxRPC；`remote` 尚未接通，发布工作流会显式拒绝。
- `AUTH_MODE`：`required` 时两端在读取登录会话前检查飞书客户端环境（普通浏览器提示“请在飞书中打开应用”）；仅本地 `mock`/`local` 开发可设 `off` 跳过登录与环境检查，生产强制 `required`。
- `NEXT_PUBLIC_APP_ORIGIN`：当前应用访问源（本地地址或线上子域名）。
- `NEXT_PUBLIC_FEISHU_APP_ID` / `NEXT_PUBLIC_FEISHU_REDIRECT_URI`：双端飞书 JSAPI 免登所需的公开应用 ID 与同源根路径入口；桌面端独立 OAuth 回调另使用服务端 `FEISHU_APP_ID` 与指向同源 `/auth/callback` 的 `FEISHU_REDIRECT_URI`。
- `NEXT_PUBLIC_FEEDBACK_FORM_URL`：个人中心“帮助与反馈”飞书问卷地址，仅接受 `feishu.cn` / `larksuite.com` 及其子域下无内嵌凭据的 HTTPS URL；留空或无效时不展示入口。飞书内通过 [AppLink](https://open.feishu.cn/document/common-capabilities/applink-protocol/supported-protocol/open-the-web-view-in-feishu-to-access-the-specified-url) 打开（桌面端使用独立窗口），普通浏览器直接打开。
- `NEXT_PUBLIC_FORCE_FEISHU_UI=true`：仅用于移动端本地视觉验收以展示飞书移动端专属入口，不模拟 JSAPI 且不跳过 `AUTH_MODE=required` 校验，生产保持关闭。
- `CONNECT_BASE_URL` / `NEXT_PUBLIC_CONNECT_BASE_URL`：生产浏览器通过同源 `/api/connect` 代理访问后端，服务端读取无内嵌凭据的 HTTPS `CONNECT_BASE_URL`（仅运行时注入，禁止作为 Docker build arg）；`NEXT_PUBLIC_CONNECT_BASE_URL` 仅用于本地 `mock`/`local` 开发。
- `SESSION_COOKIE_SECRET`：至少 32 字符的服务端随机密钥，用于签署 OAuth 返回的用户会话缓存（HttpOnly Cookie），双端分别配置，不得进入 `NEXT_PUBLIC_*`。
- `CONNECT_HEALTH_URL`：指向后端独立、无鉴权且返回 2xx 的 HTTPS 就绪检查端点，不能指向业务 ConnectRPC 路由。

> Next.js 在构建时将 `NEXT_PUBLIC_*` 内联到静态输出和客户端 bundle 中，线上修改任意公开变量均需重新构建并部署镜像。

## API Wiring

`packages/api` facade 使用 `@connectrpc/connect` 的 `createClient` 与 `@connectrpc/connect-web` 的 `createConnectTransport({ baseUrl })` 调用 Protobuf-ES v2 生成物。

- 正式登录模式下当前用户来自 OAuth `LoginResponse.member`，与后端 session token 一起由 `SESSION_COOKIE_SECRET` 签署保存在 HttpOnly Cookie 中；仅本地关闭鉴权（`AUTH_MODE=off`）时回退到 FauxRPC stub 的 `10001` smoke 用户。
- Next App Router 默认使用 Server Components；proto message 若需跨 Server/Client 边界传递，应显式通过 `@bufbuild/protobuf` 的 `toJson` / `fromJson` 转换。

参考：[Connect Web getting started](https://connectrpc.com/docs/web/getting-started/)、[Connect Web SSR](https://connectrpc.com/docs/web/ssr/)。

## 部署

移动端和桌面端分别部署到独立子域名（例如 `shop.example.com` -> mobile，`shop-admin.example.com` -> desktop）。

交付链路分为三个阶段：

1. `CI`（`.github/workflows/ci.yml`）：在 PR、合并队列与 `main` push 执行 Proto drift、生产依赖审计、Lint、Typecheck、测试、构建、字体/原始颜色守卫及双端容器冒烟测试。
2. `Publish Images`（`.github/workflows/publish.yml`）：仅消费通过 CI 的 `main` commit（或手动 `workflow_dispatch`），构建并推送 `linux/amd64` 镜像、SBOM 和 provenance 到 GHCR，标签为不可变的 `sha-<完整 40 位 SHA>` 与 `main`。
3. `Deploy`（`.github/workflows/deploy.yml`）：`main` push 的 CI 与镜像发布全部成功后，自动依次部署 mobile、desktop（固定使用 `production` Environment 和服务器受限 helper）；连接前会核对当前 `main` HEAD，已被后续提交取代时自动跳过。手动运行支持 `mode=diagnostic`（默认，仅检查状态）与 `mode=deploy`（按 `sha-<完整 SHA>` 发布或回滚）。手动运行 `Publish Images` 不会自动触发部署。

镜像地址：

```text
ghcr.io/njupt-sast/sast-shop-v2-frontend-mobile
ghcr.io/njupt-sast/sast-shop-v2-frontend-desktop
```

### GitHub Secrets 与 Variables

在 `production` GitHub Environment 中配置 Secrets：

```text
SERVER_HOST
SERVER_SSH_FINGERPRINT
SERVER_USER
SSH_PRIVATE_KEY
GHCR_USERNAME       # 可选（使用自定义 GHCR_READ_TOKEN 时必填）
GHCR_READ_TOKEN     # 可选（未配置时使用 github.actor + GITHUB_TOKEN）
```

- 部署使用 OpenSSH 固定协商 ED25519 主机密钥，扫描公钥并与 `SERVER_SSH_FINGERPRINT`（通过服务器 `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256` 获取 `SHA256:...`）严格比对后才连接；部署私钥类型不受限。
- 首次核查先运行 `mode=diagnostic`（不传镜像标签、不传仓库凭据、不读 `.env` 也不改动容器）。
- 仓库凭据仅通过 SSH stdin 以 JSON（`registry`、`username`、`password`，上限 16 KiB，非空且无换行/NUL）传给服务器受限入口：`sudo -n /usr/local/lib/sast-shop/deploy-image TARGET REVISION IMAGE_REF --registry-stdin`（`TARGET` 为 `mobile` 或 `desktop`，`REVISION` 为 40 位 SHA），由服务器 helper 负责白名单校验、部署锁、容器切换与失败恢复。

仓库级公开构建配置（Secret + Repository Variables）：

- Repository Secret：`NEXT_PUBLIC_FEISHU_APP_ID`（沿用现有 Secret，与后端应用配置及 `GetJSAPIAuthConfig` 返回的 `appId` 一致；应用密钥只保存在后端）。
- Repository Variables（必需项未配置时 `Publish Images` 会跳过发布）：

```text
MOBILE_APP_ORIGIN=https://shop.example.com
DESKTOP_APP_ORIGIN=https://shop-admin.example.com
MOBILE_FEISHU_REDIRECT_URI=https://shop.example.com/
DESKTOP_FEISHU_REDIRECT_URI=https://shop-admin.example.com/
NEXT_PUBLIC_DATA_SOURCE=local
NEXT_PUBLIC_FEEDBACK_FORM_URL=https://example.feishu.cn/share/base/form/example
```

- 飞书 `requestAccess` 校验调用页面完整路径，须将根路径配置在同一飞书应用的「安全设置 → 重定向 URL」中（`/shop` 或 `/auth/callback` 不覆盖根路径）。登录验收需在真实飞书客户端或官方 H5 模拟器完成。
- 若新增 staging 环境，需为对应域名单独构建镜像。

### 服务器目录

```text
/data/sast-shop-mobile
/data/sast-shop-desktop
```

现有生产目录为 `root:root`（权限 `0700`），Compose 项目由服务器管理员与发布 helper 维护；仓库 `deploy/compose.*.yml` 仅为基础模板。每个目录需创建 `0600` 权限的 `.env`：

```dotenv
CONNECT_BASE_URL=https://api.example.com
CONNECT_HEALTH_URL=https://api.example.com/health/ready
SESSION_COOKIE_SECRET=replace-with-a-random-value-of-at-least-32-characters
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_REDIRECT_URI=https://shop-admin.example.com/auth/callback
```

- 商品图片由前端同源代理上传至 `CONNECT_BASE_URL` 对应后端的 `/api/uploads/product-image`，无需额外图床配置。
- 当前生产宿主机端口为 mobile `23001`、desktop `23002`，容器内端口仍为 `3001`、`3002`。

### Caddy 示例

生产 Caddy 配置位于服务器 `/etc/caddy/Caddyfile`（不提交到本仓库），证书由 Caddy 自动管理：

```caddyfile
shop.example.com {
	reverse_proxy 127.0.0.1:23001
}

shop-admin.example.com {
	reverse_proxy 127.0.0.1:23002
}
```

更新后重载：

```bash
sudo systemctl reload caddy.service
```

### 回滚

发布失败时由服务器 `deploy-image` 按单服务自动恢复此前运行的镜像并校验就绪状态，GitHub Actions 保留 helper 的非零退出码；人工回滚可通过 `Deploy` 工作流手动指定历史 `sha-<完整 SHA>` 标签。
