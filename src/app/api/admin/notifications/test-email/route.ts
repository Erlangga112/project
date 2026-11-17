import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendGmail, generateEmailHtml, generateEmailPlainText } from "@/lib/notifications/email.service";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "STAF_DESA" && session.user.role !== "SUPERVISOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { targetEmail } = body;

    const emailToSend = targetEmail?.trim() || session.user.email;
    if (!emailToSend) {
      return NextResponse.json({ error: "Alamat email tujuan pengujian harus diisi" }, { status: 400 });
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

    const emailParams = {
      wargaNama: session.user.name || "Penguji Sistem",
      nomorPengajuan: "TEST-SIMULASI-001",
      jenisLayanan: "Uji Konektivitas Email Gmail",
      statusBadgeText: "UJI COBA RESMI",
      statusBadgeColor: "#059669",
      pesanUtama: "Ini adalah email uji coba untuk memverifikasi bahwa integrasi Gmail SMTP pada Sistem Pelayanan Desa Terpadu — Asisten Desa Perum telah terhubung dan berfungsi dengan baik.",
      langkahBerikutnya: "Konfigurasi Gmail Anda sudah aktif. Semua alur notifikasi warga akan terkirim dengan format standar multipart (HTML & Teks Polos) untuk mencegah salah deteksi spam.",
      waktuPembaruan: waktuStr,
    };

    const testHtml = generateEmailHtml(emailParams);
    const testText = generateEmailPlainText(emailParams);

    const result = await sendGmail({
      to: emailToSend,
      recipientName: session.user.name || "Administrator",
      subject: `Notifikasi Pelayanan Desa: [UJI COBA] Integrasi Gmail SMTP - ${waktuStr}`,
      html: testHtml,
      text: testText,
      event: "TEST_SIMULASI",
    });

    // Catat ke notificationLog dengan metadata SMTP yang aman
    const metadataObj = {
      smtpStatus: result.success ? "ACCEPTED" : "FAILED",
      smtpResponse: result.response || null,
      messageId: result.messageId || null,
      acceptedRecipients: result.accepted || [],
      rejectedRecipients: result.rejected || [],
      deliveryNote: result.success
        ? "Permintaan SMTP berhasil diterima relay Gmail (250 OK). Pengiriman ke Inbox penerima bergantung pada filter spam dan reputasi akun Gmail penerima."
        : "Permintaan pengujian SMTP gagal.",
    };

    const log = await prisma.notificationLog.create({
      data: {
        channel: "EMAIL",
        event: "TEST_SIMULASI",
        recipient: emailToSend,
        recipientName: session.user.name || null,
        subject: `Notifikasi Pelayanan Desa: [UJI COBA] Integrasi Gmail SMTP - ${waktuStr}`,
        message: testText,
        status: result.status,
        providerMessageId: result.messageId || null,
        errorMessage: result.error || null,
        userId: session.user.id,
        metadata: JSON.stringify(metadataObj),
      },
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Email uji coba berhasil dikirim ke ${emailToSend}`,
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
    console.error("POST /api/admin/notifications/test-email error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan saat memproses pengujian email" }, { status: 500 });
  }
}
