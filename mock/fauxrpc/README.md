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

当前应用仍使用包内 mock 数据；后续接入 API client 时，可将本地数据源指向这个 FauxRPC 服务。
