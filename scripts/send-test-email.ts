import "dotenv/config";
import prisma from "../src/lib/prisma";
import { generateEmailHtml, generateEmailPlainText, sendGmail } from "../src/lib/notifications/email.service";

async function sendSingleTestEmail() {
  const targetEmail = process.env.TEST_RECIPIENT_EMAIL?.trim() || "michitaka455@gmail.com";
  const targetName = "michitaka";

  console.log(`[PENGUJIAN] Menyiapkan satu email uji coba ke: ${targetEmail}`);

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
    wargaNama: targetName,
    nomorPengajuan: "TEST-PENGUJIAN-INBOX-01",
    jenisLayanan: "Uji Validasi Notifikasi & Anti-Spam",
    statusBadgeText: "UJI COBA BERHASIL",
    statusBadgeColor: "#0F766E",
    pesanUtama: "Ini adalah email pengujian resmi setelah perbaikan konfigurasi MIME Multipart, TLS v1.2, header standar transaksional RFC 3834, serta konsistensi identitas pengirim pada Sistem Pelayanan Desa Terpadu — Asisten Desa Perum.",
    langkahBerikutnya: "Silakan periksa folder Inbox Anda. Periksa juga header email (Show original) untuk memverifikasi SPF (PASS) dan DKIM (PASS oleh Google).",
    waktuPembaruan: waktuStr,
  };

  const html = generateEmailHtml(emailParams);
  const text = generateEmailPlainText(emailParams);

  console.log("[PENGUJIAN] Mengirimkan email via Nodemailer SMTP Gmail...");
  const result = await sendGmail({
    to: targetEmail,
    recipientName: targetName,
    subject: `Notifikasi Pelayanan Desa: [UJI COBA] Pembaruan Sistem Notifikasi - ${waktuStr}`,
    html,
    text,
    event: "TEST_SIMULASI",
  });

  console.log("\n[HASIL PENGIRIMAN SMTP]:");
  console.log(`- Status        : ${result.status}`);
  console.log(`- Success       : ${result.success}`);
  console.log(`- Message ID    : ${result.messageId || "Tidak ada"}`);
  console.log(`- SMTP Response : ${result.response || "Tidak ada"}`);
  console.log(`- Accepted      : ${result.accepted?.join(", ") || "-"}`);
  console.log(`- Rejected      : ${result.rejected?.join(", ") || "None"}`);

  // Catat ke Database NotificationLog
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
      recipient: targetEmail,
      recipientName: targetName,
      subject: `Notifikasi Pelayanan Desa: [UJI COBA] Pembaruan Sistem Notifikasi - ${waktuStr}`,
      message: text,
      status: result.status,
      providerMessageId: result.messageId || null,
      errorMessage: result.error || null,
      metadata: JSON.stringify(metadataObj),
    },
  });

  console.log(`- Database Log ID: ${log.id}`);
  console.log("\n[SELESAI] Satu email pengujian berhasil diproses dan dicatat ke log.");
}

sendSingleTestEmail()
  .catch((err) => {
    console.error("Gagal mengirim email pengujian:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
