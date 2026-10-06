# SAST Shop

SAST Shop 是面向飞书网页应用的在线商城前端 monorepo。当前仓库包含移动端商城、桌面端管理/运营界面、共享 UI/领域/API 包，以及 fauxrpc mock 工具链。

## 目录结构

```text
apps/
  mobile/        移动端商城 Next.js 应用，默认端口 3001
  desktop/       桌面端 Next.js 应用，默认端口 3002
packages/
  api/           前端 API facade，mock/local 均连接 fauxrpc
  domain/        领域模型、金额、订单、支付等纯逻辑
  ui/            共享 UI 组件与样式
mock/fauxrpc/    fauxrpc stub 与说明
```

根目录只负责 workspace 编排，不再承载 Next.js 应用。

## 本地开发

```bash
pnpm install
pnpm dev:mobile
pnpm dev:desktop
```

常用检查：

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm format
```

fauxrpc 工具：

```bash
pnpm proto:generate
pnpm mock:schema
pnpm mock:fauxrpc
pnpm mock:generate:user
```

运行 fauxrpc mock 需要本机已有 `fauxrpc` CLI。`buf` 与 Protobuf-ES 生成插件已作为 workspace devDependencies 安装。

`proto:generate` 会按 Connect Web 官方推荐的本地生成方式，使用 `@bufbuild/buf` 与 `@bufbuild/protoc-gen-es` 从 `buf.build/sast/sast-shop-v2` 生成 Protobuf-ES v2 TypeScript 产物到 `packages/api/src/gen`。生成物提交到仓库，CI 会重新运行该命令并检查生成物是否漂移。

联调尚未发布的后端 proto 时，可从本地后端仓库生成：`pnpm exec buf generate ../backend --template buf.gen.yaml`。现货与商品模板列表通过 `keyword` 在后端筛选后分页；空关键词列出原列表，商品模板的 `store_id=0` 查询全部店铺。发布时须先将对应后端 proto 同步到 Buf Registry，再运行 `pnpm proto:generate` 核对生成物；否则 CI 使用旧 schema 会检测到漂移。前端搜索依赖同版本的后端服务。

`mock:schema` 会从 `buf.build/sast/sast-shop-v2` 拉取 proto schema 并生成本地 binpb；`mock:fauxrpc` 会在 `127.0.0.1:6660` 启动 fauxrpc mock backend 和 dashboard。

## 交易协议

移动端与桌面端共用 `packages/ui/src/content/transaction-agreement.json`，文案随应用打包，“我的”页面提供全文查看入口。交易提交前未同意时显示协议，等待 5 秒后可确认；查看全文不会记录同意。

同意记录存于当前站点的 localStorage，正式登录模式按用户区分。清除浏览器数据、更换设备或站点后需再次确认。修改重要条款时递增资源文件中的 `version`，已有同意记录将重新确认。这是前端交互记录，后端接口未增加协议字段。

## 环境变量

```bash
NEXT_PUBLIC_DATA_SOURCE=mock
NEXT_PUBLIC_APP_ORIGIN=http://localhost:3001
NEXT_PUBLIC_CONNECT_BASE_URL=http://127.0.0.1:6660
NEXT_PUBLIC_FEEDBACK_FORM_URL=https://example.feishu.cn/share/base/form/example
```

`NEXT_PUBLIC_DATA_SOURCE` 可选值：

- `mock`：使用 ConnectRPC 访问本地 fauxrpc backend，是当前默认开发方向。mock server URL 放在各 app 的 `.env.local` 中，字段为 `NEXT_PUBLIC_CONNECT_BASE_URL`。
- `local`：同样使用 ConnectRPC 访问本地 fauxrpc backend，便于后续与真实本地后端区分配置。
- `remote`：预留给真实后端环境。

`NEXT_PUBLIC_APP_ORIGIN` 用于声明当前应用访问源，例如本地开发地址或线上子域名。

`AUTH_MODE=required` 时，移动端和桌面端会在读取登录会话前检查飞书客户端环境；普通浏览器显示“请在飞书中打开应用”。本地 mock/local 开发可设置 `AUTH_MODE=off`，跳过登录和登录时的飞书环境检查。生产环境强制 `required`。客户端环境识别用于入口提示，服务端仍通过签名会话验证身份。

`NEXT_PUBLIC_FEEDBACK_FORM_URL` 用于配置个人中心“帮助与反馈”入口的飞书问卷地址。仅接受 `feishu.cn` / `larksuite.com` 及其子域下、不含内嵌凭据的 HTTPS URL；留空或配置无效时不展示入口。线上地址在 GitHub 仓库的 Settings → Secrets and variables → Actions → Variables 中配置同名 Repository Variable，由发布流程在镜像构建时注入，修改后需重新构建部署。飞书客户端内通过 [AppLink](https://open.feishu.cn/document/common-capabilities/applink-protocol/supported-protocol/open-the-web-view-in-feishu-to-access-the-specified-url) 打开端内网页（桌面端使用独立窗口），无需额外 JSAPI 签名；普通浏览器直接打开问卷链接。

移动端本地视觉验收可临时设置 `NEXT_PUBLIC_FORCE_FEISHU_UI=true`，以展示飞书移动端专属入口。该开关不会注入或模拟飞书 JSAPI，也不会跳过 `AUTH_MODE=required` 的登录环境检查；实际调用仍要求真实 SDK 环境，生产环境应保持关闭。

`NEXT_PUBLIC_CONNECT_BASE_URL` 只用于本地 `mock` / `local` 开发。生产应用统一通过同源 `/api/connect` 代理访问后端，私有上游地址使用服务端变量 `CONNECT_BASE_URL`，不会进入客户端 bundle。每个 app 都提交 `.env.example` 作为模板，实际使用时复制成目标环境文件：

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
cp apps/desktop/.env.example apps/desktop/.env.local
```

