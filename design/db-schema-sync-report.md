# 数据库表结构同步对照报告

> **源文档**：`MXwJwU25KiLZdUkjvsLcJuuVnsc` — 表结构（第一阶段）
> **目标文档**：`TiI3w5XFliQvkfk3SXkcUnhFnBc` — SAST Shop 数据库表结构文档
> **生成时间**：2026-05-11
> **同步范围**：仅源文档"第一阶段"（9 张表 + 索引 + 每张表后的"修改意见"sheet + 28 条评论）

---

## 一、表级映射关系

| 源（第一阶段） | 目标（SAST Shop v1） | 映射性质 |
|---|---|---|
| `user` 用户表 | `3.1 users` | 1:1 直接对应 |
| `payment_qr_code` 收款二维码表 | `3.2 merchant_accounts` + `3.3 listings.qr_code_url/shipping_qr_url` | 拆分：子商户账号独立表，QR 码作为 listing 字段 |
| `product` 商品表 | `3.3 listings` | 1:1 直接对应 |
| `product_image` 商品图片表 | `3.3 listings.image_urls TEXT[]` | 合并为数组字段 |
| `shipping_address` 收货地址表 | `3.7 orders.shipping_address TEXT` | 退化为快照，**无独立地址簿** |
| `order` 订单主表 | `3.7 orders` | 1:1 直接对应 |
| `order_item` 订单明细表 | （无） | 简化为单 item 订单（`orders.listing_id` + `quantity`） |
| `payment_record` 支付记录表 | `3.8 payment_codes` + `3.7 orders.payment_trade_no` | 拆分：4 位备注码独立表，子商户 trade_no 在 orders |
| `order_shipment` 物流表 | `3.7 orders.carrier/tracking_number/shipping_status` | 合并为 orders 字段 |
| 索引 | 各表内联 | 已分散到各表 |

**目标额外设计**（源中无）：`listing_variants`、`listing_designs`、`votes`、`review_requests`、`order_timeline`、`refund_jobs`、`webhook_events`、`audit_logs`、`admin_cache_snapshots`。

---

## 二、源「修改意见 Sheet + 划词评论」逐字段对照

> 状态码：✅ 已采纳　⚠️ 部分覆盖/需拍板　➕ 目标缺失　❌ 设计冲突

### 2.1 user → users

| 源字段（含 sheet 修订） | 目标字段 | 状态 | 说明 |
|---|---|---|---|
| `id BIGINT` | `id UUID` | ⚠️ | 主键类型分歧（BIGINT vs UUID）。目标的"通用约定"统一了 UUID。**待你拍板：保留 UUID 还是改回 BIGINT** |
| `feishu_open_id` | `feishu_user_id` | ✅ | 字段名变化但语义一致（飞书 OpenID） |
| `role enum {user, admin}` | （无） | ⚠️ | 目标特意说明"管理员名单不在 users 表，按 PRD 来源是飞书 Bitable 缓存"——这是设计选择，**需确认你接受** |
| `name` | `name` | ✅ | |
| `en_name` | （无） | ➕ | 双语姓名缺失，前端切换语言无法显示英文名 |
| `avatar_url` | `avatar_url` | ✅ | |
| `department` | `department` | ✅ | |
| （无 email） | `email VARCHAR(255)` | — | 目标新增邮箱字段 |
| `created_at` / `updated_at` | 同名 | ✅ | 类型 `TIMESTAMPTZ` vs `TIMESTAMP`（目标更严） |

### 2.2 payment_qr_code → merchant_accounts + listings 字段

源里 sheet 已经把 `payment_qr_code` 改名为 `payment_qr_codes`，并加了 `owner_id`、`usage_type ('product'/'freight'/'general')`、`amount_hint`、`is_active`。

