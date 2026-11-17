import prisma from "@/lib/prisma";
import { ChatRole } from "./roles";
import { extractServiceCode } from "./intents";
import { NotificationOrchestrator } from "@/lib/notifications";

function generateNomorPengajuan() {
  const date = new Date();
  const yymmdd = date.toISOString().slice(2, 10).replace(/-/g, "");
  const random = Math.floor(1000 + Math.random() * 9000).toString();
  return `REQ-${yymmdd}-${random}`;
}

export interface SuratChatbotResponse {
  message: string;
  actionType?: "CONFIRM_SUBMISSION" | "VIEW_SUBMISSION" | "PRINT_READY";
  serviceCode?: string;
  pengajuanId?: string;
  previewUrl?: string;
}

/**
 * 1. Menangani permintaan pembuatan / penyiapan surat warga
 */
export async function handleBuatSurat(
  userId: string | undefined,
  role: ChatRole,
  serviceCodeHint?: string,
  queryText: string = ""
): Promise<SuratChatbotResponse> {
  if (role === "GUEST" || !userId) {
    return {
      message:
        "🔒 **Akses Diperlukan**: Untuk membuat dan mengajukan surat desa (SKTM, Domisili, SKU, dll), silakan masuk (login) terlebih dahulu menggunakan akun Warga Anda.",
    };
  }

  // Cari jenis layanan di database
  const detected = serviceCodeHint ? { code: serviceCodeHint } : extractServiceCode(queryText);
  const targetCode = detected?.code || "SKTM-01"; // Default ke SKTM jika umum

  const layanan = await prisma.jenisLayanan.findFirst({
    where: {
      kode: { equals: targetCode, mode: "insensitive" },
      isActive: true,
    },
  });

  if (!layanan) {
    return {
      message: `Mohon maaf, jenis layanan dengan kode **${targetCode}** saat ini belum tersedia atau sedang nonaktif di Master Layanan desa. Silakan hubungi petugas kantor desa.`,
    };
  }

  // Ambil data warga aktual dari database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profilWarga: true },
  });

  const namaWarga = user?.nama || user?.profilWarga?.namaLengkap || "Warga Terdaftar";
  const nikWarga = user?.profilWarga?.nik ? `${user.profilWarga.nik.slice(0, 8)}********` : "Belum terdata";
  const alamatWarga = user?.profilWarga?.alamat || "Desa Perum, Kec. Harjamukti, Cirebon";

  // Parse persyaratan resmi dari database
  let persyaratanList: string[] = [];
  try {
    persyaratanList = JSON.parse(layanan.persyaratan || "[]");
  } catch {
    persyaratanList = ["KTP", "KK", "Surat Pengantar RT/RW"];
  }

  // Cek apakah ada keperluan yang disebutkan warga di kalimatnya
  let keperluanDetected = "";
  const lowerQuery = queryText.toLowerCase();
  const untukIndex = lowerQuery.indexOf("untuk ");
  const buatIndex = lowerQuery.indexOf("buat ");
  if (untukIndex !== -1) {
    keperluanDetected = queryText.slice(untukIndex + 6).trim();
  } else if (buatIndex !== -1 && lowerQuery.includes("keperluan")) {
    keperluanDetected = queryText.slice(buatIndex + 5).trim();
  }

  let text = `🏛️ **Bantuan Pembuatan ${layanan.nama}**\n\n`;
  text += `Halo Bapak/Ibu **${namaWarga}**, saya siap membantu menyiapkan permohonan surat Anda secara langsung ke sistem pelayanan desa.\n\n`;

  text += `📋 **Persyaratan Dokumen Resmi (${layanan.nama}):**\n`;
  persyaratanList.forEach((syarat, idx) => {
    text += `${idx + 1}. ${syarat}\n`;
  });
  text += `⏱️ *Estimasi Waktu Proses: ${layanan.estimasiWaktu} Hari Kerja*\n\n`;

  text += `📝 **Ringkasan Data Pemohon Terverifikasi:**\n`;
  text += `• **Nama Pemohon:** ${namaWarga}\n`;
  text += `• **NIK:** ${nikWarga}\n`;
  text += `• **Domisili:** ${alamatWarga}\n`;
  text += `• **Keperluan Surat:** ${keperluanDetected || "Keperluan administrasi umum"}\n\n`;

  text += `👉 **Langkah Selanjutnya:**\n`;
  text += `Untuk memproses permohonan ini secara sah ke antrean verifikasi staf desa, silakan balas dengan: **"Ya, ajukan sekarang"** atau klik konfirmasi di bawah ini.`;

  return {
    message: text,
    actionType: "CONFIRM_SUBMISSION",
    serviceCode: layanan.kode,
  };
}

