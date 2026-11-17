import { NextResponse } from "next/server";
import { AdminAccessError } from "@sast-shop/api";
import { requireAdmin } from "@/lib/admin-server";

export async function GET() {
  try {
    const { identity } = await requireAdmin();
    return NextResponse.json(
      { identity },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof AdminAccessError ? error.status : 503;
    return NextResponse.json(
      {
        error:
          error instanceof AdminAccessError
            ? error.message
            : "暂时无法核实管理员权限，请重试",
      },
      { status, headers: { "cache-control": "no-store" } },
    );
  }
}
