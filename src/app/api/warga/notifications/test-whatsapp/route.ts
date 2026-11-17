import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp.service";
import { validateAndNormalizeIndonesianPhone } from "@/lib/notifications/phone-utils";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let targetPhone = "";
    const body = await request.json().catch(() => ({}));
    if (body.targetPhone) {
      targetPhone = body.targetPhone.trim();
    }

    // Ambil data profil warga
    const profil = await prisma.profilWarga.findUnique({
      where: { userId: session.user.id },
      select: { noTelepon: true, namaLengkap: true },
    });

    if (!targetPhone) {
      targetPhone = profil?.noTelepon || "";
    }

    if (!targetPhone) {
      return NextResponse.json(
        {
          error:
            "Nomor WhatsApp belum terdaftar di profil Anda. Silakan isi nomor WhatsApp Anda terlebih dahulu.",
        },
        { status: 400 }
      );
    }

    const val = validateAndNormalizeIndonesianPhone(targetPhone);
    if (!val.isValid) {
      return NextResponse.json({ error: val.error || "Nomor WhatsApp tidak valid" }, { status: 400 });
    }

    const namaWarga = profil?.namaLengkap || session.user.name || "Warga Pemohon";
    const waktuStr = new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const message =
      `*UJI COBA NOTIFIKASI WHATSAPP WARGA BERHASIL*\n` +
      `Sistem Pelayanan Desa Terpadu — Asisten Desa Perum\n` +
      `-----------------------------------------\n` +
      `Halo *${namaWarga}*,\n\n` +
      `Nomor WhatsApp Anda (*${val.displayFormat}*) berhasil terverifikasi dan siap menerima notifikasi pelayanan desa secara otomatis.\n\n` +
      `📌 Anda akan menerima pesan WhatsApp langsung saat:\n` +
      `1. Pengajuan surat Anda berhasil dikirim\n` +
      `2. Berkas sedang diperiksa petugas\n` +
      `3. Memerlukan perbaikan dokumen (jika ada)\n` +
      `4. Pengajuan disetujui Kepala Desa\n` +
      `5. Surat resmi selesai diterbitkan dan siap diunduh\n\n` +
      `Waktu Uji: ${waktuStr}\n` +
      `_Pesan otomatis dari Sistem Pelayanan Desa Terpadu._`;

    const result = await sendWhatsAppMessage({
      to: val.formattedE164,
      recipientName: namaWarga,
      message,
      event: "TEST_SIMULASI",
    });

    // Catat log pengiriman
    const log = await prisma.notificationLog.create({
      data: {
        channel: "WHATSAPP",
        event: "TEST_SIMULASI",
        recipient: val.formattedE164,
        recipientName: namaWarga,
        subject: "[UJI COBA] WhatsApp Warga Terverifikasi",
        message,
        status: result.status,
        providerMessageId: result.messageId || null,
        errorMessage: result.error || null,
        userId: session.user.id,
      },
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Pesan uji coba WhatsApp berhasil dikirim ke nomor ${val.displayFormat}`,
        messageId: result.messageId,
        logId: log.id,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          status: result.status,
          error: result.error,
          logId: log.id,
        },
        { status: result.status === "SKIPPED" ? 200 : 400 }
      );
    }
  } catch (error) {
    console.error("POST /api/warga/notifications/test-whatsapp error:", error);
    return NextResponse.json({ error: "Gagal memproses uji coba WhatsApp warga" }, { status: 500 });
  }
}