/**
 * 2. Menangani konfirmasi nyata pembuatan pengajuan surat warga ke database
 */
export async function handleKonfirmasiBuatSurat(
  userId: string | undefined,
  role: ChatRole,
  serviceCodeHint?: string,
  queryText: string = ""
): Promise<SuratChatbotResponse> {
  if (role === "GUEST" || !userId) {
    return {
      message: "🔒 Anda harus login terlebih dahulu untuk mengajukan permohonan surat.",
    };
  }

  const detected = serviceCodeHint ? { code: serviceCodeHint } : extractServiceCode(queryText);
  const targetCode = detected?.code || "SKTM-01";

  const layanan = await prisma.jenisLayanan.findFirst({
    where: {
      kode: { equals: targetCode, mode: "insensitive" },
      isActive: true,
    },
  });

  if (!layanan) {
    return {
      message: "Mohon maaf, layanan yang ingin diajukan tidak ditemukan di sistem desa.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profilWarga: true },
  });

  const nomorPengajuan = generateNomorPengajuan();
  const namaWarga = user?.nama || user?.profilWarga?.namaLengkap || "Warga";
  const catatan = `Pengajuan otomatis via Asisten Desa | Pemohon: ${namaWarga}`;

  // Simpan ke database nyata
  const pengajuan = await prisma.pengajuanLayanan.create({
    data: {
      nomorPengajuan,
      pemohonId: userId,
      jenisLayananId: layanan.id,
      status: "DIAJUKAN",
      catatan,
      logs: {
        create: {
          userId,
          action: "Permohonan Dibuat Melalui Asisten AI Desa",
          catatan,
        },
      },
    },
  });

  // Notifikasi lokal
  try {
    await prisma.notification.create({
      data: {
        userId,
        title: "Permohonan Surat Terkirim",
        message: `Pengajuan ${layanan.nama} (${nomorPengajuan}) telah masuk ke antrean staf desa.`,
        type: "SUCCESS",
        link: `/warga/pengajuan/${pengajuan.id}`,
      },
    });
  } catch {
    // ignore
  }

  // Notifikasi asinkron ke aparatur
  NotificationOrchestrator.handlePengajuanBaru(pengajuan.id).catch(console.error);

  let text = `🎉 **Permohonan Surat Berhasil Dikirim ke Sistem Desa!**\n\n`;
  text += `Data permohonan Anda telah resmi tercatat di database pelayanan desa:\n`;
  text += `• **Nomor Registrasi:** \`${nomorPengajuan}\`\n`;
  text += `• **Jenis Layanan:** ${layanan.nama}\n`;
  text += `• **Status Saat Ini:** **DIAJUKAN** (Menunggu pemeriksaan berkas oleh staf desa)\n`;
  text += `• **Pemohon:** ${namaWarga}\n`;
  text += `• **Tanggal Pengajuan:** ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}\n\n`;

  text += `📄 **Tindakan yang Dapat Anda Lakukan:**\n`;
  text += `1. **[Lihat Detail Pengajuan](/warga/pengajuan/${pengajuan.id})** untuk memantau proses verifikasi berkas.\n`;
  text += `2. **[Pratinjau Draft Surat](/surat/preview/${pengajuan.id})** untuk melihat lembar draft surat A4 resmi Anda sebelum diterbitkan Kepala Desa.\n\n`;
  text += `*Petugas desa akan segera memeriksa data Anda sesuai SOP pelayanan. Notifikasi pembaruan status akan dikirimkan otomatis ke dashboard Anda.*`;

  return {
    message: text,
    actionType: "VIEW_SUBMISSION",
    pengajuanId: pengajuan.id,
    previewUrl: `/surat/preview/${pengajuan.id}`,
  };
}

