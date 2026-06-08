# SAST Shop ConnectRPC Data Layer Design

## Summary

下一阶段目标是做 Schema-first 数据接入基建：提交全量 Buf/Protobuf-ES v2 生成链路和生成物，但 runtime 只打通 `AuthService/Login` 与 `UserService/GetUserInfo` 的 `local` fauxrpc 闭环。

成功标准：`mock` 行为不退化，`local` 能通过 ConnectRPC 读取 fauxrpc，`remote` 继续明确标记为未接入。

## Key Changes

- 新增 `buf.gen.yaml`，从 `buf.build/sast/sast-shop-v2` 全量生成 TypeScript 到 `packages/api/src/gen`，生成物提交入库。
- 使用 Connect ES v2 官方本地生成方向：依赖 `@bufbuild/buf`、`@bufbuild/protoc-gen-es`、`@bufbuild/protobuf`、`@connectrpc/connect`、`@connectrpc/connect-web`；不引入过时的 `protoc-gen-connect-es`。
- 新增 `proto:generate` 脚本；保留现有 `mock:schema`、`mock:fauxrpc`。
- `ServiceOptions` 扩展 `connectBaseUrl?: string`；mock server URL 放在各 app 的本地 `.env.local` 中，通过 `NEXT_PUBLIC_CONNECT_BASE_URL` 读取。
- `CurrentUser` facade 对齐后端 userInfo，只保留 `id/name/avatarUrl`；移除 `department`。
- `mock` 仍走 `packages/mocks`；`local` 走 ConnectRPC；`remote` 继续抛 `FeatureUnavailableError`。
- mobile/desktop 仍只调用 `@sast-shop/api` facade，不直接 import proto 生成文件。

## Data Flow

- `getCurrentUser({ dataSource: "local" })` 创建 Connect client，调用 `UserService/GetUserInfo`，再映射为普通前端对象。
- `loginWithLarkCode(code, { dataSource: "local" })` 调用 `AuthService/Login`，返回现有 `AuthSession` facade。
- `local` 的 `getCurrentUser` 是 smoke path，读取 fauxrpc stub 中的 `10001` 用户；真实 session-aware 当前用户逻辑留到后端鉴权接入阶段。
- Server Component 直接 await facade 返回值；proto message 不跨 Server/Client 边界。
- 未来若 Client Component 需要 proto 数据，再用 `toJson/fromJson` 显式处理序列化边界。

## Test Plan

- 更新 auth tests：覆盖 `mock`、`local` mapper、`local` 错误转换、`remote` 未接入。
- local 单元测试不依赖 fauxrpc 常驻，使用 mock fetch。
- CI 增加 codegen drift check：安装依赖后运行 `pnpm proto:generate`，再检查工作区无 diff。
- 实现验证至少跑：`pnpm proto:generate`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。
- 手动验收：启动 `pnpm mock:fauxrpc`，用 `NEXT_PUBLIC_DATA_SOURCE=local` 分别检查 mobile/desktop 首页能显示 fauxrpc 用户。

## Assumptions

- `buf` 和 `protoc-gen-es` 按 Connect Web 官方推荐作为 devDependencies；`fauxrpc` 仍是外部 CLI。
- fauxrpc 当前只有 Auth/User stub，所以 runtime 本轮不接商品、订单、购物车。
- README 与 `mock/fauxrpc/README.md` 同步说明 `mock/local/remote` 边界。
- 每个 app 提交 `.env.example` 作为模板；本地运行复制为 `.env.local`，生产环境复制为 `.env`；`.env` 与 `.env.local` 不提交。
