import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NotificationChannel, NotificationDeliveryStatus } from "@prisma/client";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "STAF_DESA" && session.user.role !== "SUPERVISOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const channel = searchParams.get("channel");
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (channel && Object.values(NotificationChannel).includes(channel as NotificationChannel)) {
    where.channel = channel as NotificationChannel;
  }

  if (status && Object.values(NotificationDeliveryStatus).includes(status as NotificationDeliveryStatus)) {
    where.status = status as NotificationDeliveryStatus;
  }

  if (search) {
    where.OR = [
      { recipient: { contains: search, mode: "insensitive" } },
      { recipientName: { contains: search, mode: "insensitive" } },
      { subject: { contains: search, mode: "insensitive" } },
      { event: { contains: search, mode: "insensitive" } },
      { providerMessageId: { contains: search, mode: "insensitive" } },
      { pengajuan: { nomorPengajuan: { contains: search, mode: "insensitive" } } },
    ];
  }

  try {
    const logs = await prisma.notificationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        pengajuan: {
          select: {
            nomorPengajuan: true,
            jenisLayanan: { select: { nama: true } },
          },
        },
      },
    });

    // Ringkasan metrik statistik
    const totalCount = await prisma.notificationLog.count();
    const sentCount = await prisma.notificationLog.count({ where: { status: "SENT" } });
    const failedCount = await prisma.notificationLog.count({ where: { status: "FAILED" } });
    const skippedCount = await prisma.notificationLog.count({ where: { status: "SKIPPED" } });

    return NextResponse.json({
      logs,
      metrics: {
        total: totalCount,
        sent: sentCount,
        failed: failedCount,
        skipped: skippedCount,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/notifications/logs error:", error);
    return NextResponse.json({ error: "Gagal memuat log notifikasi" }, { status: 500 });
  }
}