/**
 * 3. Menampilkan daftar pengajuan dan status surat milik warga yang login
 */
export async function handleStatusSurat(
  userId: string | undefined,
  role: ChatRole
): Promise<SuratChatbotResponse> {
  if (role === "GUEST" || !userId) {
    return {
      message:
        "🔒 Untuk memeriksa status berkas pengajuan surat, silakan masuk (login) terlebih dahulu ke akun Warga Anda.",
    };
  }

  const list = await prisma.pengajuanLayanan.findMany({
    where: { pemohonId: userId },
    include: {
      jenisLayanan: true,
      dokumenHasil: true,
    },
    orderBy: { tanggalPengajuan: "desc" },
    take: 5,
  });

  if (list.length === 0) {
    return {
      message:
        "📋 Saat ini Anda belum memiliki riwayat pengajuan surat di sistem desa.\n\nJika Anda membutuhkan surat keterangan (seperti **SKTM**, **Surat Domisili**, atau **SKU**), Anda dapat langsung meminta saya membuatkannya sekarang dengan mengetik misalnya: *'Saya ingin membuat SKTM'*.",
    };
  }

  let text = `📋 **Daftar & Status Pengajuan Surat Anda:**\n\n`;

  list.forEach((p, idx) => {
    const tgl = new Date(p.tanggalPengajuan).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    text += `**${idx + 1}. ${p.jenisLayanan.nama}**\n`;
    text += `   • No. Registrasi: \`${p.nomorPengajuan}\`\n`;
    text += `   • Tanggal Pengajuan: ${tgl}\n`;
    text += `   • Status: **${p.status}**\n`;

    if (p.status === "SELESAI" && p.dokumenHasil) {
      text += `   • Nomor Surat Resmi: **${p.dokumenHasil.nomorSurat}**\n`;
      text += `   • 🖨️ **[Unduh / Cetak Surat Resmi](/surat/${p.dokumenHasil.id})**\n`;
    } else {
      text += `   • 📄 **[Pratinjau Draft Surat](/surat/preview/${p.id})** | **[Detail Berkas](/warga/pengajuan/${p.id})**\n`;
    }
    text += `\n`;
  });

  text += `💡 *Tip: Dokumen dengan status **SELESAI** dapat langsung Anda unduh dan cetak sebagai dokumen resmi desa.*`;

  return {
    message: text,
  };
}

/**
 * 4. Menampilkan persyaratan dokumen resmi dari database
 */
