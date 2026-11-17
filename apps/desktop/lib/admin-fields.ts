import type { AdminDomain, AdminResource } from "@sast-shop/api";
import type { AdminResourceSection } from "./admin-navigation";

export const sectionResources: Record<AdminResourceSection, AdminResource> = {
  users: "user",
  stores: "store",
  templates: "product",
  goods: "spot_goods",
  orders: "spot_order",
  demands: "errand_demand",
  tasks: "errand_task",
  bills: "bill",
  pockets: "pocket",
  jobs: "job",
};
export const domainLabels: Record<AdminDomain, string> = {
  user: "用户",
  catalog: "商品与店铺",
  spot: "现货交易",
  errand: "团购采购",
  payment: "支付账单",
  pocket: "West Pocket",
};
export const resourceLabels: Record<AdminResource, string> = {
  user: "用户",
  store: "店铺",
  product: "商品模板",
  spot_goods: "现货",
  spot_order: "现货订单",
  errand_demand: "团购需求",
  errand_task: "采购任务",
  bill: "账单",
  pocket: "West Pocket 活动",
  job: "后台任务",
};
export const actionLabels: Record<string, string> = {
  create: "新建",
  update: "编辑资料",
  block: "停用",
  unblock: "恢复使用",
  ban: "全面封禁",
  unban: "解除封禁",
  grant_admin: "授予管理员",
  revoke_admin: "撤销管理员",
  grant_superadmin: "授予超级管理员",
  revoke_superadmin: "撤销超级管理员",
  complete: "确认实际履约完成",
  cancel: "取消并核对关联交易",
  reopen: "重新开启处理",
  reverse_completion: "撤销完成并重新处理",
  reject_payment: "退回付款确认",
  confirm_payment: "补充确认收款",
  register_refund: "登记已退款凭据",
  retry_job: "重试失败任务",
  retry: "重试失败任务",
  retry_notifications: "重新发送未完成通知",
};
const statusLabels: Record<string, string> = {
  active: "正常",
  allowed: "可正常使用",
  accepted: "已接单",
  fulfilled: "已履约",
  hidden: "已隐藏",
  removed: "已移除",
  settled: "已收齐",
  preview: "待执行",
  retrying: "正在恢复",
  needs_attention: "待人工核查",
  banned: "已封禁",
  blocked: "已停用",
  normal: "正常",
  inactive: "未启用",
  open: "待接单",
  pending: "待处理",
  running: "处理中",
  queued: "排队中",
  failed: "处理失败",
  succeeded: "已成功",
  success: "已成功",
  completed: "已完成",
  cancelled: "已取消",
  canceled: "已取消",
  pending_payment: "待付款",
  paid: "已付款",
  unpaid: "未付款",
  submitted: "已提交付款",
  closed: "已关闭",
  selling: "在售",
  sold_out: "已售罄",
  delisted: "已下架",
  shopping: "采购中",
  pending_distributing: "待分发",
  distributing: "分发中",
  collecting_payment: "收款中",
  collecting: "收款中",
  draft: "草稿",
  publishing: "正在发起收款",
  cancelling: "正在取消",
  previewed: "待执行",
  prepared: "待执行",
  executing: "执行中",
  compensated: "已恢复",
  reconciliation_required: "待核查",
  expired: "已过期",
  admin: "管理员",
  superadmin: "超级管理员",
  member: "普通成员",
  user: "普通用户",
};
export function adminStatus(value: string) {
  return statusLabels[value] ?? value;
}
export function adminDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Shanghai",
      }).format(date);
}
export function adminMoney(value: string | number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
  }).format(Number(value) / 100);
}

