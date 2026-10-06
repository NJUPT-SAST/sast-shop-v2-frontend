# Protocol source snapshot

Pocket 协议尚未包含在公开 Buf 模块中，前端从本地协议快照生成客户端。同步已审查的后端协议后，提交 proto 与生成的 TypeScript：

```sh
node scripts/sync-proto.mjs ../backend
pnpm proto:generate
```

先修改后端协议，不手改生成的 TypeScript。CI 会重新生成并检查差异。