export async function handleSyaratSurat(
  serviceCodeHint?: string,
  queryText: string = ""
): Promise<SuratChatbotResponse> {
  const detected = serviceCodeHint ? { code: serviceCodeHint } : extractServiceCode(queryText);
  const targetCode = detected?.code;

  if (targetCode) {
    const layanan = await prisma.jenisLayanan.findFirst({
      where: { kode: targetCode, isActive: true },
    });

    if (layanan) {
      let pers: string[] = [];
      try {
        pers = JSON.parse(layanan.persyaratan || "[]");
      } catch {
        pers = ["KTP", "KK", "Surat Pengantar RT/RW"];
      }

      let text = `📋 **Persyaratan Resmi ${layanan.nama}:**\n\n`;
      text += `${layanan.deskripsi || ""}\n\n`;
      text += `Dokumen yang wajib dipersiapkan:\n`;
      pers.forEach((s, idx) => {
        text += `${idx + 1}. **${s}**\n`;
      });
      text += `\n⏱️ **Estimasi Waktu Penyelesaian:** ${layanan.estimasiWaktu} Hari Kerja\n\n`;
      text += `Ketik **"Saya ingin membuat ${layanan.kode}"** jika Anda ingin saya bantu menyiapkan permohonan sekarang.`;

      return { message: text, serviceCode: layanan.kode };
    }
  }

  // Jika umum, tampilkan semua layanan aktif
  const allLayanan = await prisma.jenisLayanan.findMany({
    where: { isActive: true },
    orderBy: { kode: "asc" },
  });

  let text = `📋 **Daftar Persyaratan Layanan Surat Desa Perum:**\n\n`;
  allLayanan.forEach((l, idx) => {
    let pers: string[] = [];
    try {
      pers = JSON.parse(l.persyaratan || "[]");
    } catch {
      pers = [];
    }
    text += `**${idx + 1}. ${l.nama} (${l.kode})**\n`;
    text += `• Syarat: ${pers.join(", ") || "Sesuai ketentuan RT/RW"}\n`;
    text += `• Estimasi: ${l.estimasiWaktu} hari kerja\n\n`;
  });

  text += `Silakan beri tahu saya surat mana yang ingin Anda ajukan (contoh: *"Syarat SKTM"* atau *"Tolong buatkan SKTM"*).`;
  return { message: text };
}

/**
 * 5. Menampilkan panduan cetak & unduh PDF surat resmi
 */
export async function handlePanduanCetak(
  userId: string | undefined,
  role: ChatRole
): Promise<SuratChatbotResponse> {
  let text = `🖨️ **Panduan Mencetak & Mengunduh Surat Desa (PDF):**\n\n`;
  text += `1. **Pastikan Surat Berstatus SELESAI:**\n`;
  text += `   Surat resmi hanya dapat dicetak setelah melewati seluruh alur pemeriksaan staf desa, validasi pengawas, dan disetujui resmi oleh Kepala Desa dengan Nomor Surat sah.\n\n`;

  text += `2. **Cara Mengunduh & Mencetak:**\n`;
  text += `   • Buka menu **Dashboard Warga** atau ketik *'Tampilkan pengajuan surat saya'* di sini.\n`;
  text += `   • Pada surat yang telah selesai, klik tombol **"Unduh / Cetak Surat"**.\n`;
  text += `   • Klik tombol hijau **"Cetak / Simpan PDF"** di bagian atas lembar surat.\n`;
  text += `   • Pada jendela print dialog peramban Anda, pilih **Destination: "Save as PDF"** untuk mengunduh berkas PDF A4, atau pilih printer fisik untuk mencetak langsung.\n\n`;

  // Jika warga sudah login, periksa apakah ada surat yang siap cetak saat ini
  if (role === "WARGA" && userId) {
    const readyToPrint = await prisma.pengajuanLayanan.findMany({
      where: {
        pemohonId: userId,
        status: "SELESAI",
        dokumenHasil: { isNot: null },
      },
      include: {
        jenisLayanan: true,
        dokumenHasil: true,
      },
    });

    if (readyToPrint.length > 0) {
      text += `📄 **Surat Anda yang Sudah Terbit & Siap Dicetak Sekarang:**\n`;
      readyToPrint.forEach((r) => {
        text += `• **${r.jenisLayanan.nama}** (No: \`${r.dokumenHasil?.nomorSurat}\`) -> **[Unduh / Cetak di Sini](/surat/${r.dokumenHasil?.id})**\n`;
      });
      text += `\n`;
    }
  }

  text += `⚠️ *Catatan: Jika surat masih dalam proses (status Draft/Diajukan/Diperiksa), Anda hanya dapat melihat **Pratinjau Draft** berlabel 'BELUM SAH' untuk verifikasi data.*`;

  return { message: text };
}
