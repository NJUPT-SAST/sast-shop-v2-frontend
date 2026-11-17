export const adminSections = [
  {
    key: "overview",
    title: "运营概览",
    href: "/admin",
    description: "查看全站业务与处理情况",
  },
  {
    key: "users",
    title: "用户管理",
    href: "/admin/users",
    description: "查询用户、管理账号状态与管理员权限",
  },
  {
    key: "stores",
    title: "店铺管理",
    href: "/admin/stores",
    description: "维护全站店铺资料，保留用户共建入口",
  },
  {
    key: "templates",
    title: "商品模板",
    href: "/admin/templates",
    description: "维护商品名称、条码、规格与参考价格",
  },
  {
    key: "goods",
    title: "现货管理",
    href: "/admin/goods",
    description: "查询全站现货、库存与上架状态",
  },
  {
    key: "orders",
    title: "现货订单",
    href: "/admin/orders",
    description: "核对交易、处理异常并查看历史轮次",
  },
  {
    key: "demands",
    title: "团购需求",
    href: "/admin/demands",
    description: "查询需求及关联采购任务",
  },
  {
    key: "tasks",
    title: "采购任务",
    href: "/admin/tasks",
    description: "核查采购、分发与收款流程",
  },
  {
    key: "bills",
    title: "支付账单",
    href: "/admin/bills",
    description: "核对付款记录、补录历史依据与纠正状态",
  },
  {
    key: "pockets",
    title: "West Pocket",
    href: "/admin/pockets",
    description: "管理活动与分摊交易，不展示人脸或私密照片",
  },
  {
    key: "jobs",
    title: "后台任务",
    href: "/admin/jobs",
    description: "核查 West Pocket 任务状态并恢复失败任务",
  },
  {
    key: "audit",
    title: "操作记录",
    href: "/admin/audit",
    description: "追踪管理员操作、处理依据与执行结果",
  },
] as const;

export type AdminSectionKey = (typeof adminSections)[number]["key"];
export type AdminResourceSection = Exclude<
  AdminSectionKey,
  "overview" | "audit"
>;

export function findAdminSection(key: string) {
  return adminSections.find((section) => section.key === key);
}

export function safeAdminReturnTo(value: string | null | undefined): string {
  if (!value || /[\\\u0000-\u001f]/.test(value)) return "/admin";
  try {
    const url = new URL(value, "https://admin.invalid");
    if (
      url.origin !== "https://admin.invalid" ||
      (url.pathname !== "/admin" && !url.pathname.startsWith("/admin/"))
    )
      return "/admin";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/admin";
  }
}