| 源字段（含 sheet 修订 + 评论） | 目标对应 | 状态 | 说明 |
|---|---|---|---|
| `id` | `merchant_accounts.id` | ✅ | |
| `owner_id → users(id)` | `merchant_accounts.user_id` | ✅ | |
| `channel ('wechat'/'alipay')` | `merchant_accounts.wechat_sub_mchid` + `alipay_pid` | ✅ | **评论"拆成 wechat_id + alipay_id"已采纳** |
| `usage_type ('product'/'freight'/'general')` | 拆为 `listings.qr_code_url`（商品款）+ `shipping_qr_url`（运费） | ⚠️ | **`general` 类型未保留**——AI 评论 A6 也指出这是限制，目标用结构差异规避 |
| `qr_image_url VARCHAR(512)` | `listings.qr_code_url TEXT` | ✅ | **评论"改成 content TEXT"已采纳** |
| `amount_hint NUMERIC(10,2)` | （无） | ➕ | 金额提示字段缺失 |
| `is_active BOOLEAN` | `merchant_accounts.status enum('pending','active','suspended')` | ✅ | 用 status 替代，更细 |
| `type enum {商品,邮费}` | `payment_code_purpose_t = ('item','shipping')` | ✅ | **评论"起个更好的名字"已采纳** |

### 2.3 product → listings

| 源字段（含 sheet 修订 + 评论） | 目标字段 | 状态 | 说明 |
|---|---|---|---|
| `seller_id` | `seller_id` | ✅ | |
| `type ('second_hand'/'official_direct'/'crowdfunding_winner')` | `type listing_type_t` + `cf_mode` + `origin` | ✅ | 目标拆得更细（多了 `crowdfund.presale`/`vote_first`） |
| `title VARCHAR(128)` | `title VARCHAR(200)` | ⚠️ | 目标放宽到 200 |
| `description TEXT` | `description TEXT` | ✅ | |
| `price NUMERIC(10,2)` | `price NUMERIC(10,2)` | ❌ | **评论"改成 INTEGER 单位为分"未采纳**——浮点精度坑（`0.1+0.2`），强烈建议改 INTEGER。**待你拍板** |
| `stock` | `stock` | ✅ | |
| `status` 加 `removed`（PRD 3.2 强制下架） | `listing_status_t` 用 `closed` | ⚠️ | **目标把"主动下架/未达标/强制下架"统一到 `closed`，无 `removed` 状态**——管理员强制下架与卖家主动下架在审计上无法区分 |
| `status='removed'` 改假删字段 | （无 `deleted_at` / `is_deleted`） | ❌ | **设计分歧**：源建议软删，目标用状态机（status='closed'）。软删的好处是历史订单仍能 join 出商品；状态机的好处是状态机闭环 |
| 多处 `VARCHAR(32)` 改 enum | 全部用 `*_t` enum 类型 | ✅ | **评论"改 enum"全部采纳** |
| `delivery_method` enum | `delivery_mode delivery_mode_t` | ✅ | |
| `freight_mode` 改两个 boolean（是否快递、是否自提） | `delivery_mode enum('express','pickup','none')` + `shipping_mode enum('free','fixed','variable')` | ⚠️ | **目标用 enum 替代 boolean**——表达力等价但更显式（none 即虚拟商品）。**评论的"双 boolean"建议未采纳** |
| `fixed_freight_amount` | `shipping_fee` | ✅ | |
| 加品类表 1:n | （无品类表） | ➕ | **评论建议加 `categories` 表 + `listings.category_id`**——目标完全缺失 |
| `product_payment_qr_id` 拆 wechat_id + alipay_id | `merchant_accounts.wechat_sub_mchid` + `alipay_pid`（子商户）/ `listings.qr_code_url`（收款码） | ✅ | 已通过 payment_mode 分支拆开 |
| `source_project_id` / `source_option_id` | `listings.origin = 'vote_winner'` | ⚠️ | **只保留"是投票胜出"标志，丢失了具体源 ID**——无法溯源到具体哪个投票/方案 |
| `published_at` | （无） | ➕ | 用 `created_at + status` 推断；如果允许"先创建后上架"，需要单独的上架时间 |
| `created_at` / `updated_at` | 同名 | ✅ | |

### 2.4 product_image → listings.image_urls

| 源字段 | 目标 | 状态 | 说明 |
|---|---|---|---|
| 独立表 + `id` + `product_id` 外键 + `image_url` + `sort_order` | `listings.image_urls TEXT[]` | ⚠️ | 数组无独立 id 也无 sort_order，**但数组天然有顺序**。**牺牲点**：图片复用、单图删除、单图替换会变成"重写整个数组"。MVP 可接受 |

### 2.5 shipping_address → orders.shipping_address（快照）

