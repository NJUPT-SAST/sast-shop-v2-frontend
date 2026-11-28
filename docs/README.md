# 前端文档索引

本目录维护 SAST 商城前端仓库的接口契约与工程规范文档。产品总需求与数据库设计见根目录 [AGENTS.md](../AGENTS.md) 中的飞书文档链接，日常开发与验证命令见 [README.md](../README.md)。

## 文档列表

| 文档 | 分类 | 状态 | 何时阅读 | 说明 |
| --- | --- | --- | --- | --- |
| [contracts/product-image-upload.md](contracts/product-image-upload.md) | 接口契约 | 已实现 | 修改商品/店铺图片上传代理、校验逻辑或联调后端上传接口时 | 前端同源代理与后端 `catalogservice` 图片上传接口约定、错误码及安全约束 |
| [guides/mobile-feedback-states.md](guides/mobile-feedback-states.md) | 交互规范 | 生效中 | 新增或修改移动端列表、详情、Drawer 的空状态、加载失败或错误边界时 | 移动端 `Empty`、`LoadFailure`、路由错误边界、`InfiniteListStatus` 与局部失败提示规范 |

## 目录约定

- `contracts/`：前后端跨仓库 HTTP/非 Proto 接口契约与实现状态（ConnectRPC 接口以 `packages/api/src/gen` 与 Buf schema 为准）。
- `guides/`：持续生效的前端工程、交互与可访问性规范。
- 一次性任务拆解清单与已被代码库替代的早期阶段方案不长期留存在 `docs/` 中，避免误导后续开发与自动化代理。
