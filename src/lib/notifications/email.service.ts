import nodemailer from "nodemailer";
import { SendEmailPayload, SendEmailResult } from "./types";

/**
 * Konfigurasi Transporter Nodemailer untuk Gmail SMTP
 */
function getEmailTransporter() {
  const user = process.env.GMAIL_USER?.trim();
  const rawPass = process.env.GMAIL_APP_PASSWORD?.trim();
  const pass = rawPass ? rawPass.replace(/\s+/g, "") : "";

  if (!user || !pass) {
    return null;
  }

  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const secure = process.env.SMTP_SECURE !== "false"; // default true (SSL untuk port 465)

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    // Konfigurasi TLS standar modern & aman
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
    },
    // Batas timeout wajar agar tidak menggantung proses
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

/**
 * Periksa status kesiapan konfigurasi Gmail
 */
export async function verifyGmailConnection(): Promise<{
  isConfigured: boolean;
  user: string | null;
  from: string | null;
  error?: string;
}> {
  const user = process.env.GMAIL_USER?.trim();
  const rawPass = process.env.GMAIL_APP_PASSWORD?.trim();
  const pass = rawPass ? rawPass.replace(/\s+/g, "") : "";

  if (!user || !pass) {
    return {
      isConfigured: false,
      user: user || null,
      from: null,
      error: "GMAIL_USER atau GMAIL_APP_PASSWORD belum dikonfigurasi di file .env",
    };
  }

  try {
    const transporter = getEmailTransporter();
    if (!transporter) {
      return {
        isConfigured: false,
        user,
        from: null,
        error: "Gagal membuat transporter email",
      };
    }

    await transporter.verify();

    const fromName = process.env.GMAIL_FROM_NAME?.trim() || "Notifikasi Pelayanan Desa — Asisten Desa Perum";
    return {
      isConfigured: true,
      user,
      from: `"${fromName.replace(/"/g, '\\"')}" <${user}>`,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // Hapus kemungkinan ada pass atau string rahasia di pesan error
    const sanitizedError = pass ? errMsg.replace(new RegExp(pass, "gi"), "******") : errMsg;

    return {
      isConfigured: false,
      user,
      from: null,
      error: `Pemeriksaan koneksi Gmail gagal: ${sanitizedError}`,
    };
  }
}

/**
 * Daftar domain placeholder terlarang (RFC 2606 & RFC 6761) yang tidak memiliki server email aktif
 * untuk mencegah kegagalan pengiriman (Null MX / Bounce) ke penyedia relay.
 */
export const BLOCKED_PLACEHOLDER_DOMAINS = [
  "example.com",
  "example.org",
  "example.net",
  "example.edu",
  "test.com",
  "invalid",
  "localhost",
];

/**
 * Validasi alamat email format RFC dan pencegahan domain placeholder
 */
export function isValidEmail(email?: string | null): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(trimmed)) return false;

  const domain = trimmed.split("@")[1]?.toLowerCase();
  if (!domain) return false;

  // Cek apakah domain merupakan domain dokumentasi/placeholder RFC 2606 yang tidak memiliki MX
  if (
    BLOCKED_PLACEHOLDER_DOMAINS.includes(domain) ||
    domain.endsWith(".example") ||
    domain.endsWith(".test") ||
    domain.endsWith(".invalid") ||
    domain.endsWith(".localhost")
  ) {
    return false;
  }

  return true;
}

/**
 * Kirim email terpusat dengan Nodemailer
 */
