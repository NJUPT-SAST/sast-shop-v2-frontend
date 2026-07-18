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

`mock:schema` 会从 `buf.build/sast/sast-shop-v2` 拉取 proto schema 并生成本地 binpb；`mock:fauxrpc` 会在 `127.0.0.1:6660` 启动 fauxrpc mock backend 和 dashboard。

## 环境变量

```bash
NEXT_PUBLIC_DATA_SOURCE=mock
NEXT_PUBLIC_APP_ORIGIN=http://localhost:3001
NEXT_PUBLIC_CONNECT_BASE_URL=http://127.0.0.1:6660
```

`NEXT_PUBLIC_DATA_SOURCE` 可选值：

- `mock`：使用 ConnectRPC 访问本地 fauxrpc backend，是当前默认开发方向。mock server URL 放在各 app 的 `.env.local` 中，字段为 `NEXT_PUBLIC_CONNECT_BASE_URL`。
- `local`：同样使用 ConnectRPC 访问本地 fauxrpc backend，便于后续与真实本地后端区分配置。
- `remote`：预留给真实后端环境。

`NEXT_PUBLIC_APP_ORIGIN` 用于声明当前应用访问源，例如本地开发地址或线上子域名。

移动端本地视觉验收可临时设置 `NEXT_PUBLIC_FORCE_FEISHU_UI=true`，以展示飞书移动端专属入口。该开关不会注入或模拟飞书 JSAPI，实际调用仍要求真实 SDK 环境；生产环境应保持关闭。

`NEXT_PUBLIC_CONNECT_BASE_URL` 只用于本地 `mock` / `local` 开发。生产应用统一通过同源 `/api/connect` 代理访问后端，私有上游地址使用服务端变量 `CONNECT_BASE_URL`，不会进入客户端 bundle。每个 app 都提交 `.env.example` 作为模板，实际使用时复制成目标环境文件：

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
cp apps/desktop/.env.example apps/desktop/.env.local
```

非容器生产环境可复制为 `.env`，并至少配置 `NEXT_PUBLIC_DATA_SOURCE`、`NEXT_PUBLIC_APP_ORIGIN`、`NEXT_PUBLIC_FEISHU_APP_ID` 和私有 `CONNECT_BASE_URL`：

```bash
cp apps/mobile/.env.example apps/mobile/.env
cp apps/desktop/.env.example apps/desktop/.env
```

`.env.local` 与 `.env` 不提交。本地 fauxrpc URL 写在 `.env.local` 的 `NEXT_PUBLIC_CONNECT_BASE_URL` 与 `CONNECT_BASE_URL` 中；生产 `CONNECT_BASE_URL` 必须是无内嵌凭据的 HTTPS URL。

Next.js 会把 `NEXT_PUBLIC_*` 变量内联到静态渲染和客户端 bundle 中，部署镜像构建时必须提供目标环境的公开值。`CONNECT_BASE_URL` 只在容器启动时由 docker-compose 注入，不能作为 Docker build arg。

## API Wiring

当前 runtime API client 通过 `packages/api` facade 调用 Protobuf-ES 生成物，并用 fauxrpc mock backend/tooling 提供本地数据。

Connect Web 使用 Buf 生成的 service definition，并通过 `@connectrpc/connect` 的 `createClient` 与 `@connectrpc/connect-web` 的 `createConnectTransport({ baseUrl })` 创建 web client。本地 `mock` 与 `local` 访问 `NEXT_PUBLIC_CONNECT_BASE_URL` 指向的 fauxrpc/local Connect 服务；生产浏览器只访问同源代理，由代理读取私有 `CONNECT_BASE_URL`。`remote` facade 尚未实现，部署工作流会明确拒绝该值。`getCurrentUser` 当前仍是 smoke path，会读取 fauxrpc stub 中的 `10001` 用户；真实 session-aware 当前用户逻辑需要后端提供对应接口后接入。

Next App Router 默认使用 Server Components。若 proto message 只在服务端使用，不涉及 client serialization；若要跨 Server Component/Client Component 边界传递，需要注意 JSON/React serializability，必要时使用 `@bufbuild/protobuf` 的 `toJson`/`fromJson` 在边界处转换。

参考：

- [Connect Web getting started](https://connectrpc.com/docs/web/getting-started/)
- [Connect Web SSR](https://connectrpc.com/docs/web/ssr/)

## 部署

移动端和桌面端分别部署到独立子域名，例如：

- `shop.example.com` -> mobile
- `shop-admin.example.com` -> desktop

GitHub Actions 使用 commit short hash 作为 Docker tag，并导出 Docker image tar 上传到服务器；不依赖外部镜像仓库。服务器侧只需要低权限 Linux 用户、服务目录和 `docker-compose.yml`。

自动部署由 `CI` workflow 成功完成后触发；手动部署可通过 `workflow_dispatch` 触发。

### GitHub Secrets

仓库需要配置以下 Secrets：

```text
SERVER_HOST
MOBILE_SERVER_USER
MOBILE_SSH_PRIVATE_KEY
DESKTOP_SERVER_USER
DESKTOP_SSH_PRIVATE_KEY
```

推荐为 mobile 和 desktop 分别创建低权限 Linux 用户，只允许操作对应服务目录。

仓库还需要配置以下 Repository Variables，用于 Docker build 阶段注入公开配置：

```text
MOBILE_APP_ORIGIN=https://shop.example.com
DESKTOP_APP_ORIGIN=https://shop-admin.example.com
NEXT_PUBLIC_DATA_SOURCE=local
NEXT_PUBLIC_FEISHU_APP_ID=cli_xxx
```

`NEXT_PUBLIC_DATA_SOURCE` 必须显式配置为 `mock` 或 `local`；在 `remote` facade 真正接通前，CI/CD 会拒绝构建 `remote` 镜像。私有 `CONNECT_BASE_URL` 不配置为 Repository Variable，而是在服务器对应 compose 环境中注入。

### 服务器目录

```text
/data/sast-shop-mobile
/data/sast-shop-desktop
```

### docker-compose.yml 示例

`/data/sast-shop-mobile/docker-compose.yml`：

```yaml
services:
  web:
    image: sast/sast-shop-mobile:current
    restart: unless-stopped
    environment:
      AUTH_MODE: required
      CONNECT_BASE_URL: https://api.example.com
      PORT: 3001
    ports:
      - "127.0.0.1:3001:3001"
```

`/data/sast-shop-desktop/docker-compose.yml`：

```yaml
services:
  web:
    image: sast/sast-shop-desktop:current
    restart: unless-stopped
    environment:
      AUTH_MODE: required
      CONNECT_BASE_URL: https://api.example.com
      PORT: 3002
    ports:
      - "127.0.0.1:3002:3002"
```

### Caddy 示例

生产 Caddy 配置不在本仓库提交。实际文件位于服务器 `/etc/caddy/Caddyfile`，证书由 Caddy 自动管理。示例：

```caddyfile
shop.example.com {
	reverse_proxy 127.0.0.1:3001
}

shop-admin.example.com {
	reverse_proxy 127.0.0.1:3002
}
```

更新后在服务器执行：

```bash
sudo systemctl reload caddy.service
```

### 回滚

部署 workflow 会在加载新镜像前把 `current` 旋转为 `backup`。需要回滚时，在对应服务器目录执行：

```bash
docker image tag sast/sast-shop-mobile:backup sast/sast-shop-mobile:current
docker compose up -d --remove-orphans
```

桌面端：

```bash
docker image tag sast/sast-shop-desktop:backup sast/sast-shop-desktop:current
docker compose up -d --remove-orphans
```
