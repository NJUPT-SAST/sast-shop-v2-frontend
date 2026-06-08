# SAST Shop

SAST Shop 是面向飞书网页应用的在线商城前端 monorepo。当前仓库包含移动端商城、桌面端管理/运营界面、共享 UI/领域/API 包，以及 fauxrpc mock 工具链。

## 目录结构

```text
apps/
  mobile/        移动端商城 Next.js 应用，默认端口 3001
  desktop/       桌面端 Next.js 应用，默认端口 3002
packages/
  api/           前端 API facade，当前连接 package mock
  domain/        领域模型、金额、订单、支付等纯逻辑
  mocks/         本地 fixture 与 mock 数据
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
pnpm mock:schema
pnpm mock:fauxrpc
pnpm mock:generate:user
```

`mock:schema` 会从 `buf.build/sast/sast-shop-v2` 拉取 proto schema 并生成本地 binpb；`mock:fauxrpc` 会在 `127.0.0.1:6660` 启动 fauxrpc mock backend 和 dashboard。

## 环境变量

```bash
NEXT_PUBLIC_DATA_SOURCE=mock
NEXT_PUBLIC_APP_ORIGIN=http://localhost:3001
```

`NEXT_PUBLIC_DATA_SOURCE` 可选值：

- `mock`：使用 package fixtures/mock，是当前已接入的默认方向。
- `local`：预留给本地 ConnectRPC/fauxrpc backend。
- `remote`：预留给真实后端环境。

`NEXT_PUBLIC_APP_ORIGIN` 用于声明当前应用访问源，例如本地开发地址或线上子域名。

## API Wiring

当前 runtime API client 尚未接入 ConnectRPC；项目现在是 `packages/api` facade + `packages/mocks` package mock + fauxrpc mock backend/tooling。

后续接入 Connect Web 时，应使用 Buf 生成的 service definition，并通过 `@connectrpc/connect` 的 `createClient` 与 `@connectrpc/connect-web` 的 `createConnectTransport({ baseUrl })` 创建 web client。

Next App Router 默认使用 Server Components。若 proto message 只在服务端使用，不涉及 client serialization；若要跨 Server Component/Client Component 边界传递，需要注意 JSON/React serializability，必要时使用 `@bufbuild/protobuf` 的 `toJson`/`fromJson` 在边界处转换。

参考：

- [Connect Web getting started](https://connectrpc.com/docs/web/getting-started/)
- [Connect Web SSR](https://connectrpc.com/docs/web/ssr/)

## 部署

移动端和桌面端分别部署到独立子域名，例如：

- `shop.example.com` -> mobile
- `shop-admin.example.com` -> desktop

GitHub Actions 使用 commit short hash 作为 Docker tag，并导出 Docker image tar 上传到服务器；不依赖外部镜像仓库。服务器侧只需要低权限 Linux 用户、服务目录和 `docker-compose.yml`。

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
      NEXT_PUBLIC_DATA_SOURCE: remote
      NEXT_PUBLIC_APP_ORIGIN: https://shop.example.com
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
      NEXT_PUBLIC_DATA_SOURCE: remote
      NEXT_PUBLIC_APP_ORIGIN: https://shop-admin.example.com
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