| 源字段 | 目标 | 状态 | 说明 |
|---|---|---|---|
| 独立地址簿 + `is_default` + 省/市/区/详细地址 | `orders.shipping_address TEXT`（下单时复制粘贴一段地址） | ❌ | **设计分歧大**：目标完全删除地址管理，每次下单都要重输。**待你确认是否接受** |

### 2.6 order → orders

| 源字段（含 sheet 修订 + 评论） | 目标字段 | 状态 | 说明 |
|---|---|---|---|
| `order_no VARCHAR(64) UNIQUE`（对外编号） | （无，只有 UUID id） | ➕ | **缺对外友好编号**（如 `SAST-20260511-XXXX`），客服沟通/物流回查不方便 |
| `buyer_id` (sheet 已改名) | `buyer_id` | ✅ | （源 SQL 是 `purchaser_id`，sheet 改成 `buyer_id`，目标已采纳 sheet 版） |
| `seller_id` | `seller_id` | ✅ | |
| `order_type` ('second_hand'/'official_direct'/'crowdfunding_winner'/'presale') | （无，从 `listings.type/cf_mode` 推） | ⚠️ | 通过 listing 关联表达，**但不冗余存订单类型**意味着 listing 改类型会影响历史订单展示 |
| `status` 改 `closed → completed` | `order_status_t` 同时有 `completed`（已收货）+ `closed`（取消） | ✅ | **评论"closed 改 completed"已采纳**，且拆得更细 |
| `product_amount` | `amount` | ✅ | 字段名差异 |
| `freight_mode` 同 product | `shipping_fee NUMERIC` + `shipping_status shipping_status_t` | ⚠️ | 表达方式不同（目标无 freight_mode 字段，只用 shipping_fee 是否为空和 shipping_status 表达） |
| `actual_freight_amount` | （只有 `shipping_fee` 一个字段） | ⚠️ | **不固定运费的"卖家计算后实际金额"和"原始报价"目标只用一个字段**——计算前后无法对比 |
| `freight_status` ('none'/'included'/'pending_quote'/'waiting_payment'/'paid') | `shipping_status enum('pending','awaiting_confirm','awaiting_payment','paid')` | ✅ | 状态值名字不同但语义对齐 |
| `total_amount` | （无，需 `amount + shipping_fee` 计算） | ⚠️ | 目标不冗余存总额 |
| `delivery_method` | `listings.delivery_mode`（**不在 orders 上**） | ⚠️ | 目标只在 listing 上存，**订单不存快照**——若 listing 改了配送方式，历史订单展示会错 |
| `receiver_name` / `receiver_phone` / `receiver_address` 三字段快照 | `shipping_address TEXT`（一段文本） | ⚠️ | 目标合并成一段文本，无法结构化查询/校验 |
| `purchaser_remark` / `seller_remark` | `remark TEXT`（只一个） | ⚠️ | **买卖双方备注合并**，无法区分谁写的 |
| `paid_at` / `shipped_at` / `received_at` / `closed_at` | `paid_at` / `shipped_at` / `completed_at`（无 `closed_at`） | ⚠️ | 取消/关闭时间未保留 |

### 2.7 order_item → 简化掉

| 源字段（含评论） | 目标 | 状态 | 说明 |
|---|---|---|---|
| 独立表，多 item 订单 | 单 item 订单（`orders.listing_id` + `quantity`） | ❌ | **设计分歧**：源支持购物车多商品下单，目标一个订单只能一个 listing |
| `product_id` 取消 NOT NULL（评论：预售订单允许只关联众筹项目/方案） | `orders.listing_id NOT NULL`（预售商品也是 listing） | ✅ | **目标用"先建 listing 再下单"模式**，预售商品也有 listing 行，所以 NOT NULL 没问题 |
| `product_id` 加外键到 product 表（评论） | `orders.listing_id REFERENCES listings(id)` | ✅ | |
| `title_snapshot` / `image_url_snapshot` | （无） | ➕ | **重要缺失**：商品改名/删除后订单详情会显示错误信息 |
| `unit_price` / `quantity` / `subtotal_amount` | `orders.amount` + `quantity`（无 unit_price 快照） | ⚠️ | 目标只存总价，无法回溯单价（如果 quantity > 1 时商品改价） |
| `crowfunding_project_id` / `crowfunding_option_id` | `orders.listing_id`（已能定位 listing） | ⚠️ | **没保留具体哪个 design 被订购**——投票胜出后下单只关联到 listing，不到 design |