非容器生产环境可复制为 `.env`，并至少配置 `NEXT_PUBLIC_DATA_SOURCE`、`NEXT_PUBLIC_APP_ORIGIN`、`NEXT_PUBLIC_FEISHU_APP_ID`、私有 `SESSION_COOKIE_SECRET`、`CONNECT_BASE_URL` 和 `CONNECT_HEALTH_URL`；桌面端的服务端授权接口使用 `FEISHU_APP_ID` 与 `FEISHU_REDIRECT_URI`：

```bash
cp apps/mobile/.env.example apps/mobile/.env
cp apps/desktop/.env.example apps/desktop/.env
```

`.env.local` 与 `.env` 不提交。本地 fauxrpc URL 写在 `.env.local` 的 `NEXT_PUBLIC_CONNECT_BASE_URL` 与 `CONNECT_BASE_URL` 中；生产 `CONNECT_BASE_URL` 必须是无内嵌凭据的 HTTPS URL。`SESSION_COOKIE_SECRET` 是至少 32 字符的服务端随机密钥，用于签署 OAuth 返回的用户会话缓存，移动端和桌面端应分别配置且不得进入 `NEXT_PUBLIC_*`。桌面端 `FEISHU_REDIRECT_URI` 必须指向同源 `/auth/callback`，例如 `https://shop-admin.example.com/auth/callback`。`CONNECT_HEALTH_URL` 必须指向后端独立、无鉴权且返回 2xx 的 HTTPS 就绪检查端点，不能把业务 ConnectRPC 路由当作健康检查。

Next.js 会把 `NEXT_PUBLIC_*` 变量内联到静态渲染和客户端 bundle 中，部署镜像构建时必须提供目标环境的公开值。`CONNECT_BASE_URL` 只在容器启动时由 docker-compose 注入，不能作为 Docker build arg。

## API Wiring

当前 runtime API client 通过 `packages/api` facade 调用 Protobuf-ES 生成物，并用 fauxrpc mock backend/tooling 提供本地数据。

Connect Web 使用 Buf 生成的 service definition，并通过 `@connectrpc/connect` 的 `createClient` 与 `@connectrpc/connect-web` 的 `createConnectTransport({ baseUrl })` 创建 web client。本地 `mock` 与 `local` 访问 `NEXT_PUBLIC_CONNECT_BASE_URL` 指向的 fauxrpc/local Connect 服务；生产浏览器只访问同源代理，由代理读取私有 `CONNECT_BASE_URL`。`remote` facade 尚未实现，部署工作流会明确拒绝该值。生产当前用户来自 OAuth `LoginResponse.member`，并与后端 session token 一起由 `SESSION_COOKIE_SECRET` 签署后保存在 HttpOnly Cookie；本地关闭鉴权时才使用 fauxrpc 的 `10001` smoke 用户。

Next App Router 默认使用 Server Components。若 proto message 只在服务端使用，不涉及 client serialization；若要跨 Server Component/Client Component 边界传递，需要注意 JSON/React serializability，必要时使用 `@bufbuild/protobuf` 的 `toJson`/`fromJson` 在边界处转换。