export async function sendGmail(payload: SendEmailPayload): Promise<SendEmailResult> {
  const { to, recipientName, subject, html, text } = payload;

  if (!to || typeof to !== "string" || !to.trim()) {
    return {
      success: false,
      status: "FAILED",
      error: "Alamat email tujuan kosong atau tidak ditentukan.",
    };
  }

  const cleanTo = to.trim();
  const domain = cleanTo.split("@")[1]?.toLowerCase();
  if (
    domain &&
    (BLOCKED_PLACEHOLDER_DOMAINS.includes(domain) ||
      domain.endsWith(".example") ||
      domain.endsWith(".test") ||
      domain.endsWith(".invalid") ||
      domain.endsWith(".localhost"))
  ) {
    return {
      success: false,
      status: "SKIPPED",
      error: `Pengiriman dibatalkan: Domain '${domain}' merupakan domain placeholder RFC 2606 yang tidak menerima email (Null MX).`,
    };
  }

  if (!isValidEmail(cleanTo)) {
    return {
      success: false,
      status: "FAILED",
      error: "Format alamat email penerima tidak valid.",
    };
  }

  const transporter = getEmailTransporter();
  const user = process.env.GMAIL_USER?.trim();

  if (!transporter || !user) {
    return {
      success: false,
      status: "SKIPPED",
      error: "Layanan Gmail belum aktif: GMAIL_USER dan GMAIL_APP_PASSWORD belum dikonfigurasi pada environment variables.",
    };
  }

  const defaultFromName = "Notifikasi Pelayanan Desa — Asisten Desa Perum";
  const fromName = process.env.GMAIL_FROM_NAME?.trim() || defaultFromName;
  // Format From RFC 5322 dengan kutip pada nama pengirim dan alamat email autentikasi asli
  const fromAddress = `"${fromName.replace(/"/g, '\\"')}" <${user}>`;

  // Pastikan bagian text selalu terisi dan representatif terhadap HTML (mencegah penalti spam filter akibat MIME multipart mismatch)
  const plainTextBody =
    text && text.trim().length > 0
      ? text
      : html
      ? html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<\/p>|<\/tr>|<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n\s+\n/g, "\n\n")
          .replace(/[ \t]+/g, " ")
          .trim()
      : "Notifikasi resmi Pelayanan Desa Terpadu — Asisten Desa Perum.";

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipientName ? `"${recipientName.replace(/"/g, '\\"')}" <${to}>` : to,
      replyTo: `"${fromName.replace(/"/g, '\\"')}" <${user}>`,
      subject,
      text: plainTextBody,
      html,
      // Header standar RFC untuk notifikasi sistem transaksional
      headers: {
        "Auto-Submitted": "auto-generated",
        "X-Auto-Response-Suppress": "All",
        "X-Service-Name": "Pelayanan-Desa-Terpadu",
        "X-Notification-Event": payload.event || "NOTIFICATION",
      },
    });

    if (info && info.messageId) {
      return {
        success: true,
        status: "SENT",
        messageId: info.messageId,
        response: info.response,
        accepted: (info.accepted as string[]) || [to],
        rejected: (info.rejected as string[]) || [],
      };
    } else {
      return {
        success: false,
        status: "FAILED",
        error: "Layanan email tidak mengonfirmasi ID pesan (pengiriman belum dipastikan berhasil).",
      };
    }
  } catch (err: unknown) {
    const rawError = err instanceof Error ? err.message : String(err);
    const rawPass = process.env.GMAIL_APP_PASSWORD?.trim() || "";
    const cleanPass = rawPass.replace(/\s+/g, "");
    let safeError = rawError;
    if (cleanPass) {
      safeError = safeError.replace(new RegExp(cleanPass, "gi"), "******");
    }
    if (rawPass) {
      safeError = safeError.replace(new RegExp(rawPass, "gi"), "******");
    }

    return {
      success: false,
      status: "FAILED",
      error: `Pengiriman email ke ${to} gagal: ${safeError}`,
    };
  }
}

/**
 * Generator Email Versi Plain Text yang Bersih & Representatif
 */
