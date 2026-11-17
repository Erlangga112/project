import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { StatusPengajuan } from "@prisma/client";
import { NotificationOrchestrator } from "@/lib/notifications/notification.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "KEPALA_DESA") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, catatan } = body;

    const pengajuan = await prisma.pengajuanLayanan.findUnique({ where: { id } });
    if (!pengajuan) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (pengajuan.status !== "MENUNGGU_APPROVAL_KEPALA_DESA") {
      return NextResponse.json({ error: "Pengajuan tidak dalam status menunggu approval" }, { status: 400 });
    }

    const statusBefore = pengajuan.status;
    let newStatus: StatusPengajuan;
    let logAction = "";

    if (action === "SETUJUI") {
      newStatus = "DISETUJUI";
      logAction = "Disetujui Kepala Desa";
    } else if (action === "TOLAK") {
      newStatus = "DITOLAK";
      logAction = "Ditolak Kepala Desa";
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const updated = await prisma.$transaction([
      prisma.pengajuanLayanan.update({
        where: { id },
        data: { status: newStatus },
      }),
      prisma.logPengajuan.create({
        data: {
          pengajuanId: id,
          userId: session.user.id,
          action: logAction,
          catatan: catatan || null,
          statusBefore,
          statusAfter: newStatus,
        },
      }),
      prisma.notification.create({
        data: {
          userId: pengajuan.pemohonId,
          title: "Keputusan Kepala Desa",
          message: `Pengajuan (${pengajuan.nomorPengajuan}) telah ${newStatus === 'DISETUJUI' ? 'disetujui' : 'ditolak'} oleh Kepala Desa. ${catatan ? `Catatan: ${catatan}` : ''}`,
          type: newStatus === 'DISETUJUI' ? "SUCCESS" : "ERROR",
          link: `/warga/pengajuan/${id}`,
        },
      }),
    ]);

    // Picu notifikasi WhatsApp & Email
    try {
      await NotificationOrchestrator.handleStatusChange({
        pengajuanId: id,
        newStatus,
        catatan: catatan || undefined,
      });
    } catch (notifErr) {
      console.warn("NotificationOrchestrator kades handleStatusChange error:", notifErr);
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("Kades action error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
