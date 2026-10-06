# FauxRPC Mock Backend

本目录保存 FauxRPC 的提交版 stub。生成的 protobuf descriptor 放在 `.mock/` 下，不提交到仓库。

## Prerequisites

- `fauxrpc`

## Source

接口使用仓库中的 `proto/` 快照，与前端客户端同源；同步方式见 `proto/README.md`。

## Run

```bash
pnpm mock:fauxrpc
```

脚本会先生成 `.mock/fauxrpc/sast-shop-v2.binpb`，再启动 FauxRPC：

- 地址：`127.0.0.1:6660`
- 协议：按 FauxRPC 能力提供 gRPC、gRPC-Web 和 Connect
- Dashboard：随 `--dashboard` 启用

当前 `mock` 和 `local` 数据源都会通过 `@connectrpc/connect` 的 `createClient` 和 `@connectrpc/connect-web` 的 `createConnectTransport({ baseUrl })` 访问本地 fauxrpc。runtime mock 数据只维护在本目录的 stubs 中，不在业务代码或 API facade 中手写 fixture。

当前 `getCurrentUser` 是 smoke path，会读取提交版 stub 中的 `10001` 用户；真实 session-aware 当前用户逻辑留到后端鉴权接入阶段。

mock server URL 放在各 app 的本地配置文件中：

```bash
NEXT_PUBLIC_CONNECT_BASE_URL=http://127.0.0.1:6660
```

仓库提交 `apps/mobile/.env.example` 与 `apps/desktop/.env.example` 作为模板。本地运行时复制为 `.env.local`，生产环境复制为 `.env`；`.env.local` 与 `.env` 都不提交。
