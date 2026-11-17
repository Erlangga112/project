import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp.service";
import { validateAndNormalizeIndonesianPhone } from "@/lib/notifications/phone-utils";
import { NotificationEventType } from "@/lib/notifications/types";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "STAF_DESA" && session.user.role !== "SUPERVISOR")) {
    return NextResponse.json({ error: "Forbidden: Hanya staf dan supervisor yang dapat melakukan pengujian" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      targetPhone,
      namaWarga = "Bpk/Ibu Warga Pemohon",
      jenisLayanan = "Surat Keterangan Usaha (SKU)",
      nomorPengajuan = "REG-20261026-TEST",
      skenario = "DIAJUKAN",
      catatan = "",
    } = body;

    if (!targetPhone) {
      return NextResponse.json({ error: "Nomor WhatsApp warga tujuan wajib diisi" }, { status: 400 });
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
    });

    let messageBody = "";
    let eventName: NotificationEventType = "TEST_SIMULASI";
    let statusSubject = "";

    switch (skenario) {
      case "DIAJUKAN":
      case "PENGAJUAN_BARU":
        eventName = "PENGAJUAN_BARU";
        statusSubject = "Pengajuan Berhasil Diterima";
        messageBody =
          `*PEMBERITAHUAN PELAYANAN DESA*\n` +
          `Sistem Pelayanan Desa Terpadu — Asisten Desa Perum\n` +
          `-----------------------------------------\n` +
          `Halo *${namaWarga}*,\n\n` +
          `Pengajuan permohonan surat Anda telah berhasil kami terima ke dalam sistem:\n` +
          `• No. Registrasi: *${nomorPengajuan}*\n` +
          `• Jenis Layanan: *${jenisLayanan}*\n` +
          `• Status: *Menunggu Verifikasi Berkas*\n` +
          `• Waktu: ${waktuStr}\n\n` +
          `Petugas staf desa akan segera memeriksa kelengkapan dokumen persyaratan Anda. Pantau status pengajuan secara berkala melalui portal web pelayanan desa.\n\n` +
          `_Pesan otomatis resmi kantor pelayanan desa._`;
        break;

      case "DIPERIKSA":
        eventName = "DIPERIKSA";
        statusSubject = "Berkas Sedang Diperiksa";
        messageBody =
          `*STATUS PENGAJUAN: SEDANG DIPERIKSA*\n` +
          `Sistem Pelayanan Desa Terpadu — Asisten Desa Perum\n` +
          `-----------------------------------------\n` +
          `Yth. *${namaWarga}*,\n\n` +
          `Berkas pengajuan *${jenisLayanan}* dengan nomor *${nomorPengajuan}* saat ini *sedang dalam proses pemeriksaan dan verifikasi* oleh staf pelayanan desa.\n\n` +
          `• Waktu Pemeriksaan: ${waktuStr}\n` +
          `${catatan ? `• Catatan Petugas: ${catatan}\n` : ""}` +
          `\nAnda akan menerima pemberitahuan berikutnya setelah verifikasi selesai dilakukan. Terima kasih atas kesabaran Anda.`;
        break;

      case "PERLU_PERBAIKAN":
        eventName = "PERLU_PERBAIKAN";
        statusSubject = "Perlu Perbaikan Dokumen";
        messageBody =
          `*PERHATIAN: PERBAIKAN DOKUMEN DIPERLUKAN*\n` +
          `Sistem Pelayanan Desa Terpadu — Asisten Desa Perum\n` +
          `-----------------------------------------\n` +
          `Yth. *${namaWarga}*,\n\n` +
          `Mohon maaf, pengajuan surat *${jenisLayanan}* (*${nomorPengajuan}*) memerlukan perbaikan atau dokumen pendukung tambahan:\n\n` +
          `📌 *Catatan Petugas:* ${catatan || "Ada lampiran dokumen yang buram atau belum sesuai persyaratan."}\n\n` +
          `Silakan segera masuk ke portal pelayanan desa untuk mengunggah kembali dokumen yang diminta agar permohonan dapat segera diproses kembali.`;
        break;

      case "DISETUJUI":
        eventName = "DISETUJUI";
        statusSubject = "Pengajuan Telah Disetujui";
        messageBody =
          `*KABAR BAIK: PENGAJUAN TELAH DISETUJUI*\n` +
          `Sistem Pelayanan Desa Terpadu — Asisten Desa Perum\n` +
          `-----------------------------------------\n` +
          `Yth. *${namaWarga}*,\n\n` +
          `Pengajuan permohonan surat *${jenisLayanan}* Anda dengan nomor *${nomorPengajuan}* telah *DISETUJUI oleh Kepala Desa*.\n\n` +
          `• Waktu Persetujuan: ${waktuStr}\n` +
          `• Tahap Selanjutnya: Penerbitan nomor surat resmi oleh staf desa.\n\n` +
          `Setelah nomor surat resmi selesai diterbitkan, Anda akan menerima pesan konfirmasi bahwa surat siap diunduh atau diambil.`;
        break;

      case "SELESAI":
        eventName = "SELESAI";
        statusSubject = "Surat Resmi Selesai & Siap Diambil";
        const nomorSuratSimulasi = "470/082/DS-PRM/X/2026";
        messageBody =
          `*SURAT RESMI TELAH SELESAI DITERBITKAN*\n` +
          `Sistem Pelayanan Desa Terpadu — Asisten Desa Perum\n` +
          `-----------------------------------------\n` +
          `Yth. *${namaWarga}*,\n\n` +
          `Surat permohonan *${jenisLayanan}* Anda telah selesai diproses dan diterbitkan secara resmi:\n\n` +
          `• Nomor Surat: *${nomorSuratSimulasi}*\n` +
          `• No. Pengajuan: *${nomorPengajuan}*\n` +
          `• Tanggal Terbit: ${waktuStr}\n\n` +
          `Dokumen resmi dapat Anda unduh dalam format digital melalui portal web pelayanan desa, atau Anda dapat mengambil cetakan fisik dokumen di loket kantor desa pada jam pelayanan kerja.\n\n` +
          `Terima kasih telah menggunakan Sistem Pelayanan Desa Terpadu.`;
        break;

      case "DITOLAK":
        eventName = "DITOLAK";
        statusSubject = "Pengajuan Tidak Dapat Disetujui";
        messageBody =
          `*PEMBERITAHUAN: PENGAJUAN DITOLAK*\n` +
          `Sistem Pelayanan Desa Terpadu — Asisten Desa Perum\n` +
          `-----------------------------------------\n` +
          `Yth. *${namaWarga}*,\n\n` +
          `Mohon maaf, pengajuan surat *${jenisLayanan}* dengan nomor *${nomorPengajuan}* tidak dapat disetujui.\n\n` +
          `📌 *Alasan Penolakan:* ${catatan || "Kriteria persyaratan administratif pelayanan belum terpenuhi sesuai ketentuan yang berlaku."}\n\n` +
          `Untuk informasi lebih lanjut, silakan berkonsultasi langsung dengan petugas pelayanan kantor desa pada jam kerja.`;
        break;

      default:
        eventName = "TEST_SIMULASI";
        statusSubject = "Uji Coba Notifikasi WhatsApp Warga";
        messageBody =
          `*UJI COBA NOTIFIKASI WHATSAPP WARGA*\n` +
          `Sistem Pelayanan Desa Terpadu — Asisten Desa Perum\n` +
          `-----------------------------------------\n` +
          `Halo *${namaWarga}*,\n\n` +
          `Pesan ini adalah pengujian resmi koneksi WhatsApp untuk nomor warga. Sistem pelayanan desa siap mengirimkan pemberitahuan otomatis saat terjadi perubahan status permohonan surat Anda.\n\n` +
          `Waktu pengujian: ${waktuStr}`;
    }

    // Eksekusi kirim WhatsApp via service
    const result = await sendWhatsAppMessage({
      to: val.formattedE164,
      recipientName: namaWarga,
      message: messageBody,
      event: eventName,
    });

    // Catat ke tabel NotificationLog
    const log = await prisma.notificationLog.create({
      data: {
        channel: "WHATSAPP",
        event: eventName,
        recipient: val.formattedE164,
        recipientName: namaWarga,
        subject: `[UJI COBA WARGA] ${statusSubject}`,
        message: messageBody,
        status: result.status,
        providerMessageId: result.messageId || null,
        errorMessage: result.error || null,
        userId: session.user.id,
        metadata: JSON.stringify({
          simulatedSkenario: skenario,
          jenisLayanan,
          nomorPengajuan,
        }),
      },
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Pesan WhatsApp simulasi "${statusSubject}" berhasil dikirim ke nomor warga ${val.displayFormat}`,
        messageId: result.messageId,
        logId: log.id,
        previewMessage: messageBody,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          status: result.status,
          error: result.error,
          logId: log.id,
          previewMessage: messageBody,
        },
        { status: result.status === "SKIPPED" ? 200 : 400 }
      );
    }
  } catch (error) {
    console.error("POST /api/admin/notifications/test-warga-whatsapp error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan internal saat memproses uji coba WhatsApp warga" }, { status: 500 });
  }
}
