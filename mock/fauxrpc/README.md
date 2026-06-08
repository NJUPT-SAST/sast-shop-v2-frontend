# FauxRPC Mock Backend

本目录保存 FauxRPC 的提交版 stub。生成的 protobuf descriptor 放在 `.mock/` 下，不提交到仓库。

## Prerequisites

- `fauxrpc`

## Source

接口来源以远程 Buf module 为准：`buf.build/sast/sast-shop-v2`。

## Run

```bash
pnpm mock:fauxrpc
```

脚本会先生成 `.mock/fauxrpc/sast-shop-v2.binpb`，再启动 FauxRPC：

- 地址：`127.0.0.1:6660`
- 协议：按 FauxRPC 能力提供 gRPC、gRPC-Web 和 Connect
- Dashboard：随 `--dashboard` 启用

当前应用默认仍使用包内 mock 数据。将 `NEXT_PUBLIC_DATA_SOURCE` 设为 `local` 后，Auth/User、Address 和 Payment QR Code runtime API 会通过 `@connectrpc/connect` 的 `createClient` 和 `@connectrpc/connect-web` 的 `createConnectTransport({ baseUrl })` 访问本地 fauxrpc。

当前 `local` 的 `getCurrentUser` 是 smoke path，会读取提交版 stub 中的 `10001` 用户；真实 session-aware 当前用户逻辑留到后端鉴权接入阶段。

mock server URL 放在各 app 的本地配置文件中：

```bash
NEXT_PUBLIC_CONNECT_BASE_URL=http://127.0.0.1:6660
```

仓库提交 `apps/mobile/.env.example` 与 `apps/desktop/.env.example` 作为模板。本地运行时复制为 `.env.local`，生产环境复制为 `.env`；`.env.local` 与 `.env` 都不提交。
