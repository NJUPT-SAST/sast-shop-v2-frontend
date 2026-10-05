# Protocol source snapshot

在前端仓库中，运行：

```sh
node scripts/sync-proto.mjs ../sast-shop-v2
pnpm proto:generate
```

把proto和生成的 TypeScript 一起提交。不用编辑生成的 TypeScript 来添加 RPC 或字段。先更新后端协议。