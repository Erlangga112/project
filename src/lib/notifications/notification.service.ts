import prisma from "@/lib/prisma";
import { Role, StatusPengajuan } from "@prisma/client";
import {
  BLOCKED_PLACEHOLDER_DOMAINS,
  generateEmailHtml,
  generateEmailPlainText,
  generateWelcomeEmailHtml,
  generateWelcomeEmailPlainText,
  isValidEmail,
  sendGmail,
} from "./email.service";
import { sendWhatsAppMessage } from "./whatsapp.service";
import { NotificationEventType } from "./types";
import { validateAndNormalizeIndonesianPhone } from "./phone-utils";

/**
 * Format tanggal dalam bahasa Indonesia yang ramah & baku
 */
function formatDateIndo(date: Date = new Date()): string {
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Helper untuk mendapatkan nomor WhatsApp petugas berdasarkan role
 */
async function getStaffRecipients(targetRole: Role): Promise<Array<{ userId: string; name: string; phone: string }>> {
  const recipients: Array<{ userId: string; name: string; phone: string }> = [];

  try {
    // 1. Ambil dari tabel PetugasContact di database
    const contacts = await prisma.petugasContact.findMany({
      where: {
        role: targetRole,
        isActive: true,
      },
      include: {
        user: {
          select: { id: true, nama: true, email: true },
        },
      },
    });

    for (const c of contacts) {
      if (c.noWhatsapp) {
        const val = validateAndNormalizeIndonesianPhone(c.noWhatsapp);
        if (val.isValid) {
          recipients.push({
            userId: c.userId,
            name: c.namaPetugas || c.user?.nama || targetRole,
            phone: val.formattedE164,
          });
        }
      }
    }

    // 2. Jika belum ada di PetugasContact, periksa Environment Variables fallback
    if (recipients.length === 0) {
      let envPhone: string | undefined;
      if (targetRole === Role.STAF_DESA) envPhone = process.env.WHATSAPP_STAF_PHONE;
      else if (targetRole === Role.SUPERVISOR) envPhone = process.env.WHATSAPP_SUPERVISOR_PHONE;
      else if (targetRole === Role.KEPALA_DESA) envPhone = process.env.WHATSAPP_KADES_PHONE;

      if (envPhone) {
        const val = validateAndNormalizeIndonesianPhone(envPhone);
        if (val.isValid) {
          // Cari user id petugas pertama untuk role ini
          const userPetugas = await prisma.user.findFirst({
            where: { role: targetRole },
            select: { id: true, nama: true },
          });

          recipients.push({
            userId: userPetugas?.id || "env-configured",
            name: userPetugas?.nama || targetRole,
            phone: val.formattedE164,
          });
        }
      }
    }
  } catch (error) {
    console.error("Error fetching staff recipients:", error);
  }

  return recipients;
}

/**
 * Helper untuk mendapatkan nomor WhatsApp warga pemohon
 */
function getWargaRecipient(pemohon?: {
  nama?: string | null;
  profilWarga?: { namaLengkap?: string | null; noTelepon?: string | null } | null;
  petugasContact?: { noWhatsapp?: string | null } | null;
} | null): { name: string; phone: string; formattedE164: string } | null {
  if (!pemohon) return null;
  const rawPhone = pemohon.profilWarga?.noTelepon || pemohon.petugasContact?.noWhatsapp;
  if (!rawPhone) return null;
  const val = validateAndNormalizeIndonesianPhone(rawPhone);
  if (!val.isValid) return null;
  const name = pemohon.profilWarga?.namaLengkap || pemohon.nama || "Warga Pemohon";
  return {
    name,
    phone: rawPhone,
    formattedE164: val.formattedE164,
  };
}

export class NotificationOrchestrator {
  /**
   * 0. Dipicu saat akun warga baru didaftarkan ke sistem
   */
  static async handlePendaftaranWarga(params: {
    userId: string;
    namaWarga: string;
    email: string;
  }): Promise<void> {
    const { userId, namaWarga, email } = params;
    if (!email) return;

    try {
      const waktuStr = formatDateIndo(new Date());
      const idempotencyKey = `EMAIL_${userId}_PENDAFTARAN_WARGA`;

      const welcomeParams = {
        wargaNama: namaWarga,
        email,
        tanggalDaftar: waktuStr,
      };

      const emailHtml = generateWelcomeEmailHtml(welcomeParams);
      const emailText = generateWelcomeEmailPlainText(welcomeParams);

      await this.dispatchEmail({
        to: email,
        recipientName: namaWarga,
        subject: "Notifikasi Pelayanan Desa: Akun Warga Berhasil Didaftarkan",
        html: emailHtml,
        text: emailText,
        userId,
        event: "PENDAFTARAN_WARGA",
        idempotencyKey,
      });
    } catch (error) {
      console.error("handlePendaftaranWarga failed:", error);
    }
  }

  /**
   * Helper untuk mencatat log notifikasi WhatsApp yang dilewati (misal nomor belum diisi)
   */
  static async recordSkippedWargaWhatsApp(params: {
    pengajuanId: string;
    userId: string;
    namaWarga: string;
    nomorPengajuan: string;
    layananNama: string;
    event: NotificationEventType;
    rawPhone?: string | null;
  }) {
    const { pengajuanId, userId, namaWarga, nomorPengajuan, layananNama, event, rawPhone } = params;
    const reason = !rawPhone
      ? `Nomor WhatsApp belum terdaftar di profil warga pemohon (${namaWarga}). Harap lengkapi nomor telepon seluler di profil akun warga.`
      : `Format nomor telepon warga pemohon ("${rawPhone}") tidak valid untuk nomor seluler Indonesia.`;

    const idempotencyKey = `WHATSAPP_${pengajuanId}_WARGA_NOPHONE_${event}`;
    return await prisma.notificationLog.upsert({
      where: { idempotencyKey },
      update: {
        status: "SKIPPED",
        errorMessage: reason,
        attemptCount: { increment: 1 },
      },
      create: {
        channel: "WHATSAPP",
        event,
        pengajuanId,
        userId,
        recipient: rawPhone || "TIDAK_TERSEDIA",
        recipientName: namaWarga,
        subject: `WhatsApp [${event}] Dilewati`,
        message: `Pemberitahuan ${event} untuk ${layananNama} (${nomorPengajuan}) tidak dapat dikirim via WhatsApp: ${reason}`,
        status: "SKIPPED",
        errorMessage: reason,
        idempotencyKey,
      },
    });
  }

  /**
   * 1. Dipicu saat warga baru saja mengirim pengajuan (status: DIAJUKAN)
   */
  static async handlePengajuanBaru(pengajuanId: string): Promise<void> {
    try {
      const pengajuan = await prisma.pengajuanLayanan.findUnique({
        where: { id: pengajuanId },
        include: {
          pemohon: { include: { profilWarga: true, petugasContact: true } },
          jenisLayanan: true,
        },
      });

      if (!pengajuan) return;

      const namaWarga = pengajuan.pemohon.profilWarga?.namaLengkap || pengajuan.pemohon.nama || "Warga Pemohon";
      const emailWarga = pengajuan.pemohon.email;
      const nomorPengajuan = pengajuan.nomorPengajuan;
      const layananNama = pengajuan.jenisLayanan.nama;
      const waktuStr = formatDateIndo(pengajuan.createdAt);

      // ── A. Kirim WhatsApp ke Warga Pemohon ───────────────────────────────────
      const wargaRecipient = getWargaRecipient(pengajuan.pemohon);
      if (wargaRecipient) {
        const idempotencyKey = `WHATSAPP_${pengajuanId}_WARGA_${wargaRecipient.formattedE164}_PENGAJUAN_BARU`;
        const waMessage =
          `*PEMBERITAHUAN PELAYANAN DESA*\n` +
          `Sistem Pelayanan Desa Terpadu — Asisten Desa Perum\n` +
          `-----------------------------------------\n` +
          `Assalamu'alaikum, Bapak/Ibu *${namaWarga}*.\n\n` +
          `Pengajuan permohonan surat *${layananNama}* Anda telah berhasil diterima ke dalam sistem:\n` +
          `• No. Registrasi: *${nomorPengajuan}*\n` +
          `• Jenis Layanan: *${layananNama}*\n` +
          `• Status: *Menunggu Pemeriksaan Berkas*\n` +
          `• Waktu: ${waktuStr}\n\n` +
          `Petugas staf desa akan segera memeriksa kelengkapan dokumen persyaratan Anda. Pantau status pengajuan secara berkala melalui portal web pelayanan desa.\n\n` +
          `_Pesan resmi otomatis Sistem Pelayanan Desa Terpadu._`;

        await this.dispatchWhatsApp({
          to: wargaRecipient.formattedE164,
          recipientName: namaWarga,
          message: waMessage,
          pengajuanId,
          userId: pengajuan.pemohonId,
          role: Role.WARGA,
          event: "PENGAJUAN_BARU",
          idempotencyKey,
        });
      } else {
        await this.recordSkippedWargaWhatsApp({
          pengajuanId,
          userId: pengajuan.pemohonId,
          namaWarga,
          nomorPengajuan,
          layananNama,
          event: "PENGAJUAN_BARU",
          rawPhone: pengajuan.pemohon.profilWarga?.noTelepon || pengajuan.pemohon.petugasContact?.noWhatsapp,
        });
      }

      // ── B. Kirim Gmail ke Warga ─────────────────────────────────────────────
      const idempotencyKey = `EMAIL_${pengajuanId}_PENGAJUAN_BARU`;
      const emailParams = {
        wargaNama: namaWarga,
        nomorPengajuan,
        jenisLayanan: layananNama,
        statusBadgeText: "DIAJUKAN",
        statusBadgeColor: "#2563EB",
        pesanUtama: `Pengajuan layanan <strong>${layananNama}</strong> Anda telah berhasil kami terima dalam sistem. Petugas staf desa akan segera memeriksa kelengkapan berkas Anda.`,
        langkahBerikutnya: "Silakan pantau status pengajuan ini secara berkala melalui akun Anda di portal Pelayanan Desa Terpadu.",
        waktuPembaruan: waktuStr,
      };
      const emailHtml = generateEmailHtml(emailParams);
      const emailText = generateEmailPlainText(emailParams);

      await this.dispatchEmail({
        to: emailWarga || "",
        recipientName: namaWarga,
        subject: `Notifikasi Pelayanan Desa: Pengajuan Diterima [${nomorPengajuan}] - ${layananNama}`,
        html: emailHtml,
        text: emailText,
        pengajuanId,
        userId: pengajuan.pemohonId,
        event: "PENGAJUAN_BARU",
        idempotencyKey,
      });

      // ── C. Kirim WhatsApp ke Staf Desa / Operator ───────────────────────────
      const stafRecipients = await getStaffRecipients(Role.STAF_DESA);
      for (const staf of stafRecipients) {
        const idempotencyKey = `WHATSAPP_${pengajuanId}_STAF_${staf.phone}_PENGAJUAN_BARU`;
        const waMessage = `[PENGAJUAN BARU]\n` +
          `Nomor pengajuan: ${nomorPengajuan}\n` +
          `Layanan: ${layananNama}\n` +
          `Pemohon: ${namaWarga}\n` +
          `Status: Menunggu verifikasi berkas\n` +
          `Waktu: ${waktuStr}\n\n` +
          `Silakan buka sistem pelayanan desa untuk memeriksa kelengkapan dokumen sesuai hak akses Anda.`;

        await this.dispatchWhatsApp({
          to: staf.phone,
          recipientName: staf.name,
          message: waMessage,
          pengajuanId,
          userId: staf.userId,
          role: Role.STAF_DESA,
          event: "PENGAJUAN_BARU",
          idempotencyKey,
        });
      }

      // ── D. Notifikasi Web In-App ke Seluruh Staf Desa ───────────────────────
      try {
        const staffUsers = await prisma.user.findMany({
          where: { role: Role.STAF_DESA },
          select: { id: true },
        });
        for (const s of staffUsers) {
          await prisma.notification.create({
            data: {
              userId: s.id,
              title: "Pengajuan Layanan Baru",
              message: `${namaWarga} mengajukan ${layananNama} (${nomorPengajuan}). Menunggu pemeriksaan berkas.`,
              type: "INFO",
              link: "/staf/pengajuan",
            },
          });
        }
      } catch (err) {
        console.warn("Gagal membuat notifikasi web in-app untuk staf:", err);
      }
    } catch (error) {
      console.error("handlePengajuanBaru failed:", error);
    }
  }

  /**
   * 2. Dipicu saat status pengajuan berubah (DIPERIKSA, PERLU_PERBAIKAN, MENUNGGU_VALIDASI, dll)
   */
  static async handleStatusChange(params: {
    pengajuanId: string;
    newStatus: StatusPengajuan;
    catatan?: string | null;
  }): Promise<void> {
    const { pengajuanId, newStatus, catatan } = params;

    try {
      const pengajuan = await prisma.pengajuanLayanan.findUnique({
        where: { id: pengajuanId },
        include: {
          pemohon: { include: { profilWarga: true, petugasContact: true } },
          jenisLayanan: true,
        },
      });

      if (!pengajuan) return;

      const namaWarga = pengajuan.pemohon.profilWarga?.namaLengkap || pengajuan.pemohon.nama || "Warga Pemohon";
      const emailWarga = pengajuan.pemohon.email;
      const nomorPengajuan = pengajuan.nomorPengajuan;
      const layananNama = pengajuan.jenisLayanan.nama;
      const waktuStr = formatDateIndo(new Date());
      const wargaRecipient = getWargaRecipient(pengajuan.pemohon);
      const portalUrl = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");

      // Hitung perulangan event untuk idempotensi deterministik tanpa Date.now()
      const passCount = await prisma.logPengajuan.count({
        where: { pengajuanId, statusAfter: newStatus },
      });
      const countSuffix = passCount > 1 ? `_${passCount}` : "";

      // ── 1. DIPERIKSA ────────────────────────────────────────────────────────
      if (newStatus === "DIPERIKSA") {
        // WhatsApp ke Warga (Tahap 1 — Staf Desa)
        if (wargaRecipient) {
          const idempotencyKey = `WHATSAPP_${pengajuanId}_WARGA_${wargaRecipient.formattedE164}_DIPERIKSA${countSuffix}`;
          const waMessage =
            `*STATUS PENGAJUAN: SEDANG DIPERIKSA*\n` +
            `Sistem Pelayanan Desa Terpadu — Asisten Desa Perum\n` +
            `-----------------------------------------\n` +
            `Assalamu'alaikum, Bapak/Ibu *${namaWarga}*.\n\n` +
            `Pengajuan surat *${layananNama}* Anda telah diterima oleh Staf Desa dan sedang dalam proses pemeriksaan.\n\n` +
            `• No. Registrasi: *${nomorPengajuan}*\n` +
            `• Status: *Sedang Diperiksa Staf Desa*\n` +
            `• Waktu: ${waktuStr}\n` +
            `${catatan ? `• Catatan Petugas: ${catatan}\n` : ""}\n` +
            `Anda akan menerima pemberitahuan berikutnya setelah pemeriksaan dan verifikasi dokumen selesai dilakukan. Terima kasih atas kesabaran Anda.\n\n` +
            `_Pesan resmi otomatis Sistem Pelayanan Desa Terpadu._`;

          await this.dispatchWhatsApp({
            to: wargaRecipient.formattedE164,
            recipientName: namaWarga,
            message: waMessage,
            pengajuanId,
            userId: pengajuan.pemohonId,
            role: Role.WARGA,
            event: "DIPERIKSA",
            idempotencyKey,
          });
        } else {
          await this.recordSkippedWargaWhatsApp({
            pengajuanId,
            userId: pengajuan.pemohonId,
            namaWarga,
            nomorPengajuan,
            layananNama,
            event: "DIPERIKSA",
            rawPhone: pengajuan.pemohon.profilWarga?.noTelepon || pengajuan.pemohon.petugasContact?.noWhatsapp,
          });
        }

        // Email ke Warga
        const idempotencyKey = `EMAIL_${pengajuanId}_DIPERIKSA${countSuffix}`;
        const emailParams = {
          wargaNama: namaWarga,
          nomorPengajuan,
          jenisLayanan: layananNama,
          statusBadgeText: "SEDANG DIPERIKSA",
          statusBadgeColor: "#0D9488",
          pesanUtama: `Pengajuan layanan <strong>${layananNama}</strong> Anda saat ini sedang dalam proses pemeriksaan dan verifikasi berkas oleh staf desa.`,
          catatanPetugas: catatan,
          langkahBerikutnya: "Mohon menunggu verifikasi berkas. Anda akan menerima notifikasi jika berkas disetujui atau memerlukan perbaikan.",
          waktuPembaruan: waktuStr,
        };
        const emailHtml = generateEmailHtml(emailParams);
        const emailText = generateEmailPlainText(emailParams);

        await this.dispatchEmail({
          to: emailWarga || "",
          recipientName: namaWarga,
          subject: `Notifikasi Pelayanan Desa: Berkas Sedang Diperiksa [${nomorPengajuan}] - ${layananNama}`,
          html: emailHtml,
          text: emailText,
          pengajuanId,
          userId: pengajuan.pemohonId,
          event: "DIPERIKSA",
          idempotencyKey,
        });
      }

      // ── 2. PERLU_PERBAIKAN ──────────────────────────────────────────────────
      else if (newStatus === "PERLU_PERBAIKAN") {
        // WhatsApp ke Warga (Tahap 4 — Dikembalikan: kirim alasan & instruksi perbaikan)
        if (wargaRecipient) {
          const idempotencyKey = `WHATSAPP_${pengajuanId}_WARGA_${wargaRecipient.formattedE164}_PERLU_PERBAIKAN${countSuffix}`;
          const waMessage =
            `*PERHATIAN: PENGEMBALIAN & PERBAIKAN BERKAS*\n` +
            `Sistem Pelayanan Desa Terpadu — Asisten Desa Perum\n` +
            `-----------------------------------------\n` +
            `Assalamu'alaikum, Bapak/Ibu *${namaWarga}*.\n\n` +
            `Pengajuan surat *${layananNama}* Anda (*${nomorPengajuan}*) dikembalikan karena memerlukan perbaikan atau dokumen pendukung tambahan.\n\n` +
            `📌 *Alasan & Catatan Perbaikan:*\n` +
            `${catatan || "Terdapat lampiran berkas persyaratan yang belum lengkap atau belum sesuai ketentuan."}\n\n` +
            `📝 *Instruksi Perbaikan:*\n` +
            `Silakan segera masuk ke portal Pelayanan Desa Terpadu dan unggah kembali dokumen perbaikan yang diminta:\n` +
            `${portalUrl}/warga/pengajuan/${pengajuanId}\n\n` +
            `• Waktu: ${waktuStr}\n\n` +
            `Setelah berkas perbaikan diunggah, petugas kami akan segera memproses kembali permohonan Anda. Terima kasih.\n\n` +
            `_Pesan resmi otomatis Sistem Pelayanan Desa Terpadu._`;

          await this.dispatchWhatsApp({
            to: wargaRecipient.formattedE164,
            recipientName: namaWarga,
            message: waMessage,
            pengajuanId,
            userId: pengajuan.pemohonId,
            role: Role.WARGA,
            event: "PERLU_PERBAIKAN",
            idempotencyKey,
          });
        } else {
          await this.recordSkippedWargaWhatsApp({
            pengajuanId,
            userId: pengajuan.pemohonId,
            namaWarga,
            nomorPengajuan,
            layananNama,
            event: "PERLU_PERBAIKAN",
            rawPhone: pengajuan.pemohon.profilWarga?.noTelepon || pengajuan.pemohon.petugasContact?.noWhatsapp,
          });
        }

        // Email ke Warga
        const idempotencyKey = `EMAIL_${pengajuanId}_PERLU_PERBAIKAN${countSuffix}`;
        const emailParams = {
          wargaNama: namaWarga,
          nomorPengajuan,
          jenisLayanan: layananNama,
          statusBadgeText: "PERLU PERBAIKAN",
          statusBadgeColor: "#D97706",
          pesanUtama: `Berkas pengajuan <strong>${layananNama}</strong> Anda memerlukan perbaikan atau dokumen tambahan agar dapat diproses lebih lanjut.`,
          catatanPetugas: catatan || "Ada dokumen yang belum sesuai persyaratan. Silakan periksa detail pada portal.",
          langkahBerikutnya: "Segera masuk ke portal Pelayanan Desa Terpadu dan unggah kembali dokumen yang diminta.",
          waktuPembaruan: waktuStr,
        };
        const emailHtml = generateEmailHtml(emailParams);
        const emailText = generateEmailPlainText(emailParams);

        await this.dispatchEmail({
          to: emailWarga || "",
          recipientName: namaWarga,
          subject: `Notifikasi Pelayanan Desa: Perlu Perbaikan Berkas [${nomorPengajuan}] - ${layananNama}`,
          html: emailHtml,
          text: emailText,
          pengajuanId,
          userId: pengajuan.pemohonId,
          event: "PERLU_PERBAIKAN",
          idempotencyKey,
        });
      }

      // ── 3. MENUNGGU_VALIDASI (Diteruskan ke Supervisor) ─────────────────────
      else if (newStatus === "MENUNGGU_VALIDASI") {
        // WhatsApp ke Warga (Tahap 2 — Supervisor: Diteruskan ke Supervisor)
        if (wargaRecipient) {
          const idempotencyKey = `WHATSAPP_${pengajuanId}_WARGA_${wargaRecipient.formattedE164}_MENUNGGU_VALIDASI${countSuffix}`;
          const waMessage =
            `*STATUS PENGAJUAN: MENUNGGU VALIDASI*\n` +
            `Sistem Pelayanan Desa Terpadu — Asisten Desa Perum\n` +
            `-----------------------------------------\n` +
            `Assalamu'alaikum, Bapak/Ibu *${namaWarga}*.\n\n` +
            `Pengajuan surat *${layananNama}* Anda telah diteruskan kepada Supervisor untuk proses validasi.\n\n` +
            `• No. Registrasi: *${nomorPengajuan}*\n` +
            `• Status: *Menunggu Validasi Supervisor*\n` +
            `• Waktu: ${waktuStr}\n` +
            `${catatan ? `• Catatan Petugas: ${catatan}\n` : ""}\n` +
            `Sistem akan memberi tahu Anda kembali hasil validasi setelah proses peninjauan selesai. Terima kasih.\n\n` +
            `_Pesan resmi otomatis Sistem Pelayanan Desa Terpadu._`;

          await this.dispatchWhatsApp({
            to: wargaRecipient.formattedE164,
            recipientName: namaWarga,
            message: waMessage,
            pengajuanId,
            userId: pengajuan.pemohonId,
            role: Role.WARGA,
            event: "MENUNGGU_VALIDASI",
            idempotencyKey,
          });
        } else {
          await this.recordSkippedWargaWhatsApp({
            pengajuanId,
            userId: pengajuan.pemohonId,
            namaWarga,
            nomorPengajuan,
            layananNama,
            event: "MENUNGGU_VALIDASI",
            rawPhone: pengajuan.pemohon.profilWarga?.noTelepon || pengajuan.pemohon.petugasContact?.noWhatsapp,
          });
        }

        // WhatsApp ke Supervisor
        const supervisorRecipients = await getStaffRecipients(Role.SUPERVISOR);
        for (const spv of supervisorRecipients) {
          const idempotencyKey = `WHATSAPP_${pengajuanId}_SPV_${spv.phone}_MENUNGGU_VALIDASI${countSuffix}`;
          const waMessage = `[VALIDASI PENGAJUAN]\n` +
            `Nomor pengajuan: ${nomorPengajuan}\n` +
            `Layanan: ${layananNama}\n` +
            `Status: Menunggu validasi Supervisor\n` +
            `Catatan staf: ${catatan || "-"}\n` +
            `Waktu: ${waktuStr}\n\n` +
            `Silakan buka sistem pelayanan desa untuk memeriksa dan memberikan validasi pengajuan ini.`;

          await this.dispatchWhatsApp({
            to: spv.phone,
            recipientName: spv.name,
            message: waMessage,
            pengajuanId,
            userId: spv.userId,
            role: Role.SUPERVISOR,
            event: "MENUNGGU_VALIDASI",
            idempotencyKey,
          });
        }

        // In-App Notification ke Supervisor di Web
        try {
          const spvUsers = await prisma.user.findMany({
            where: { role: Role.SUPERVISOR },
            select: { id: true },
          });
          for (const spv of spvUsers) {
            await prisma.notification.create({
              data: {
                userId: spv.id,
                title: "Validasi Pengajuan Diperlukan",
                message: `Pengajuan ${layananNama} (${nomorPengajuan}) dari ${namaWarga} menunggu validasi Supervisor.`,
                type: "WARNING",
                link: `/supervisor/pengajuan`,
              },
            });
          }
        } catch (err) {
          console.warn("Gagal membuat notifikasi web in-app untuk supervisor:", err);
        }
      }

      // ── 4. MENUNGGU_APPROVAL_KEPALA_DESA (SAAT VALIDASI SUPERVISOR DISETUJUI) ─────────────
      else if (newStatus === "MENUNGGU_APPROVAL_KEPALA_DESA") {
        // WhatsApp ke Warga (Tahap 2 & 3 — Hasil validasi Supervisor & diteruskan ke Kepala Desa)
        if (wargaRecipient) {
          const idempotencyKey = `WHATSAPP_${pengajuanId}_WARGA_${wargaRecipient.formattedE164}_VALIDASI_APPROVED${countSuffix}`;
          const waMessage =
            `*VALIDASI SELESAI & DITERUSKAN KE KEPALA DESA*\n` +
            `Sistem Pelayanan Desa Terpadu — Asisten Desa Perum\n` +
            `-----------------------------------------\n` +
            `Assalamu'alaikum, Bapak/Ibu *${namaWarga}*.\n\n` +
            `Pengajuan surat *${layananNama}* Anda (*${nomorPengajuan}*) telah selesai divalidasi oleh Supervisor dengan hasil: *Divalidasi & Disetujui*.\n\n` +
            `Pengajuan surat *${layananNama}* Anda telah diteruskan kepada Kepala Desa untuk proses persetujuan.\n\n` +
            `• Status: *Menunggu Persetujuan Kepala Desa*\n` +
            `• Waktu Validasi: ${waktuStr}\n` +
            `${catatan ? `• Catatan Supervisor: ${catatan}\n` : ""}\n` +
            `Anda akan menerima pemberitahuan otomatis segera setelah Kepala Desa memberikan keputusan resmi. Terima kasih.\n\n` +
            `_Pesan resmi otomatis Sistem Pelayanan Desa Terpadu._`;

          await this.dispatchWhatsApp({
            to: wargaRecipient.formattedE164,
            recipientName: namaWarga,
            message: waMessage,
            pengajuanId,
            userId: pengajuan.pemohonId,
            role: Role.WARGA,
            event: "MENUNGGU_APPROVAL_KADES",
            idempotencyKey,
          });
        } else {
          await this.recordSkippedWargaWhatsApp({
            pengajuanId,
            userId: pengajuan.pemohonId,
            namaWarga,
            nomorPengajuan,
            layananNama,
            event: "MENUNGGU_APPROVAL_KADES",
            rawPhone: pengajuan.pemohon.profilWarga?.noTelepon || pengajuan.pemohon.petugasContact?.noWhatsapp,
          });
        }

        // Email ke Warga
        const idempotencyKey = `EMAIL_${pengajuanId}_VALIDASI_APPROVED${countSuffix}`;
        const emailParams = {
          wargaNama: namaWarga,
          nomorPengajuan,
          jenisLayanan: layananNama,
          statusBadgeText: "VALIDASI DISETUJUI",
          statusBadgeColor: "#4F46E5",
          pesanUtama: `Pengajuan layanan <strong>${layananNama}</strong> Anda telah berhasil divalidasi oleh Supervisor Desa dan saat ini sedang menunggu persetujuan akhir Kepala Desa.`,
          catatanPetugas: catatan,
          langkahBerikutnya: "Menunggu peninjauan dan persetujuan Kepala Desa.",
          waktuPembaruan: waktuStr,
        };
        const emailHtml = generateEmailHtml(emailParams);
        const emailText = generateEmailPlainText(emailParams);

        await this.dispatchEmail({
          to: emailWarga || "",
          recipientName: namaWarga,
          subject: `Notifikasi Pelayanan Desa: Validasi Disetujui [${nomorPengajuan}] - ${layananNama}`,
          html: emailHtml,
          text: emailText,
          pengajuanId,
          userId: pengajuan.pemohonId,
          event: "MENUNGGU_APPROVAL_KADES",
          idempotencyKey,
        });

        // WhatsApp ke Kepala Desa
        const kadesRecipients = await getStaffRecipients(Role.KEPALA_DESA);
        for (const kades of kadesRecipients) {
          const idempotencyKey = `WHATSAPP_${pengajuanId}_KADES_${kades.phone}_APPROVAL${countSuffix}`;
          const waMessage = `[PERMOHONAN PERSETUJUAN KEPALA DESA]\n` +
            `Nomor pengajuan: ${nomorPengajuan}\n` +
            `Layanan: ${layananNama}\n` +
            `Pemohon: ${namaWarga}\n` +
            `Status: Telah diverifikasi & menunggu keputusan persetujuan Kepala Desa\n` +
            `Waktu: ${waktuStr}\n\n` +
            `Silakan buka sistem pelayanan desa untuk meninjau dan menandatangani/menyetujui permohonan surat.`;

          await this.dispatchWhatsApp({
            to: kades.phone,
            recipientName: kades.name,
            message: waMessage,
            pengajuanId,
            userId: kades.userId,
            role: Role.KEPALA_DESA,
            event: "MENUNGGU_APPROVAL_KADES",
            idempotencyKey,
          });
        }

        // In-App Notification ke Kepala Desa di Web
        try {
          const kadesUsers = await prisma.user.findMany({
            where: { role: Role.KEPALA_DESA },
            select: { id: true },
          });
          for (const kd of kadesUsers) {
            await prisma.notification.create({
              data: {
                userId: kd.id,
                title: "Permohonan Persetujuan Kades",
                message: `Pengajuan ${layananNama} (${nomorPengajuan}) dari ${namaWarga} telah divalidasi dan menunggu persetujuan Kepala Desa.`,
                type: "WARNING",
                link: `/kades/pengajuan`,
              },
            });
          }
        } catch (err) {
          console.warn("Gagal membuat notifikasi web in-app untuk kades:", err);
        }
      }

      // ── 5. DISETUJUI ────────────────────────────────────────────────────────
      else if (newStatus === "DISETUJUI") {
        // WhatsApp ke Warga (Tahap 4 — Disetujui: kirim pemberitahuan disetujui)
        if (wargaRecipient) {
          const idempotencyKey = `WHATSAPP_${pengajuanId}_WARGA_${wargaRecipient.formattedE164}_DISETUJUI${countSuffix}`;
          const waMessage =
            `*KABAR BAIK: PENGAJUAN DISETUJUI KEPALA DESA*\n` +
            `Sistem Pelayanan Desa Terpadu — Asisten Desa Perum\n` +
            `-----------------------------------------\n` +
            `Assalamu'alaikum, Bapak/Ibu *${namaWarga}*.\n\n` +
            `Pemberitahuan: Pengajuan surat *${layananNama}* Anda (*${nomorPengajuan}*) telah *DISETUJUI* oleh Kepala Desa.\n\n` +
            `• Keputusan: *DISETUJUI*\n` +
            `• Waktu Persetujuan: ${waktuStr}\n` +
            `${catatan ? `• Catatan Kepala Desa: ${catatan}\n` : ""}\n` +
            `• Tahap Berikutnya: Penerbitan nomor surat resmi oleh staf pelayanan desa.\n\n` +
            `Setelah nomor surat resmi diterbitkan oleh staf desa, surat resmi format PDF akan langsung tersedia untuk diunduh dan dicetak melalui website. Terima kasih.\n\n` +
            `_Pesan resmi otomatis Sistem Pelayanan Desa Terpadu._`;

          await this.dispatchWhatsApp({
            to: wargaRecipient.formattedE164,
            recipientName: namaWarga,
            message: waMessage,
            pengajuanId,
            userId: pengajuan.pemohonId,
            role: Role.WARGA,
            event: "DISETUJUI",
            idempotencyKey,
          });
        } else {
          await this.recordSkippedWargaWhatsApp({
            pengajuanId,
            userId: pengajuan.pemohonId,
            namaWarga,
            nomorPengajuan,
            layananNama,
            event: "DISETUJUI",
            rawPhone: pengajuan.pemohon.profilWarga?.noTelepon || pengajuan.pemohon.petugasContact?.noWhatsapp,
          });
        }

        // Notifikasi Gmail ke Warga
        const idempotencyKey = `EMAIL_${pengajuanId}_DISETUJUI${countSuffix}`;
        const emailParams = {
          wargaNama: namaWarga,
          nomorPengajuan,
          jenisLayanan: layananNama,
          statusBadgeText: "DISETUJUI",
          statusBadgeColor: "#16A34A",
          pesanUtama: `Kabar baik! Pengajuan layanan <strong>${layananNama}</strong> Anda telah disetujui oleh Kepala Desa. Surat resmi sedang dalam tahap penerbitan nomor surat.`,
          catatanPetugas: catatan,
          langkahBerikutnya: "Setelah nomor surat resmi diterbitkan oleh staf desa, Anda akan menerima pemberitahuan bahwa surat siap diunduh.",
          waktuPembaruan: waktuStr,
        };
        const emailHtml = generateEmailHtml(emailParams);
        const emailText = generateEmailPlainText(emailParams);

        await this.dispatchEmail({
          to: emailWarga || "",
          recipientName: namaWarga,
          subject: `Notifikasi Pelayanan Desa: Pengajuan Disetujui [${nomorPengajuan}] - ${layananNama}`,
          html: emailHtml,
          text: emailText,
          pengajuanId,
          userId: pengajuan.pemohonId,
          event: "DISETUJUI",
          idempotencyKey,
        });

        // Notifikasi WhatsApp ke Staf Desa agar menerbitkan nomor surat
        const stafRecipients = await getStaffRecipients(Role.STAF_DESA);
        for (const staf of stafRecipients) {
          const idempotencyKey = `WHATSAPP_${pengajuanId}_STAF_${staf.phone}_DISETUJUI${countSuffix}`;
          const waMessage = `[PENGAJUAN TELAH DISETUJUI]\n` +
            `Nomor pengajuan: ${nomorPengajuan}\n` +
            `Layanan: ${layananNama}\n` +
            `Pemohon: ${namaWarga}\n` +
            `Status: Disetujui Kepala Desa\n` +
            `Waktu: ${waktuStr}\n\n` +
            `Silakan buka sistem pelayanan desa untuk menerbitkan nomor surat resmi agar pelayanan selesai.`;

          await this.dispatchWhatsApp({
            to: staf.phone,
            recipientName: staf.name,
            message: waMessage,
            pengajuanId,
            userId: staf.userId,
            role: Role.STAF_DESA,
            event: "DISETUJUI",
            idempotencyKey,
          });
        }

        // In-App Notification ke Staf Desa di Web
        try {
          const staffUsers = await prisma.user.findMany({
            where: { role: Role.STAF_DESA },
            select: { id: true },
          });
          for (const s of staffUsers) {
            await prisma.notification.create({
              data: {
                userId: s.id,
                title: "Pengajuan Telah Disetujui",
                message: `Pengajuan ${layananNama} (${nomorPengajuan}) disetujui Kepala Desa. Silakan terbitkan nomor surat resmi.`,
                type: "SUCCESS",
                link: `/staf/pengajuan`,
              },
            });
          }
        } catch (err) {
          console.warn("Gagal membuat notifikasi web in-app untuk staf:", err);
        }
      }

      // ── 6. DITOLAK ──────────────────────────────────────────────────────────
      else if (newStatus === "DITOLAK") {
        // WhatsApp ke Warga (Tahap 4 — Ditolak: kirim alasan penolakan)
        if (wargaRecipient) {
          const idempotencyKey = `WHATSAPP_${pengajuanId}_WARGA_${wargaRecipient.formattedE164}_DITOLAK${countSuffix}`;
          const waMessage =
            `*PEMBERITAHUAN: PENGAJUAN DITOLAK*\n` +
            `Sistem Pelayanan Desa Terpadu — Asisten Desa Perum\n` +
            `-----------------------------------------\n` +
            `Assalamu'alaikum, Bapak/Ibu *${namaWarga}*.\n\n` +
            `Mohon maaf, pengajuan surat *${layananNama}* Anda (*${nomorPengajuan}*) *DITOLAK* dan tidak dapat disetujui.\n\n` +
            `📌 *Alasan Penolakan:*\n` +
            `${catatan || "Kriteria administratif atau persyaratan pelayanan belum memenuhi ketentuan regulasi yang berlaku."}\n\n` +
            `• Waktu Keputusan: ${waktuStr}\n\n` +
            `Untuk informasi lebih lanjut, silakan berkonsultasi langsung dengan petugas kantor pelayanan desa pada hari dan jam kerja. Terima kasih.\n\n` +
            `_Pesan resmi otomatis Sistem Pelayanan Desa Terpadu._`;

          await this.dispatchWhatsApp({
            to: wargaRecipient.formattedE164,
            recipientName: namaWarga,
            message: waMessage,
            pengajuanId,
            userId: pengajuan.pemohonId,
            role: Role.WARGA,
            event: "DITOLAK",
            idempotencyKey,
          });
        } else {
          await this.recordSkippedWargaWhatsApp({
            pengajuanId,
            userId: pengajuan.pemohonId,
            namaWarga,
            nomorPengajuan,
            layananNama,
            event: "DITOLAK",
            rawPhone: pengajuan.pemohon.profilWarga?.noTelepon || pengajuan.pemohon.petugasContact?.noWhatsapp,
          });
        }

        // Email ke Warga
        const idempotencyKey = `EMAIL_${pengajuanId}_DITOLAK${countSuffix}`;
        const emailParams = {
          wargaNama: namaWarga,
          nomorPengajuan,
          jenisLayanan: layananNama,
          statusBadgeText: "DITOLAK",
          statusBadgeColor: "#DC2626",
          pesanUtama: `Mohon maaf, pengajuan layanan <strong>${layananNama}</strong> Anda tidak dapat disetujui.`,
          catatanPetugas: catatan || "Persyaratan atau kriteria pelayanan belum terpenuhi.",
          langkahBerikutnya: "Silakan konsultasikan dengan kantor desa atau ajukan permohonan baru setelah memenuhi kriteria yang ditentukan.",
          waktuPembaruan: waktuStr,
        };
        const emailHtml = generateEmailHtml(emailParams);
        const emailText = generateEmailPlainText(emailParams);

        await this.dispatchEmail({
          to: emailWarga || "",
          recipientName: namaWarga,
          subject: `Notifikasi Pelayanan Desa: Status Pengajuan Ditolak [${nomorPengajuan}] - ${layananNama}`,
          html: emailHtml,
          text: emailText,
          pengajuanId,
          userId: pengajuan.pemohonId,
          event: "DITOLAK",
          idempotencyKey,
        });
      }
    } catch (error) {
      console.error("handleStatusChange failed:", error);
    }
  }

  /**
   * 3. Dipicu saat surat resmi diterbitkan (status: SELESAI)
   */
  static async handleSuratSelesai(params: {
    pengajuanId: string;
    nomorSurat: string;
  }): Promise<void> {
    const { pengajuanId, nomorSurat } = params;

    try {
      const pengajuan = await prisma.pengajuanLayanan.findUnique({
        where: { id: pengajuanId },
        include: {
          pemohon: { include: { profilWarga: true, petugasContact: true } },
          jenisLayanan: true,
        },
      });

      if (!pengajuan) return;

      const namaWarga = pengajuan.pemohon.profilWarga?.namaLengkap || pengajuan.pemohon.nama || "Warga Pemohon";
      const emailWarga = pengajuan.pemohon.email;
      const nomorPengajuan = pengajuan.nomorPengajuan;
      const layananNama = pengajuan.jenisLayanan.nama;
      const waktuStr = formatDateIndo(new Date());
      const wargaRecipient = getWargaRecipient(pengajuan.pemohon);
      const portalUrl = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");

      // ── A. WhatsApp ke Warga Pemohon (Tahap 4 — Surat PDF siap diunduh & dicetak) ──────
      if (wargaRecipient) {
        const idempotencyKey = `WHATSAPP_${pengajuanId}_WARGA_${wargaRecipient.formattedE164}_SELESAI`;
        const waMessage =
          `*SURAT RESMI TELAH SELESAI DITERBITKAN*\n` +
          `Sistem Pelayanan Desa Terpadu — Asisten Desa Perum\n` +
          `-----------------------------------------\n` +
          `Assalamu'alaikum, Bapak/Ibu *${namaWarga}*.\n\n` +
          `Kabar baik! Pengajuan surat *${layananNama}* Anda telah selesai diproses dan surat resmi telah diterbitkan secara sah.\n\n` +
          `Surat PDF sudah tersedia untuk diunduh dan dicetak melalui website portal Pelayanan Desa Terpadu:\n` +
          `• Nomor Surat Resmi: *${nomorSurat}*\n` +
          `• No. Registrasi: *${nomorPengajuan}*\n` +
          `• Tanggal Selesai: ${waktuStr}\n\n` +
          `🔗 *Unduh & Cetak Surat PDF:*\n` +
          `${portalUrl}/warga/pengajuan/${pengajuanId}\n\n` +
          `Anda juga dapat mengambil lembar fisik dokumen resmi di loket kantor desa pada jam pelayanan kerja apabila membutuhkan cap basah.\n\n` +
          `Terima kasih telah menggunakan Sistem Pelayanan Desa Terpadu.\n` +
          `_Pesan resmi otomatis Sistem Pelayanan Desa Terpadu._`;

        await this.dispatchWhatsApp({
          to: wargaRecipient.formattedE164,
          recipientName: namaWarga,
          message: waMessage,
          pengajuanId,
          userId: pengajuan.pemohonId,
          role: Role.WARGA,
          event: "SELESAI",
          idempotencyKey,
        });
      } else {
        await this.recordSkippedWargaWhatsApp({
          pengajuanId,
          userId: pengajuan.pemohonId,
          namaWarga,
          nomorPengajuan,
          layananNama,
          event: "SELESAI",
          rawPhone: pengajuan.pemohon.profilWarga?.noTelepon || pengajuan.pemohon.petugasContact?.noWhatsapp,
        });
      }

      // ── B. Email ke Warga Pemohon ───────────────────────────────────────────
      const idempotencyKey = `EMAIL_${pengajuanId}_SELESAI`;
      const emailParams = {
        wargaNama: namaWarga,
        nomorPengajuan,
        jenisLayanan: layananNama,
        statusBadgeText: "SELESAI",
        statusBadgeColor: "#059669",
        pesanUtama: `Surat permohonan <strong>${layananNama}</strong> Anda telah selesai diproses dan diterbitkan dengan Nomor Surat: <strong>${nomorSurat}</strong>.`,
        langkahBerikutnya: "Silakan masuk ke portal Pelayanan Desa Terpadu untuk mengunduh dan mencetak dokumen surat resmi Anda, atau ambil dokumen fisik di loket kantor desa jika diperlukan.",
        waktuPembaruan: waktuStr,
      };
      const emailHtml = generateEmailHtml(emailParams);
      const emailText = generateEmailPlainText(emailParams);

      await this.dispatchEmail({
        to: emailWarga || "",
        recipientName: namaWarga,
        subject: `Notifikasi Pelayanan Desa: Surat Selesai Diterbitkan [${nomorPengajuan}] - ${layananNama}`,
        html: emailHtml,
        text: emailText,
        pengajuanId,
        userId: pengajuan.pemohonId,
        event: "SELESAI",
        idempotencyKey,
      });

      // ── C. In-App Notification ke Warga Pemohon di Web ─────────────────────
      try {
        await prisma.notification.create({
          data: {
            userId: pengajuan.pemohonId,
            title: "Surat Resmi Selesai Diterbitkan",
            message: `Surat permohonan ${layananNama} (${nomorPengajuan}) telah diterbitkan dengan Nomor: ${nomorSurat}. Dokumen dapat diunduh sekarang.`,
            type: "SUCCESS",
            link: `/warga/pengajuan/${pengajuanId}`,
          },
        });
      } catch (err) {
        console.warn("Gagal membuat notifikasi web in-app untuk warga:", err);
      }
    } catch (error) {
      console.error("handleSuratSelesai failed:", error);
    }
  }

  /**
   * Pengiriman Email terpusat dengan mekanisme Idempotensi & Logging
   */
  static async dispatchEmail(params: {
    to: string;
    recipientName?: string;
    subject: string;
    html: string;
    text?: string;
    pengajuanId?: string;
    userId?: string;
    event: NotificationEventType;
    idempotencyKey: string;
  }) {
    const { to, recipientName, subject, html, text, pengajuanId, userId, event, idempotencyKey } = params;

    // Periksa idempotensi
    const existing = await prisma.notificationLog.findUnique({
      where: { idempotencyKey },
    });

    if (existing && existing.status === "SENT") {
      // Sudah terkirim sebelumnya, hindari duplikasi
      return existing;
    }

    const cleanTo = to?.trim() || "";
    const domain = cleanTo.includes("@") ? cleanTo.split("@")[1]?.toLowerCase() : "";
    const isPlaceholder =
      domain &&
      (BLOCKED_PLACEHOLDER_DOMAINS.includes(domain) ||
        domain.endsWith(".example") ||
        domain.endsWith(".test") ||
        domain.endsWith(".invalid") ||
        domain.endsWith(".localhost"));

    // Jika alamat email kosong, tidak valid, atau merupakan domain placeholder RFC 2606
    if (!cleanTo || !isValidEmail(cleanTo) || isPlaceholder) {
      const failReason = !cleanTo
        ? "Alamat email tujuan kosong atau belum terdaftar pada akun pemohon di database."
        : isPlaceholder
        ? `Pengiriman dibatalkan: Domain '${domain}' merupakan domain placeholder RFC 2606 yang tidak menerima email (Null MX).`
        : "Format alamat email penerima tidak valid.";

      const status = isPlaceholder ? "SKIPPED" : "FAILED";
      const metadataObj = {
        deliveryDistinction: {
          isRelayAccepted: false,
          isConfirmedDelivered: false,
          note: failReason,
        },
      };

      let log = existing;
      if (!log) {
        log = await prisma.notificationLog.create({
          data: {
            channel: "EMAIL",
            event,
            pengajuanId,
            userId,
            recipient: cleanTo || "TIDAK_TERSEDIA",
            recipientName: recipientName || null,
            subject,
            message: text || `Email Notifikasi: ${subject}`,
            status,
            errorMessage: failReason,
            idempotencyKey,
            metadata: JSON.stringify(metadataObj),
          },
        });
      } else {
        log = await prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status,
            errorMessage: failReason,
            metadata: JSON.stringify(metadataObj),
          },
        });
      }

      return log;
    }

    // Catat status PENDING terlebih dahulu jika belum ada
    let log = existing;
    if (!log) {
      log = await prisma.notificationLog.create({
        data: {
          channel: "EMAIL",
          event,
          pengajuanId,
          userId,
          recipient: cleanTo,
          recipientName: recipientName || null,
          subject,
          message: text || `Email Notifikasi: ${subject}`,
          status: "PENDING",
          idempotencyKey,
        },
      });
    }

    // Eksekusi pengiriman via Nodemailer Gmail
    const result = await sendGmail({
      to: cleanTo,
      recipientName,
      subject,
      html,
      text,
      event,
    });

    // Catat metadata pengiriman SMTP yang aman dan transparan
    const metadataObj = {
      smtpStatus: result.success ? "ACCEPTED" : "FAILED",
      smtpResponse: result.response || null,
      messageId: result.messageId || null,
      acceptedRecipients: result.accepted || [],
      rejectedRecipients: result.rejected || [],
      deliveryNote: result.success
        ? "Permintaan SMTP berhasil diterima relay Gmail (250 OK). Penerimaan akhir di Inbox penerima bergantung pada filter spam dan reputasi akun Gmail penerima."
        : "Permintaan pengiriman ditolak server SMTP.",
    };

    // Perbarui record log pengiriman
    const updatedLog = await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: result.status,
        providerMessageId: result.messageId || null,
        errorMessage: result.error || null,
        attemptCount: { increment: 1 },
        metadata: JSON.stringify(metadataObj),
      },
    });

    return updatedLog;
  }

  /**
   * Pengiriman WhatsApp terpusat dengan mekanisme Idempotensi & Logging
   */
  static async dispatchWhatsApp(params: {
    to: string;
    recipientName?: string;
    message: string;
    pengajuanId?: string;
    userId?: string;
    role?: Role;
    event: NotificationEventType;
    idempotencyKey: string;
  }) {
    const { to, recipientName, message, pengajuanId, userId, event, idempotencyKey } = params;

    // Periksa idempotensi
    const existing = await prisma.notificationLog.findUnique({
      where: { idempotencyKey },
    });

    if (existing && existing.status === "SENT") {
      return existing;
    }

    // Catat status PENDING
    let log = existing;
    if (!log) {
      log = await prisma.notificationLog.create({
        data: {
          channel: "WHATSAPP",
          event,
          pengajuanId,
          userId,
          recipient: to,
          recipientName: recipientName || null,
          subject: `WhatsApp [${event}]`,
          message,
          status: "PENDING",
          idempotencyKey,
        },
      });
    }

    // Eksekusi pengiriman via WhatsApp Cloud API resmi
    const result = await sendWhatsAppMessage({
      to,
      recipientName,
      message,
      event,
    });

    // Perbarui status log
    const updatedLog = await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: result.status,
        providerMessageId: result.messageId || null,
        errorMessage: result.error || null,
        attemptCount: { increment: 1 },
      },
    });

    return updatedLog;
  }

  /**
   * Mekanisme pengiriman ulang (retry) untuk notifikasi yang FAILED
   */
  static async retryNotification(logId: string) {
    const log = await prisma.notificationLog.findUnique({
      where: { id: logId },
      include: {
        pengajuan: {
          include: {
            pemohon: { include: { profilWarga: true } },
            jenisLayanan: true,
          },
        },
      },
    });

    if (!log) throw new Error("Log notifikasi tidak ditemukan");

    if (log.channel === "EMAIL") {
      const namaWarga = log.pengajuan?.pemohon.profilWarga?.namaLengkap || log.recipientName || "Warga";
      const nomorPengajuan = log.pengajuan?.nomorPengajuan || "REF-PENG";
      const layananNama = log.pengajuan?.jenisLayanan.nama || "Pelayanan Desa";

      const emailParams = {
        wargaNama: namaWarga,
        nomorPengajuan,
        jenisLayanan: layananNama,
        statusBadgeText: log.event,
        pesanUtama: `Pemberitahuan resmi mengenai pengajuan layanan <strong>${layananNama}</strong> Anda.`,
        waktuPembaruan: formatDateIndo(new Date()),
      };
      const html = generateEmailHtml(emailParams);
      const text = generateEmailPlainText(emailParams);

      const res = await sendGmail({
        to: log.recipient,
        recipientName: namaWarga,
        subject: log.subject || `Notifikasi Pelayanan Desa: Pembaruan Pengajuan [${nomorPengajuan}]`,
        html,
        text,
        event: log.event as NotificationEventType,
      });

      const metadataObj = {
        smtpStatus: res.success ? "ACCEPTED" : "FAILED",
        smtpResponse: res.response || null,
        messageId: res.messageId || null,
        acceptedRecipients: res.accepted || [],
        rejectedRecipients: res.rejected || [],
        deliveryNote: res.success
          ? "Pengiriman ulang (retry) berhasil diterima relay Gmail (250 OK)."
          : "Pengiriman ulang gagal.",
      };

      return await prisma.notificationLog.update({
        where: { id: logId },
        data: {
          status: res.status,
          providerMessageId: res.messageId || log.providerMessageId,
          errorMessage: res.error || null,
          attemptCount: { increment: 1 },
          metadata: JSON.stringify(metadataObj),
        },
      });
    } else {
      let recipientPhone = log.recipient;

      // Jika nomor penerima sebelumnya tidak tersedia, coba cari nomor terbaru dari profil warga
      if (recipientPhone === "TIDAK_TERSEDIA" || !validateAndNormalizeIndonesianPhone(recipientPhone).isValid) {
        const freshPhone = log.pengajuan?.pemohon?.profilWarga?.noTelepon;
        if (freshPhone) {
          const val = validateAndNormalizeIndonesianPhone(freshPhone);
          if (val.isValid) {
            recipientPhone = val.formattedE164;
          }
        }
      }

      if (recipientPhone === "TIDAK_TERSEDIA" || !validateAndNormalizeIndonesianPhone(recipientPhone).isValid) {
        throw new Error(
          "Nomor WhatsApp belum terdaftar di profil warga pemohon. Harap lengkapi nomor telepon pada data profil warga terlebih dahulu sebelum mengirim ulang."
        );
      }

      const res = await sendWhatsAppMessage({
        to: recipientPhone,
        recipientName: log.recipientName || undefined,
        message: log.message,
        event: log.event as NotificationEventType,
      });

      return await prisma.notificationLog.update({
        where: { id: logId },
        data: {
          recipient: recipientPhone,
          status: res.status,
          providerMessageId: res.messageId || log.providerMessageId,
          errorMessage: res.error || null,
          attemptCount: { increment: 1 },
        },
      });
    }
  }
}