export interface AdminFormField {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "textarea" | "datetime-local" | "checkbox";
  min?: number;
  help?: string;
  choices?: Array<{ value: string; label: string }>;
}
const storeFields: AdminFormField[] = [
  { key: "name", label: "店铺名称", required: true },
  { key: "address", label: "店铺地址", required: true },
  { key: "logo_url", label: "Logo 地址", help: "填写 HTTPS 图片地址" },
  { key: "theme_color", label: "主题色", help: "例如 #c9431f" },
];
const productFields: AdminFormField[] = [
  { key: "store_id", label: "所属店铺 ID", required: true },
  { key: "title", label: "商品名称", required: true },
  { key: "description", label: "规格说明", type: "textarea" },
  { key: "barcode", label: "商品条码", required: true },
  {
    key: "price_cents",
    label: "参考价格（分）",
    type: "number",
    min: 1,
    required: true,
    help: "整数分，例如 990 表示 9.90 元",
  },
  { key: "main_image_url", label: "商品图片地址", help: "填写 HTTPS 图片地址" },
];
export function adminFormFields(
  resource: AdminResource,
  action: string,
): AdminFormField[] {
  if (action === "create" || action === "update") {
    if (resource === "store") return storeFields;
    if (resource === "product") return productFields;
  }
  if (resource === "errand_demand" && action === "reopen")
    return [
      {
        key: "deadline",
        label: "新的期望送达时间",
        type: "datetime-local",
        help: "原截止时间已过时必填，需晚于当前时间",
      },
    ];
  if (
    resource === "errand_task" &&
    ["cancel", "reopen", "reverse_completion"].includes(action)
  )
    return [
      {
        key: "submitted_unreceived_confirmed",
        label: "已逐笔核实所有已申报付款尚未到账",
        type: "checkbox",
        help: "仅在账单中同时存在已确认收款与已申报付款时勾选。实际到账的申报须先确认收款，再整单纠错",
      },
      ...adminFormFields("bill", action).map((field) =>
        action === "reverse_completion" && field.key === "funds_handling"
          ? {
              ...field,
              choices: field.choices?.filter((choice) =>
                ["refunded", "confirmation_error"].includes(choice.value),
              ),
            }
          : field,
      ),
      ...(action === "reopen"
        ? [
            {
              key: "target_status",
              label: "恢复到哪个阶段",
              required: true,
              choices: [
                { value: "shopping", label: "重新开始采购（原任务没有账单）" },
                {
                  value: "collecting_payment",
                  label: "保留履约结果，重新收款",
                },
              ],
            },
          ]
        : []),
      {
        key: "deadline",
        label: "补充新的期望送达时间",
        type: "datetime-local",
        help: "恢复需求时原截止时间已过才填写",
      },
      {
        key: "restore_assignments",
        label: "补录缺失的历史分配关系",
        help: "仅在预览提示历史分配关系缺失时，按凭据补录；已有分配关系不能覆盖",
      },
      {
        key: "missing_bill_confirmed",
        label: "历史缺失账单核实",
        choices: [
          { value: "false", label: "不补录账单" },
          { value: "true", label: "已核实账单缺失，确认按原交易补录" },
        ],
      },
    ];
  if (action === "register_refund")
    return [
      {
        key: "funds_handling",
        label: "退款核实",
        required: true,
        choices: [
          { value: "refunded", label: "已全额退款，流水及核查依据已登记" },
        ],
        help: "退款金额取自账单；请在核查依据中填写实际退款流水，不会发起真实转账",
      },
    ];
  if (
    ["cancel", "reopen", "reverse_completion"].includes(action) &&
    ["spot_order", "errand_task", "pocket", "bill"].includes(resource)
  )
    return [
      {
        key: "funds_handling",
        label: "已核实的款项处理方式",
        required: true,
        choices: [
          ...(resource === "pocket" && action === "reverse_completion"
            ? []
            : [{ value: "no_payment_received", label: "已核实未收款" }]),
          {
            value: "confirmation_error",
            label: "原收款确认有误，已核实实际未到账",
          },
          ...(action === "cancel" ||
          (resource === "pocket" && action === "reverse_completion")
            ? []
            : [{ value: "retain", label: "保留已收款项，继续履约" }]),
          { value: "refunded", label: "已全额退款，依据已登记" },
        ],
      },
      ...(resource === "pocket"
        ? [
            {
              key: "submitted_unreceived_confirmed",
              label: "已逐笔核实所有已申报付款尚未到账",
              type: "checkbox" as const,
              help: "仅在混合收款状态下核实后勾选；实际到账的申报须先确认收款",
            },
            {
              key: "missing_bill_confirmed",
              label: "历史缺失账单核实",
              choices: [
                { value: "false", label: "不补录账单" },
                { value: "true", label: "已核实账单缺失，按原冻结份额补录" },
              ],
            },
          ]
        : []),
      ...(resource === "spot_order" && action === "cancel"
        ? [
            {
              key: "stock_handling",
              label: "实物与库存处理",
              required: true,
              choices: [
                { value: "keep", label: "不回补库存" },
                { value: "restore", label: "已核实实物退回，回补库存" },
              ],
            },
          ]
        : []),
    ];
  return [];
}
export function isCorrectionAction(action: string) {
  return [
    "cancel",
    "reopen",
    "reverse_completion",
    "reject_payment",
    "confirm_payment",
    "register_refund",
  ].includes(action);
}
export function isRoleAction(action: string) {
  return [
    "grant_admin",
    "revoke_admin",
    "grant_superadmin",
    "revoke_superadmin",
  ].includes(action);
}

export function restorationChoices(key: string) {
  if (key === "target_status")
    return [
      { value: "shopping", label: "重新开始采购" },
      { value: "collecting_payment", label: "保留履约结果，重新收款" },
    ];
  if (key === "inventory_released")
    return [
      { value: "true", label: "已核实库存已经回补" },
      { value: "false", label: "已核实库存尚未回补" },
    ];
  if (key === "missing_bill_confirmed")
    return [{ value: "true", label: "已核实缺失账单，同意按原订单补录" }];
  if (key === "missing_bill_status")
    return [
      { value: "unpaid", label: "原交易未收款" },
      { value: "completed", label: "原交易已确认收款" },
    ];
  return null;
}

export function adminStatusChoices(resource: AdminResource) {
  const statuses: Record<AdminResource, string[]> = {
    user: ["active", "banned"],
    store: ["active", "draft", "hidden", "removed", "blocked"],
    product: ["active", "draft", "hidden", "removed", "blocked"],
    spot_goods: ["active", "closed", "delisted", "blocked"],
    spot_order: ["pending_payment", "paid", "completed", "cancelled"],
    errand_demand: [
      "open",
      "shopping",
      "pending_distributing",
      "distributing",
      "pending_payment",
      "completed",
      "cancelled",
    ],
    errand_task: [
      "shopping",
      "pending_distributing",
      "distributing",
      "collecting_payment",
      "completed",
      "cancelled",
    ],
    bill: ["unpaid", "submitted", "completed", "closed"],
    pocket: [
      "draft",
      "publishing",
      "collecting",
      "settled",
      "cancelling",
      "cancelled",
    ],
    job: ["queued", "running", "succeeded", "failed", "cancelled"],
  };
  return [
    { value: "all", label: "全部状态" },
    ...statuses[resource].map((value) => ({
      value,
      label: adminStatus(value),
    })),
  ];
}