### 2.8 payment_record → payment_codes + orders.payment_trade_no

| 源字段（含 sheet 修订 + 评论） | 目标字段 | 状态 | 说明 |
|---|---|---|---|
| 独立支付记录表 | `payment_codes` + `orders.payment_trade_no` | ⚠️ | **拆分了**：4 位备注码（收款码模式）+ 第三方流水号（子商户模式） |
| `payment_no UNIQUE`（对外编号） | （无） | ➕ | 同 order_no 问题 |
| `order_id` | `payment_codes.order_id` / `orders.id` | ✅ | |
| `payer_id` / `payee_id` | （无，从 orders 推） | ⚠️ | 不冗余存 |
| `payment_type ('product'/'freight')` | `payment_code_purpose_t = ('item','shipping')` | ✅ | |
| `channel ('wechat'/'alipay')` | `payment_method_t` + `merchant_accounts.wechat_sub_mchid/alipay_pid` | ✅ | |
| `qr_code_id` | `listings.qr_code_url` 直接是 URL | ⚠️ | 不存关联 ID，无法做 QR 码使用统计 |
| `amount` | `orders.amount` | ✅ | |
| `verify_code CHAR(4)`（4 位备注码） | `payment_codes.code CHAR(4)` | ✅ | |
| `transaction_no`（第三方流水） | `orders.payment_trade_no` | ✅ | |
| `status` ('waiting_pay'/'buyer_submitted'/'confirmed'/'rejected'/'expired') | `payment_codes.used BOOLEAN` + `expires_at` | ⚠️ | **状态机被简化为 used + expired**，无法表达"买家已提交但卖家未确认"中间态 |
| `buyer_submit_note` / `seller_confirm_note` | （无） | ➕ | 缺失 |
| `paid_at` / `submitted_at` / `confirmed_at` | `orders.paid_at` + `payment_codes.used_at` | ⚠️ | 部分丢失 |

### 2.9 order_shipment → orders.carrier/tracking_number

| 源字段（含评论） | 目标字段 | 状态 | 说明 |
|---|---|---|---|
| 独立表 | 合并到 orders | ✅ | 简化合理（一对一） |
| `carrier` / `tracking_no` | `orders.carrier` / `tracking_number` | ✅ | |
| `status` ('created'/'shipped'/'in_transit'/'delivered') | （无，依赖 `orders.status`） | ⚠️ | 物流状态被合并到订单状态，**无 in_transit 中间态** |
| `shipped_at` | `orders.shipped_at` | ✅ | |
| `delivered_at`（评论：买家确认收货时间） | `orders.completed_at` | ✅ | **评论已采纳**（completed_at 即买家确认收货） |

---

## 三、AI 评审（11 条全文评论）逐条状态

| # | 评论摘要 | 目标现状 | 状态 |
|---|---|---|---|
| A1 | 严重 Bug：products SQL 错贴成 users | 目标 listings 表 SQL 正确 | ✅ 不存在 |
| A2 | pending_confirm→paid 缺状态机 | 目标 §3.7 有完整状态机 ASCII 图 | ✅ 已补 |
| A3 | expired_at vs expire_at 命名冲突 | 目标 payment_codes 用 `expires_at` 单字段 | ✅ 已规避 |
| A4 | 退款 payer_id/payee_id 改 original_* | 目标 refund_jobs 直接挂 order_id，无 payer/payee 概念 | ✅ 通过结构差异规避 |
| A5 | 14 状态枚举建议补状态机图 | §3.3 有"状态机"小节 + §3.7 有 ASCII 图 | ✅ 已补 |
| A6 | usage_type='general' 无法绑定 | 目标无 usage_type，QR 码作为 listing 字段 | ✅ 通过结构差异规避 |
| A7 | 复合外键防跨项目污染（亮点） | listing_designs/variants 用 CASCADE 但**未用复合外键**约束 variant 不能跨 listing | ⚠️ 相对宽松 |
| A8 | partial unique index 软删除（亮点） | 目标用了 `uq_orders_payment_trade_no`、`uq_orders_idempotency_key` | ✅ 已采纳 |
| A9 | event_id UNIQUE webhook 幂等（亮点） | webhook_events.event_id 是 PRIMARY KEY（更严） | ✅ 已采纳 |
| A10 | vote_limit_per_user > 1 时 DB 缺约束 | §3.6 显式说明"应用层校验" | ✅ 已说明 |

