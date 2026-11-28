# 商品图片上传接口契约

> 状态：**已实现**（前后端链路均已落地；后端该接口单元测试待补充）。

商品模板和店铺图片统一经由商城后端 `catalogservice` 上传至腾讯云 COS，前端不再依赖独立图床。

## 调用链路

```text
客户端 (mobile / desktop)
  └─ POST /api/uploads/product-image (同源 Next.js Route Handler)
       └─ POST {origin(CONNECT_BASE_URL)}/api/uploads/product-image (catalogservice)
            └─ 校验 + 重编码去元数据 → COS 写入 → 公开 GET 探活 → 返回 CDN URL
```

- 前端代理：`apps/mobile/app/api/uploads/product-image/route.ts`、`apps/desktop/app/api/uploads/product-image/route.ts` → `server/product-image-upload.ts`、`config/product-image-upload.ts`。
- 后端实现：`catalogservice` 的 `internal/handler/v1/product_image_upload.go`、`internal/service/product_image.go`、`internal/storage/cos_store.go`，以及 `internal/pkg/cos/`、`internal/pkg/redis/upload_limiter.go`、`internal/pkg/redis/upload_quota.go`；本地网关在 `backend/deploy/Caddyfile.local` 将 `/api/uploads/product-image` 转发至 `catalogservice`。

## 后端接口约定

```http
POST {origin(CONNECT_BASE_URL)}/api/uploads/product-image
Authorization: Bearer <session-token>
Content-Type: multipart/form-data
```

表单字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `picture` | File | 是 | 单文件，支持 JPEG、PNG、WebP；文件大小上限 10 MB，整请求上限 12 MB |

成功响应（`200 OK`，响应头包含 `Cache-Control: no-store`、`X-Content-Type-Options: nosniff`）：

```json
{
  "url": "https://<cdn-host>/sast-shop/products/<64-hex>.jpg"
}
```

- 后端返回绝对 `https://` 地址，不含内嵌凭据、query 与 fragment，并经无凭据 `GET` 探活确认返回 `200` 且 `Content-Type` 匹配。
- JPEG 重编码输出为 `.jpg`（quality 85）；PNG 与 WebP 解码后统一重编码为 `.png`。
- 前端代理在生产环境仅接受无内嵌凭据的绝对 `https://` 地址，非生产环境允许 `http://`。

## 错误状态与错误码

后端错误响应统一返回 `{"code": "<ERROR_CODE>"}`；前端代理将上游状态码映射为统一中文 `{"error": "..."}` 提示，不透传后端内部文案（透传 `400/401/403/413/415/429`，其余 `5xx` 或网络异常映射为 `502`）。

| HTTP 状态 | 后端错误码 | 触发场景 |
| --- | --- | --- |
| `400` | `UPLOAD_MULTIPART_INVALID` / `UPLOAD_IMAGE_INVALID` | multipart 非法、空文件、图片损坏或超出 `8192×8192` / `16M` 像素上限 |
| `401` | `UPLOAD_UNAUTHENTICATED` | 未携带有效 Bearer 会话或账号状态非 `active` |
| `403` | `UPLOAD_FORBIDDEN` | 当前用户角色不在允许列表（默认 `user`）；前端代理校验来源失败也返回 `403` |
| `405` | `UPLOAD_METHOD_NOT_ALLOWED` | 非 `POST` 请求 |
| `413` | `UPLOAD_TOO_LARGE` / `UPLOAD_QUOTA_EXCEEDED` | 单图/重编码结果超过 10 MB、请求超过 12 MB，或超出单用户每日 100 MB 配额 |
| `415` | `UPLOAD_UNSUPPORTED_TYPE` | 文件魔数不支持或声明的 MIME 与真实签名不匹配 |
| `429` | `UPLOAD_RATE_LIMITED` | 触发后端用户级限流（默认 20 次/分钟）或前端代理并发上限（单用户 2、全局 8） |
| `503` | `UPLOAD_UNAVAILABLE` / `UPLOAD_STORAGE_FAILED` | COS 未配置、Redis 限流/配额不可用、存储写入失败或公开地址探活失败 |

## 安全与运维约束

- **内容校验与清洗**：前端代理与后端均校验文件签名，拒绝 SVG/HTML 等非目标格式；后端解码重编码以剥离 EXIF 等元数据，并限制宽高（`<= 8192`）与总像素（`<= 16M`）。
- **对象命名与原子清理**：后端使用 `sast-shop/products/<32字节随机hex>.<ext>`，不使用客户端文件名；写入后若配额提交、URL 校验或公开探活失败，自动删除已上传对象。
- **限流、配额与日志**：后端基于 Redis 实现用户级频率限流与每日字节配额；不记录 `Authorization`、图片二进制或 COS 凭据。
- **就绪检查**：`catalogservice` 提供 `GET /health/ready` 检查 COS 存储桶可达性（`HeadBucket`）。
- **测试覆盖**：前端已在 `config/product-image-upload.test.ts` 与 `apps/mobile/lib/product-image-upload.test.ts` 覆盖 URL 校验、签名校验与上传封装；后端 `product_image_upload.go`、`product_image.go`、`upload_limiter.go` 与 `upload_quota.go` 的单元测试仍待补齐。
