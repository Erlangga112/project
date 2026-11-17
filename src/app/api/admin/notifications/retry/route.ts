import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NotificationOrchestrator } from "@/lib/notifications";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (
    !session ||
    (session.user.role !== "STAF_DESA" &&
      session.user.role !== "SUPERVISOR" &&
      session.user.role !== "KEPALA_DESA" &&
      session.user.role !== "ADMIN")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { logId } = body;

    if (!logId) {
      return NextResponse.json({ error: "logId wajib diisi" }, { status: 400 });
    }

    const updatedLog = await NotificationOrchestrator.retryNotification(logId);

    return NextResponse.json({
      success: updatedLog.status === "SENT",
      status: updatedLog.status,
      log: updatedLog,
    });
  } catch (error: unknown) {
    console.error("POST /api/admin/notifications/retry error:", error);
    const msg = error instanceof Error ? error.message : "Gagal mengulang pengiriman";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