> 注：A7 是个潜在风险——理论上有人可以构造一个 design 把它挂到另一个 listing 的 variant 下；目前只能靠 ON DELETE CASCADE 隔离，但如果 variant_id 写错了不会报错。

---

## 四、汇总冲突清单（待你拍板）

按优先级排：

### 🔴 P0 — 数据完整性 / 业务功能缺失

1. **`order.title_snapshot` / `image_url_snapshot` 缺失**：商品改名/删除后历史订单展示错误。**强烈建议补**。
2. **`order.order_no` 缺失**：客服沟通、物流回查、用户截图发问无对外友好编号。**强烈建议补**。
3. **`shipping_address` 独立地址簿被删除**：用户每次下单需重输地址，体验差。**确认是否真的不要**。
4. **`product.published_at` 缺失**：列表页排序"按上架时间"实际用 created_at，"先创建后审核后上架"场景下时间不准。
5. **`product` 改 `removed` 改假删字段**：目标用 `status='closed'` 统一表达，**评论建议加 `deleted_at` 软删字段**——影响审计和"历史商品列表"查询。

### 🟠 P1 — 设计分歧需对齐

6. **`price NUMERIC(10,2)` vs `INTEGER 分`**：评论强烈建议改 INTEGER，**目标未采纳**。NUMERIC 在 PG 里没浮点坑但有性能成本；INTEGER 是行业惯例。
7. **主键 `BIGINT` vs `UUID`**：源是 BIGINT（自增），目标统一 UUID。需确认。
8. **`order_item` 是否真的简化掉**：目标只支持单 listing 订单，无购物车多商品。
9. **品类表缺失**：评论明确建议"加品类表 1:n"，目标完全没有。如果未来要按品类筛选商品（如"只看校服"），需要重新设计。
10. **`current_amount` 维护方式**：目标用触发器累加，源里没有这个字段——需要确认你接受触发器维护（vs 应用层）。

### 🟡 P2 — 信息冗余/丢失（小规模）

11. **`order.delivery_method` 不在订单上**：依赖 listing，listing 改了影响历史订单。
12. **`order.receiver_name/phone/address` 拆开 vs 合并 TEXT**：目标 TEXT 一段，无法结构化查/校验。
13. **`order.purchaser_remark` / `seller_remark` 合并为 `remark`**：无法区分谁写的备注。
14. **`order.actual_freight_amount` 单字段无法对比报价前后**：目标只有 shipping_fee。
15. **支付记录中间态 `buyer_submitted` 丢失**：payment_codes 只有 used/expired 两态，"买家说付了但卖家没确认"无法表达。
16. **`source_project_id` / `source_option_id` 投票溯源信息丢失**：直售商品只标 origin='vote_winner'，找不到具体来源。
17. **`order_item.crowfunding_option_id` 丢失**：投票胜出后下单不知道是哪个 design。
18. **复合外键防跨项目污染（A7）未实施**：listing_designs.variant_id 不强制 variant 同 listing。

### 🟢 P3 — 字段微调

19. **`users.en_name` 缺失**：双语姓名功能。
20. **`payment_qr_codes.amount_hint` 缺失**：金额提示。
21. **`payment_record.buyer_submit_note` / `seller_confirm_note` 缺失**：付款/确认备注。
22. **`payment_qr_codes.usage_type='general'` 完全删除**：是否真的不需要通用 QR 码？

---

## 五、建议的下一步

**Option A（小步推进，推荐）**：先就 P0+P1（10 条）逐条确认你的态度，得到结论后我再写 TaskCreate 拆成多个 docs +update 局部精修指令，分批改目标文档。

**Option B（一次性大改）**：你直接对上面 22 条全部表态，我一次性产出完整的改写后表定义并替换目标 §3。风险是大块替换容易出错。

**Option C（追加而非改写）**：在目标文末追加一节"v1.x → v1.y 待评审字段差异"，把 22 条原样列上去当 backlog，目标主体不动。

你怎么选？