export function generateEmailPlainText(params: {
  wargaNama?: string | null;
  nomorPengajuan: string;
  jenisLayanan: string;
  statusBadgeText: string;
  pesanUtama: string;
  langkahBerikutnya?: string | null;
  catatanPetugas?: string | null;
  waktuPembaruan: string;
}): string {
  const {
    wargaNama,
    nomorPengajuan,
    jenisLayanan,
    statusBadgeText,
    pesanUtama,
    langkahBerikutnya,
    catatanPetugas,
    waktuPembaruan,
  } = params;

  const cleanPesan = pesanUtama.replace(/<[^>]*>?/gm, "").trim();
  const sapaan = wargaNama ? `Yth. Bapak/Ibu ${wargaNama}` : "Yth. Warga Pemohon";

  const lines: string[] = [
    `${sapaan},`,
    "",
    cleanPesan,
    "",
    "--- RINCIAN PENGAJUAN PELAYANAN ---",
    `Nomor Referensi : ${nomorPengajuan}`,
    `Jenis Layanan   : ${jenisLayanan}`,
    `Status          : ${statusBadgeText}`,
    `Waktu Pembaruan : ${waktuPembaruan}`,
  ];

  if (catatanPetugas) {
    lines.push(`Catatan Petugas : ${catatanPetugas}`);
  }

  if (langkahBerikutnya) {
    lines.push("");
    lines.push("--- LANGKAH SELANJUTNYA ---");
    lines.push(langkahBerikutnya);
  }

  lines.push("");
  lines.push("Anda dapat memeriksa perkembangan pengajuan dan mengunduh berkas surat secara langsung melalui portal resmi Pelayanan Desa Terpadu.");
  lines.push("");
  lines.push("==================================================");
  lines.push("Pemberitahuan resmi otomatis dari Sistem Pelayanan Desa Terpadu — Asisten Desa Perum.");
  lines.push("Mohon tidak membalas email ini secara langsung.");

  return lines.join("\n");
}

/**
 * Template Email HTML Responsif & Elegan
 */
