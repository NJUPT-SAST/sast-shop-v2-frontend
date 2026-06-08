# FauxRPC Mock Backend

本目录保存 FauxRPC 的提交版 stub。生成的 protobuf descriptor 放在 `.mock/` 下，不提交到仓库。

## Prerequisites

- `buf`
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

当前应用仍使用包内 mock 数据，尚未接入 runtime API client。后续按 ConnectRPC 官方方式生成 service 定义后，可用 `@connectrpc/connect` 的 `createClient` 和 `@connectrpc/connect-web` 的 `createConnectTransport({ baseUrl })`，将本地 `baseUrl` 指向 `http://127.0.0.1:6660`。