参考：

- [Connect Web getting started](https://connectrpc.com/docs/web/getting-started/)
- [Connect Web SSR](https://connectrpc.com/docs/web/ssr/)

## 部署

移动端和桌面端分别部署到独立子域名，例如：

- `shop.example.com` -> mobile
- `shop-admin.example.com` -> desktop

交付链路分为三个阶段：

1. `CI` 在 PR、合并队列与 `main` push 上执行 Proto drift、依赖审计、Lint、类型检查、测试、构建和两套容器冒烟测试。
2. `Publish Images` 只消费通过 CI 的 `main` commit，使用生产域名向 GHCR 发布 mobile/desktop 的 `linux/amd64` 镜像、SBOM 和 provenance，与当前 AMD64 服务器架构一致。不可变标签格式为 `sha-<完整提交 SHA>`。
3. `main` 每次 push 通过 CI 且两端镜像均发布成功后，`Publish Images` 自动调用 `Deploy`，使用同一次 CI 提交的 `sha-<完整提交 SHA>` 镜像依次部署 mobile、desktop。部署固定使用 `production` Environment，通过服务器受限 helper 完成发布。CI 或镜像发布失败时不部署。

`Deploy` 保留从 `main` 手动运行的入口。默认 `diagnostic` 模式只检查服务器状态；手动发布或回滚时选择 `mode=deploy`、目标服务和已发布的 `sha-<完整提交 SHA>` 镜像标签。手动运行 `Publish Images` 只发布镜像，不自动部署。

自动部署在连接服务器前核对当前 `main` 提交；若已被后续 push 取代则跳过，避免旧流水线较晚完成时覆盖新版本。手动回滚仍可部署历史镜像。

镜像地址：

```text
ghcr.io/njupt-sast/sast-shop-v2-frontend-mobile
ghcr.io/njupt-sast/sast-shop-v2-frontend-desktop
```

### GitHub Secrets

在 `production` GitHub Environment 中配置以下 Secrets：

```text
SERVER_HOST
SERVER_SSH_FINGERPRINT
SERVER_USER
SSH_PRIVATE_KEY
GHCR_USERNAME
GHCR_READ_TOKEN
```

两端统一使用 `SERVER_USER` / `SSH_PRIVATE_KEY`。部署使用 OpenSSH，固定协商 ED25519 主机密钥；扫描公钥并与 `SERVER_SSH_FINGERPRINT` 严格比对后才连接。该指纹必须来自可信服务器控制台，可执行 `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256` 获取其中的 `SHA256:...` 值，不能通过关闭校验解决不匹配。部署私钥仍可使用服务器支持的其他类型，与主机密钥类型无关。

首次核查先运行 `mode=diagnostic`，不需要镜像标签。诊断不传递镜像仓库凭据，不读取 `.env` 或完整容器配置，不执行发布 helper 或更新容器；部分检查因权限不足失败时会保留错误供排查。

`GHCR_USERNAME` / `GHCR_READ_TOKEN` 可选。未配置 token 时，Deploy 使用当前运行的 `github.actor` 和具有 `packages: read` 权限的 `GITHUB_TOKEN` 拉取本仓库镜像，镜像 package 需允许本仓库的 Actions 访问；配置自定义 token 时必须同时配置其所属用户名，token 只需读取 package 的权限。凭据仅通过 SSH 标准输入传入 helper，JSON 包含 `registry`、`username`、`password` 三个字段，最多 16 KiB，字段必须为非空且不含换行或 NUL 的字符串。

服务器允许部署账号免密执行 `/usr/local/lib/sast-shop/deploy-image`。工作流调用 `sudo -n /usr/local/lib/sast-shop/deploy-image TARGET REVISION IMAGE_REF --registry-stdin`，其中 `TARGET` 为 `mobile` 或 `desktop`，`REVISION` 为完整 40 位 SHA；服务器入口负责仓库白名单、镜像版本校验、部署锁、容器更新及失败恢复。部署账号通过该入口操作，保持现有目录和 Docker socket 权限。

仓库级 Secret `NEXT_PUBLIC_FEISHU_APP_ID` 在镜像发布阶段注入双端公开应用 ID。修改后必须重新构建部署新镜像，可通过下一次 `main` push 自动完成；运行时修改服务器 `.env` 不会替换客户端 bundle 中的值。该 ID 必须与后端飞书应用配置及 `GetJSAPIAuthConfig` 返回的 `appId` 一致；应用密钥只配置在后端。桌面端服务器 `.env` 的 `FEISHU_APP_ID` 也使用同一应用 ID，`FEISHU_REDIRECT_URI` 使用对应域名的回调地址。

飞书 `requestAccess` 调用所在页面的完整路径须配置在同一应用的「安全设置 → 重定向 URL」中，`/shop` 或 `/auth/callback` 不覆盖域名根路径。部署验收应使用真实飞书客户端或官方 H5 模拟器，分别确认授权码获取、后端换码、会话 Cookie 写入和读取；来源校验或 mock 换码通过不能代替真实登录验收。

双端 JSAPI 登录入口使用 `NEXT_PUBLIC_FEISHU_REDIRECT_URI`，必须是与 `NEXT_PUBLIC_APP_ORIGIN` 同源的根地址。没有有效会话时，前端先进入该地址再发起授权，成功后返回原页面；`AUTH_MODE=off` 跳过此流程。`requestAccess` 没有 `redirect_uri` 参数，它校验调用页面地址；这项公开配置与桌面端独立 OAuth 回调的 `FEISHU_REDIRECT_URI` 不同，后者仍指向 `/auth/callback`。

仓库还需要配置以下 Repository Variables，用于 Docker build 阶段注入公开配置：

```text
MOBILE_APP_ORIGIN=https://shop.example.com
DESKTOP_APP_ORIGIN=https://shop-admin.example.com
MOBILE_FEISHU_REDIRECT_URI=https://shop.example.com/
DESKTOP_FEISHU_REDIRECT_URI=https://shop-admin.example.com/
NEXT_PUBLIC_DATA_SOURCE=local
NEXT_PUBLIC_FEEDBACK_FORM_URL=https://example.feishu.cn/share/base/form/example
```

应用域名和数据源使用 Repository Variables，当前产物只面向 production；若增加 staging，必须为 staging 域名单独构建镜像，不能在运行时替换 `NEXT_PUBLIC_*`。`NEXT_PUBLIC_FEISHU_APP_ID` 虽会进入客户端 bundle，但当前沿用仓库已有的同名 Secret，避免在迁移时暴露或重填现有值。`NEXT_PUBLIC_DATA_SOURCE` 必须显式配置为 `mock` 或 `local`；在 `remote` facade 真正接通前，CI/CD 会拒绝构建 `remote` 镜像。私有服务端配置不进入 Repository Variables，而是在服务器对应 `.env` 中注入。两个应用域名未配置时，`Publish Images` 会安全跳过发布任务。

### 服务器目录

```text
/data/sast-shop-mobile
/data/sast-shop-desktop
```

现有生产目录为 `root:root`、权限 `0700`，Compose 项目由服务器管理员和发布 helper 维护。仓库 `deploy/compose.*.yml` 仅为基础模板，初始化新环境时需按实际端口及资源限制调整。

每个目录创建权限为 `0600` 的 `.env`：

```dotenv
CONNECT_BASE_URL=https://api.example.com
CONNECT_HEALTH_URL=https://api.example.com/health/ready
SESSION_COOKIE_SECRET=replace-with-a-random-value-of-at-least-32-characters
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_REDIRECT_URI=https://shop-admin.example.com/auth/callback
```

商品图片由前端同源代理上传到 `CONNECT_BASE_URL` 对应后端的 `/api/uploads/product-image`，不需要额外图床地址或图床令牌。

当前生产宿主机端口为 mobile `23001`、desktop `23002`，容器内部端口仍为 `3001`、`3002`。应用就绪检查和容器切换由服务器 helper 根据实际 Compose 配置执行。

### Caddy 示例

生产 Caddy 配置不在本仓库提交。实际文件位于服务器 `/etc/caddy/Caddyfile`，证书由 Caddy 自动管理。示例：

```caddyfile
shop.example.com {
	reverse_proxy 127.0.0.1:23001
}

shop-admin.example.com {
	reverse_proxy 127.0.0.1:23002
}
```

更新后在服务器执行：

```bash
sudo systemctl reload caddy.service
```

### 回滚

失败恢复由服务器 `deploy-image` 入口处理，按单服务恢复之前实际运行的镜像并检查就绪状态。GitHub Actions 保留 helper 的非零退出码，将失败作为发布失败报告；排查及人工恢复依据服务器发布记录进行。
