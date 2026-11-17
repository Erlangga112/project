import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { StatusPengajuan } from "@prisma/client";
import { NotificationOrchestrator } from "@/lib/notifications/notification.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "STAF_DESA") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, catatan } = body;

    const pengajuan = await prisma.pengajuanLayanan.findUnique({ where: { id } });
    if (!pengajuan) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const statusBefore = pengajuan.status;
    let newStatus: StatusPengajuan = pengajuan.status;
    let logAction = "";

    if (action === "PROSES") {
      newStatus = "DIPERIKSA";
      logAction = "Memulai Pemeriksaan";
    } else if (action === "MINTA_PERBAIKAN") {
      newStatus = "PERLU_PERBAIKAN";
      logAction = "Meminta Perbaikan Dokumen";
    } else if (action === "TERUSKAN") {
      newStatus = "MENUNGGU_VALIDASI";
      logAction = "Meneruskan ke Supervisor";
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const updated = await prisma.$transaction([
      prisma.pengajuanLayanan.update({
        where: { id },
        data: {
          status: newStatus,
          diprosesOlehId: session.user.id,
        },
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
            newStatus === "MENUNGGU_VALIDASI"
              ? "Berkas Selesai Diverifikasi (Menunggu Validasi)"
              : newStatus === "DIPERIKSA"
              ? "Berkas Sedang Diperiksa"
              : "Perlu Perbaikan Dokumen",
          message:
            newStatus === "MENUNGGU_VALIDASI"
              ? `Berkas pengajuan Anda (${pengajuan.nomorPengajuan}) telah diverifikasi staf dan diteruskan ke Supervisor untuk validasi.`
              : newStatus === "DIPERIKSA"
              ? `Pengajuan Anda (${pengajuan.nomorPengajuan}) sedang diperiksa dan diverifikasi oleh staf pelayanan desa.`
              : `Pengajuan Anda (${pengajuan.nomorPengajuan}) memerlukan perbaikan dokumen.${catatan ? ` Catatan: ${catatan}` : ""}`,
          type: newStatus === "PERLU_PERBAIKAN" ? "WARNING" : "INFO",
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
      console.warn("NotificationOrchestrator staf handleStatusChange error:", notifErr);
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("Staf action error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