export function generateEmailHtml(params: {
  wargaNama?: string | null;
  nomorPengajuan: string;
  jenisLayanan: string;
  statusBadgeText: string;
  statusBadgeColor?: string;
  pesanUtama: string;
  langkahBerikutnya?: string | null;
  catatanPetugas?: string | null;
  waktuPembaruan: string;
}): string {
  const {
    wargaNama,
    nomorPengajuan,
    jenisLayanan,
    statusBadgeText,
    statusBadgeColor = "#0F766E",
    pesanUtama,
    langkahBerikutnya,
    catatanPetugas,
    waktuPembaruan,
  } = params;

  const sapaan = wargaNama ? `Yth. Bapak/Ibu <strong>${wargaNama}</strong>` : "Yth. Warga Pemohon";
  const cleanSnippet = pesanUtama.replace(/<[^>]*>?/gm, "").trim().slice(0, 140);

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Pemberitahuan Status Pengajuan - Pelayanan Desa Terpadu</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; line-height: 1.6;">
  <!-- Hidden Preheader Preview Text -->
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #FFFFFF; opacity: 0;">
    ${cleanSnippet} &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Container Utama -->
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #17365D; padding: 28px 32px; text-align: left;">
              <div style="display: inline-block; vertical-align: middle;">
                <div style="font-size: 18px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.2px; line-height: 1.2;">
                  Notifikasi Pelayanan Desa
                </div>
                <div style="font-size: 12px; font-weight: 600; color: #2DD4BF; margin-top: 4px; letter-spacing: 0.3px;">
                  Asisten Desa Perum
                </div>
              </div>
            </td>
          </tr>

          <!-- Konten Email -->
          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 15px; margin-top: 0; margin-bottom: 16px; color: #334155;">
                ${sapaan},
              </p>
              <p style="font-size: 15px; margin-top: 0; margin-bottom: 24px; color: #334155;">
                ${pesanUtama}
              </p>

              <!-- Kartu Detail Pengajuan -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    
                    <!-- Status Badge -->
                    <div style="margin-bottom: 16px;">
                      <span style="display: inline-block; padding: 6px 14px; background-color: ${statusBadgeColor}; color: #FFFFFF; font-size: 12px; font-weight: 700; border-radius: 9999px; letter-spacing: 0.5px;">
                        ${statusBadgeText}
                      </span>
                    </div>

                    <!-- Tabel Info -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #475569;">
                      <tr>
                        <td style="padding: 6px 0; width: 140px; color: #64748B;">Nomor Referensi</td>
                        <td style="padding: 6px 0; font-weight: 700; color: #0F172A; font-family: monospace; font-size: 14px;">${nomorPengajuan}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B;">Jenis Layanan</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #1E293B;">${jenisLayanan}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B;">Waktu Pembaruan</td>
                        <td style="padding: 6px 0; color: #1E293B;">${waktuPembaruan}</td>
                      </tr>
                      ${
                        catatanPetugas
                          ? `
                      <tr>
                        <td style="padding: 6px 0; color: #64748B; vertical-align: top;">Catatan Petugas</td>
                        <td style="padding: 6px 0; color: #B91C1C; font-weight: 600; background-color: #FEF2F2; padding: 8px; border-radius: 6px;">${catatanPetugas}</td>
                      </tr>
                      `
                          : ""
                      }
                    </table>

                  </td>
                </tr>
              </table>

              ${
                langkahBerikutnya
                  ? `
              <!-- Petunjuk / Langkah Berikutnya -->
              <div style="background-color: #F0FDF4; border-left: 4px solid #16A34A; padding: 14px 18px; border-radius: 6px; margin-bottom: 24px;">
                <div style="font-size: 13px; font-weight: 700; color: #15803D; margin-bottom: 4px;">Langkah Selanjutnya:</div>
                <div style="font-size: 13px; color: #166534; line-height: 1.5;">${langkahBerikutnya}</div>
              </div>
              `
                  : ""
              }

              <p style="font-size: 13px; color: #64748B; margin-top: 24px; margin-bottom: 0;">
                Anda dapat memeriksa perkembangan pengajuan dan mengunduh berkas surat secara langsung melalui portal resmi Pelayanan Desa Terpadu.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F1F5F9; border-top: 1px solid #E2E8F0; padding: 20px 32px; text-align: center;">
              <p style="font-size: 11px; color: #64748B; margin: 0 0 6px 0;">
                Pemberitahuan resmi otomatis dari <strong>Sistem Pelayanan Desa Terpadu — Asisten Desa Perum</strong>.
              </p>
              <p style="font-size: 11px; color: #94A3B8; margin: 0 0 4px 0;">
                Email transaksi ini dikirim khusus terkait status permohonan administrasi desa Anda.
              </p>
              <p style="font-size: 11px; color: #94A3B8; margin: 0;">
                Mohon tidak membalas email ini secara langsung. Untuk pertanyaan lebih lanjut, silakan hubungi kantor desa pada jam kerja.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Template Plain Text untuk Notifikasi Pendaftaran Akun Warga Baru
 */
export function generateWelcomeEmailPlainText(params: {
  wargaNama: string;
  email: string;
  tanggalDaftar: string;
}): string {
  const { wargaNama, email, tanggalDaftar } = params;

  const lines: string[] = [
    `Yth. Bapak/Ibu ${wargaNama},`,
    "",
    "Selamat datang di Sistem Pelayanan Desa Terpadu — Asisten Desa Perum.",
    "Akun warga Anda telah berhasil didaftarkan dan kini siap digunakan untuk mengajukan berbagai layanan administrasi desa secara daring.",
    "",
    "--- RINCIAN AKUN WARGA ---",
    `Nama Pengguna   : ${wargaNama}`,
    `Email Terdaftar : ${email}`,
    `Waktu Terdaftar : ${tanggalDaftar}`,
    `Status Akun     : AKTIF`,
    "",
    "PANDUAN PENGGUNAAN:",
    "1. Masuk ke portal Pelayanan Desa Terpadu menggunakan email terdaftar dan kata sandi yang telah Anda buat.",
    "2. Lengkapi profil data warga jika ada informasi yang perlu diperbarui.",
    "3. Ajukan permohonan surat keterangan dan pantau perkembangannya secara mandiri melalui menu Pengajuan.",
    "",
    "Perhatian Keamanan: Demi menjaga kerahasiaan data kependudukan Anda, jangan pernah memberikan kata sandi akun Anda kepada siapa pun. Kami tidak pernah meminta kata sandi akun Anda.",
    "",
    "==================================================",
    "Pemberitahuan resmi otomatis dari Sistem Pelayanan Desa Terpadu — Asisten Desa Perum.",
    "Mohon tidak membalas email ini secara langsung.",
  ];

  return lines.join("\n");
}

/**
 * Template HTML untuk Notifikasi Pendaftaran Akun Warga Baru
 */
export function generateWelcomeEmailHtml(params: {
  wargaNama: string;
  email: string;
  tanggalDaftar: string;
}): string {
  const { wargaNama, email, tanggalDaftar } = params;

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Akun Warga Berhasil Didaftarkan - Pelayanan Desa Terpadu</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; line-height: 1.6;">
  <!-- Hidden Preheader Preview Text -->
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #FFFFFF; opacity: 0;">
    Selamat datang di Sistem Pelayanan Desa Terpadu. Akun Anda telah aktif dan siap digunakan. &zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Container Utama -->
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #17365D; padding: 28px 32px; text-align: left;">
              <div style="display: inline-block; vertical-align: middle;">
                <div style="font-size: 18px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.2px; line-height: 1.2;">
                  Notifikasi Pelayanan Desa
                </div>
                <div style="font-size: 12px; font-weight: 600; color: #2DD4BF; margin-top: 4px; letter-spacing: 0.3px;">
                  Asisten Desa Perum
                </div>
              </div>
            </td>
          </tr>

          <!-- Konten Email -->
          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 15px; margin-top: 0; margin-bottom: 16px; color: #334155;">
                Yth. Bapak/Ibu <strong>${wargaNama}</strong>,
              </p>
              <p style="font-size: 15px; margin-top: 0; margin-bottom: 24px; color: #334155;">
                Selamat datang! Akun warga Anda pada <strong>Sistem Pelayanan Desa Terpadu — Asisten Desa Perum</strong> telah berhasil didaftarkan dan kini telah aktif. Anda dapat mengajukan permohonan surat keterangan dan layanan administrasi desa secara daring kapan saja.
              </p>

              <!-- Kartu Detail Akun -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <div style="margin-bottom: 16px;">
                      <span style="display: inline-block; padding: 6px 14px; background-color: #059669; color: #FFFFFF; font-size: 12px; font-weight: 700; border-radius: 9999px; letter-spacing: 0.5px;">
                        AKUN AKTIF
                      </span>
                    </div>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #475569;">
                      <tr>
                        <td style="padding: 6px 0; width: 140px; color: #64748B;">Nama Warga</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #1E293B;">${wargaNama}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B;">Email Terdaftar</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #1E293B;">${email}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B;">Waktu Pendaftaran</td>
                        <td style="padding: 6px 0; color: #1E293B;">${tanggalDaftar}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Petunjuk Langkah Selanjutnya -->
              <div style="background-color: #F0FDF4; border-left: 4px solid #16A34A; padding: 14px 18px; border-radius: 6px; margin-bottom: 24px;">
                <div style="font-size: 13px; font-weight: 700; color: #15803D; margin-bottom: 4px;">Langkah Selanjutnya:</div>
                <div style="font-size: 13px; color: #166534; line-height: 1.5;">
                  Silakan masuk ke portal resmi Pelayanan Desa Terpadu menggunakan email terdaftar dan kata sandi yang telah Anda buat untuk mulai memanfaatkan kemudahan layanan administrasi desa.
                </div>
              </div>

              <!-- Peringatan Keamanan -->
              <p style="font-size: 12px; color: #64748B; margin-top: 24px; margin-bottom: 0;">
                <em>Perhatian Keamanan: Demi menjaga kerahasiaan data kependudukan Anda, jangan pernah membagikan kata sandi akun Anda kepada pihak mana pun. Petugas desa tidak pernah meminta kata sandi Anda.</em>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F1F5F9; border-top: 1px solid #E2E8F0; padding: 20px 32px; text-align: center;">
              <p style="font-size: 11px; color: #64748B; margin: 0 0 6px 0;">
                Pemberitahuan resmi otomatis dari <strong>Sistem Pelayanan Desa Terpadu — Asisten Desa Perum</strong>.
              </p>
              <p style="font-size: 11px; color: #94A3B8; margin: 0 0 4px 0;">
                Email konfirmasi ini dikirim khusus terkait pendaftaran akun layanan administrasi desa Anda.
              </p>
              <p style="font-size: 11px; color: #94A3B8; margin: 0;">
                Mohon tidak membalas email ini secara langsung. Untuk pertanyaan lebih lanjut, silakan hubungi kantor desa pada jam kerja.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
