# FauxRPC Mock Backend

本目录保存 FauxRPC 的提交版 stub（`stubs/`）。生成的 protobuf descriptor 位于 `.mock/fauxrpc/sast-shop-v2.binpb`，不提交到仓库。

## Prerequisites

- 本机已安装 `fauxrpc` CLI

## Source

接口使用仓库中的 `proto/` 快照，与前端客户端同源；同步方式见 `proto/README.md`。

## Run

```bash
pnpm mock:fauxrpc
```

相关脚本：

- `pnpm mock:schema`：从本地 `proto/` 快照构建 `.mock/fauxrpc/sast-shop-v2.binpb`
- `pnpm mock:fauxrpc`：先执行 `mock:schema`，再在 `127.0.0.1:6660` 启动 FauxRPC（支持 gRPC、gRPC-Web 和 Connect，并启用 `--dashboard`）
- `pnpm mock:generate:user`：基于 stub 与 schema 生成 `UserInfo` 示例数据

`mock` 和 `local` 数据源均通过 `@connectrpc/connect` 的 `createClient` 与 `@connectrpc/connect-web` 的 `createConnectTransport({ baseUrl })` 访问本地 FauxRPC。运行时 mock 数据统一维护在 `stubs/` 中，不在业务代码或 API facade 手写 fixture。

`AUTH_MODE=off`（本地开发）时，`getCurrentUser` 会读取 `stubs/user.yaml` 中的 `10001` smoke 用户；`AUTH_MODE=required` 时改为读取服务端会话 Cookie 对应的真实登录用户。

本地开发在各 app 的 `.env.local` 中配置（从 `apps/mobile/.env.example` / `apps/desktop/.env.example` 复制，`.env.local` 与 `.env` 均不提交）：

```dotenv
AUTH_MODE=off
NEXT_PUBLIC_CONNECT_BASE_URL=http://127.0.0.1:6660
CONNECT_BASE_URL=http://127.0.0.1:6660
```

## 管理后台演示

`admin.json` 提供明确标记为演示的管理员上下文、六域概览、用户/现货订单列表详情和整单纠错预览。用于本地 `/admin` 布局和代理联调；不包含写操作成功 stub，也不验证真实飞书授权。后台演示建议给 FauxRPC 加 `--only-stubs`，避免为未覆盖的管理写操作生成随机结果。真实后台仍要求有效会话和服务端管理员身份。
