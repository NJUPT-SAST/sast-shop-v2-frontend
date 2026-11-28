# Protocol Source Snapshot

Pocket（`westpocket`）协议尚未包含在公开 Buf 模块中，前端当前通过 `buf.yaml` 与 `buf.gen.yaml` 从仓库本地 `proto/` 快照生成客户端代码。同步已审查的后端协议后，一并提交 `proto/`、`buf.lock` 与生成的 `packages/api/src/gen/`：

```sh
node scripts/sync-proto.mjs ../backend
pnpm proto:generate
```

先修改后端协议，不手改生成的 TypeScript；CI 会重新运行 `pnpm proto:generate` 并检查差异。
