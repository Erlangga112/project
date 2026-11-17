import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp.service";
import { validateAndNormalizeIndonesianPhone } from "@/lib/notifications/phone-utils";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "STAF_DESA" && session.user.role !== "SUPERVISOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { targetPhone } = body;

    if (!targetPhone) {
      return NextResponse.json({ error: "Nomor WhatsApp tujuan pengujian wajib diisi" }, { status: 400 });
    }

    const val = validateAndNormalizeIndonesianPhone(targetPhone);
    if (!val.isValid) {
      return NextResponse.json({ error: val.error || "Nomor WhatsApp tidak valid" }, { status: 400 });
    }

    const waktuStr = new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const testMessage = `[UJI COBA WHATSAPP CLOUD API]\n` +
      `Sistem: Pelayanan Desa Terpadu — Asisten Desa Perum\n` +
      `Waktu Uji: ${waktuStr}\n` +
      `Status: Koneksi Meta WhatsApp Business Cloud API berhasil diinisiasi.\n\n` +
      `Pesan ini menandakan bahwa nomor ini siap menerima notifikasi pengajuan baru, validasi supervisor, dan approval kepala desa.`;

    const result = await sendWhatsAppMessage({
      to: val.formattedE164,
      recipientName: session.user.name || "Petugas Desa",
      message: testMessage,
      event: "TEST_SIMULASI",
    });

    // Catat ke notificationLog
    const log = await prisma.notificationLog.create({
      data: {
        channel: "WHATSAPP",
        event: "TEST_SIMULASI",
        recipient: val.formattedE164,
        recipientName: session.user.name || null,
        subject: "[UJI COBA] WhatsApp Cloud API",
        message: testMessage,
        status: result.status,
        providerMessageId: result.messageId || null,
        errorMessage: result.error || null,
        userId: session.user.id,
      },
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Pesan WhatsApp uji coba berhasil dikirim ke ${val.displayFormat}`,
        messageId: result.messageId,
        logId: log.id,
      });
    } else {
      return NextResponse.json({
        success: false,
        status: result.status,
        error: result.error,
        logId: log.id,
      }, { status: result.status === "SKIPPED" ? 200 : 400 });
    }
  } catch (error) {
    console.error("POST /api/admin/notifications/test-whatsapp error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan saat memproses pengujian WhatsApp" }, { status: 500 });
  }
}
