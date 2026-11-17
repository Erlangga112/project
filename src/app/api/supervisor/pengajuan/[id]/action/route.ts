import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { StatusPengajuan } from "@prisma/client";
import { NotificationOrchestrator } from "@/lib/notifications/notification.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, catatan } = body;

    const pengajuan = await prisma.pengajuanLayanan.findUnique({ where: { id } });
    if (!pengajuan) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (pengajuan.status !== "MENUNGGU_VALIDASI") {
      return NextResponse.json({ error: "Pengajuan tidak dalam status menunggu validasi" }, { status: 400 });
    }

    const statusBefore = pengajuan.status;
    let newStatus: StatusPengajuan;
    let logAction = "";

    if (action === "SETUJUI") {
      newStatus = "MENUNGGU_APPROVAL_KEPALA_DESA";
      logAction = "Validasi Disetujui (Diteruskan ke Kepala Desa)";
    } else if (action === "TOLAK") {
      newStatus = "DITOLAK";
      logAction = "Pengajuan Ditolak Supervisor";
    } else if (action === "MINTA_PERBAIKAN") {
      newStatus = "PERLU_PERBAIKAN";
      logAction = "Meminta Perbaikan Dokumen (Dikembalikan)";
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
          title:
            newStatus === "MENUNGGU_APPROVAL_KEPALA_DESA"
              ? "Validasi Pengajuan Disetujui"
              : newStatus === "PERLU_PERBAIKAN"
              ? "Perlu Perbaikan Dokumen"
              : "Pengajuan Tidak Disetujui",
          message:
            newStatus === "MENUNGGU_APPROVAL_KEPALA_DESA"
              ? `Pengajuan Anda (${pengajuan.nomorPengajuan}) telah berhasil divalidasi oleh Supervisor dan diteruskan ke Kepala Desa untuk persetujuan akhir.${catatan ? ` Catatan: ${catatan}` : ""}`
              : `Pengajuan (${pengajuan.nomorPengajuan}) ${newStatus === "PERLU_PERBAIKAN" ? "memerlukan perbaikan dokumen" : "tidak dapat disetujui"}.${catatan ? ` Catatan: ${catatan}` : ""}`,
          type: newStatus === "PERLU_PERBAIKAN" ? "WARNING" : newStatus === "DITOLAK" ? "ERROR" : "SUCCESS",
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
      console.warn("NotificationOrchestrator spv handleStatusChange error:", notifErr);
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("Supervisor action error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
