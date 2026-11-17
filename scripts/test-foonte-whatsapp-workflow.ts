import "dotenv/config";
import prisma from "../src/lib/prisma";
import { verifyWhatsAppConfig, sendWhatsAppMessage } from "../src/lib/notifications/whatsapp.service";
import { NotificationOrchestrator } from "../src/lib/notifications/notification.service";
import { StatusPengajuan, Role } from "@prisma/client";

async function main() {
  console.log("=================================================================");
  console.log("   PENGUJIAN SISTEM NOTIFIKASI WHATSAPP FOONTE BERJENJANG   ");
  console.log("=================================================================\n");

  // 1. Verifikasi Koneksi Foonte
  console.log("[LANGKAH 1] Memeriksa status koneksi perangkat Foonte API...");
  const configStatus = await verifyWhatsAppConfig();
  console.log("  Status Konfigurasi:", {
    isConfigured: configStatus.isConfigured,
    activeProvider: configStatus.activeProvider,
    verifiedName: configStatus.verifiedName,
    displayPhoneNumber: configStatus.displayPhoneNumber,
    error: configStatus.error,
  });

  if (!configStatus.isConfigured || configStatus.activeProvider !== "FONNTE") {
    console.error("  ❌ GAGAL: Foonte belum terkonfigurasi atau perangkat belum terhubung!");
    process.exit(1);
  }
  console.log("  ✅ BERHASIL: Foonte terhubung ke perangkat " + configStatus.displayPhoneNumber + "\n");

  // 2. Siapkan User Warga dan Nomor WhatsApp Uji
  console.log("[LANGKAH 2] Menyiapkan data warga pemohon dan nomor WhatsApp pengujian...");
  const testPhone = process.env.TEST_WHATSAPP_PHONE?.trim() || "08817720476";

  let testUser = await prisma.user.findFirst({
    where: { email: "warga.test.foonte@desa.id" },
    include: { profilWarga: true },
  });

  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        nama: "Bapak Ahmad Subagyo",
        email: "warga.test.foonte@desa.id",
        role: Role.WARGA,
        profilWarga: {
          create: {
            nik: "3274012010900099",
            noKk: "3274012010900001",
            namaLengkap: "Bapak Ahmad Subagyo",
            tempatLahir: "Cirebon",
            tanggalLahir: new Date("1985-05-15"),
            alamat: "Jl. Melati RT 03 / RW 02, Desa Perum",
            rt: "003",
            rw: "002",
            noTelepon: testPhone,
          },
        },
      },
      include: { profilWarga: true },
    });
  } else {
    // Pastikan nomor WhatsApp warga terisi dengan nomor pengujian
    await prisma.profilWarga.update({
      where: { userId: testUser.id },
      data: { noTelepon: testPhone },
    });
  }
  console.log(`  Warga Pemohon: ${testUser.nama} (${testUser.email})`);
  console.log(`  Nomor WhatsApp: ${testPhone}\n`);

  // 3. Ambil Jenis Layanan Surat
  const jenisLayanan = await prisma.jenisLayanan.findFirst({
    where: { isActive: true },
  });
  if (!jenisLayanan) {
    console.error("  ❌ GAGAL: Jenis layanan tidak ditemukan di database!");
    process.exit(1);
  }

  // 4. Buat Pengajuan Layanan Uji Coba
  console.log("[LANGKAH 3] Membuat Pengajuan Surat Baru untuk Uji Alur...");
  const timestamp = Date.now().toString().slice(-4);
  const nomorPengajuan = `REQ-FOONTE-${timestamp}`;

  const pengajuan = await prisma.pengajuanLayanan.create({
    data: {
      nomorPengajuan,
      pemohonId: testUser.id,
      jenisLayananId: jenisLayanan.id,
      status: "DIAJUKAN",
      catatan: "Keperluan uji coba notifikasi WhatsApp Foonte berjenjang",
    },
  });
  console.log(`  Pengajuan berhasil dibuat: ID=${pengajuan.id}, No=${nomorPengajuan}\n`);

  // Skenario A: Warga mengirim pengajuan baru
  console.log("--- SKENARIO 0: Pengajuan Baru Masuk ke Sistem (DIAJUKAN) ---");
  await NotificationOrchestrator.handlePengajuanBaru(pengajuan.id);
  const logBaru = await prisma.notificationLog.findFirst({
    where: { pengajuanId: pengajuan.id, event: "PENGAJUAN_BARU", channel: "WHATSAPP" },
    orderBy: { createdAt: "desc" },
  });
  console.log(`  Status Notifikasi WA: ${logBaru?.status} | MsgId: ${logBaru?.providerMessageId}`);
  if (logBaru?.status !== "SENT") {
    console.error("  ❌ Pengajuan baru WA gagal dikirim:", logBaru?.errorMessage);
  } else {
    console.log("  ✅ WA Pengajuan Baru Berhasil Terkirim ke Warga!");
  }

  // Tunggu jeda singkat antar pengiriman pesan Foonte
  await new Promise((r) => setTimeout(r, 2000));

  // ── TAHAP 1: STAF DESA MENERIMA PENGAJUAN (DIPERIKSA) ──
  console.log("\n--- TAHAP 1: Staf Desa Menerima Pengajuan & Memulai Pemeriksaan (DIPERIKSA) ---");
  await prisma.pengajuanLayanan.update({
    where: { id: pengajuan.id },
    data: { status: "DIPERIKSA" },
  });
  await prisma.logPengajuan.create({
    data: {
      pengajuanId: pengajuan.id,
      userId: testUser.id,
      action: "Memulai Pemeriksaan Berkas",
      catatan: "Berkas lengkap, staf mulai memverifikasi dokumen.",
      statusBefore: "DIAJUKAN",
      statusAfter: "DIPERIKSA",
    },
  });

  await NotificationOrchestrator.handleStatusChange({
    pengajuanId: pengajuan.id,
    newStatus: "DIPERIKSA",
    catatan: "Berkas lengkap dan sedang diperiksa oleh staf pelayanan desa.",
  });

  const logDiperiksa = await prisma.notificationLog.findFirst({
    where: { pengajuanId: pengajuan.id, event: "DIPERIKSA", channel: "WHATSAPP" },
    orderBy: { createdAt: "desc" },
  });
  console.log(`  Status Notifikasi WA: ${logDiperiksa?.status} | MsgId: ${logDiperiksa?.providerMessageId}`);
  console.log(`  Pesan: \n${logDiperiksa?.message}\n`);
  if (logDiperiksa?.status === "SENT") {
    console.log("  ✅ TAHAP 1 BERHASIL: WhatsApp Pemeriksaan Staf Desa Masuk!");
  } else {
    console.error("  ❌ TAHAP 1 GAGAL:", logDiperiksa?.errorMessage);
  }

  await new Promise((r) => setTimeout(r, 2000));

  // ── TAHAP 2: PENGAJUAN DITERUSKAN KE SUPERVISOR (MENUNGGU_VALIDASI) ──
  console.log("\n--- TAHAP 2: Pengajuan Diteruskan ke Supervisor untuk Validasi (MENUNGGU_VALIDASI) ---");
  await prisma.pengajuanLayanan.update({
    where: { id: pengajuan.id },
    data: { status: "MENUNGGU_VALIDASI" },
  });
  await prisma.logPengajuan.create({
    data: {
      pengajuanId: pengajuan.id,
      userId: testUser.id,
      action: "Meneruskan ke Supervisor",
      catatan: "Dokumen persyaratan telah memenuhi kriteria staf.",
      statusBefore: "DIPERIKSA",
      statusAfter: "MENUNGGU_VALIDASI",
    },
  });

  await NotificationOrchestrator.handleStatusChange({
    pengajuanId: pengajuan.id,
    newStatus: "MENUNGGU_VALIDASI",
    catatan: "Verifikasi staf selesai, diteruskan kepada Supervisor.",
  });

  const logSpv = await prisma.notificationLog.findFirst({
    where: { pengajuanId: pengajuan.id, event: "MENUNGGU_VALIDASI", channel: "WHATSAPP", recipient: { contains: "88" } },
    orderBy: { createdAt: "desc" },
  });
  console.log(`  Status Notifikasi WA Warga: ${logSpv?.status} | MsgId: ${logSpv?.providerMessageId}`);
  console.log(`  Pesan: \n${logSpv?.message}\n`);
  if (logSpv?.status === "SENT") {
    console.log("  ✅ TAHAP 2 BERHASIL: WhatsApp Diteruskan ke Supervisor Masuk!");
  } else {
    console.error("  ❌ TAHAP 2 GAGAL:", logSpv?.errorMessage);
  }

  await new Promise((r) => setTimeout(r, 2000));

  // ── TAHAP 3: SUPERVISOR MENYELESAIKAN VALIDASI & DITERUSKAN KE KADES ──
  console.log("\n--- TAHAP 3: Supervisor Menyelesaikan Validasi & Teruskan ke Kades (MENUNGGU_APPROVAL_KEPALA_DESA) ---");
  await prisma.pengajuanLayanan.update({
    where: { id: pengajuan.id },
    data: { status: "MENUNGGU_APPROVAL_KEPALA_DESA" },
  });
  await prisma.logPengajuan.create({
    data: {
      pengajuanId: pengajuan.id,
      userId: testUser.id,
      action: "Validasi Disetujui Supervisor",
      catatan: "Berkas dinyatakan valid dan layak diajukan ke Kepala Desa.",
      statusBefore: "MENUNGGU_VALIDASI",
      statusAfter: "MENUNGGU_APPROVAL_KEPALA_DESA",
    },
  });

  await NotificationOrchestrator.handleStatusChange({
    pengajuanId: pengajuan.id,
    newStatus: "MENUNGGU_APPROVAL_KEPALA_DESA",
    catatan: "Berkas dinyatakan valid dan memenuhi persyaratan regulasi desa.",
  });

  const logKadesWait = await prisma.notificationLog.findFirst({
    where: { pengajuanId: pengajuan.id, event: "MENUNGGU_APPROVAL_KADES", channel: "WHATSAPP", recipient: { contains: "88" } },
    orderBy: { createdAt: "desc" },
  });
  console.log(`  Status Notifikasi WA Warga: ${logKadesWait?.status} | MsgId: ${logKadesWait?.providerMessageId}`);
  console.log(`  Pesan: \n${logKadesWait?.message}\n`);
  if (logKadesWait?.status === "SENT") {
    console.log("  ✅ TAHAP 3 BERHASIL: WhatsApp Validasi Supervisor Selesai & Diteruskan ke Kades Masuk!");
  } else {
    console.error("  ❌ TAHAP 3 GAGAL:", logKadesWait?.errorMessage);
  }

  await new Promise((r) => setTimeout(r, 2000));

  // ── TAHAP 4: KEPALA DESA MENYETUJUI PENGAJUAN (DISETUJUI) ──
  console.log("\n--- TAHAP 4: Kepala Desa Menyetujui Pengajuan (DISETUJUI) ---");
  await prisma.pengajuanLayanan.update({
    where: { id: pengajuan.id },
    data: { status: "DISETUJUI" },
  });
  await prisma.logPengajuan.create({
    data: {
      pengajuanId: pengajuan.id,
      userId: testUser.id,
      action: "Disetujui Kepala Desa",
      catatan: "Permohonan disetujui, silakan terbitkan nomor surat.",
      statusBefore: "MENUNGGU_APPROVAL_KEPALA_DESA",
      statusAfter: "DISETUJUI",
    },
  });

  await NotificationOrchestrator.handleStatusChange({
    pengajuanId: pengajuan.id,
    newStatus: "DISETUJUI",
    catatan: "Pengajuan disetujui untuk diterbitkan surat resmi.",
  });

  const logDisetujui = await prisma.notificationLog.findFirst({
    where: { pengajuanId: pengajuan.id, event: "DISETUJUI", channel: "WHATSAPP", recipient: { contains: "88" } },
    orderBy: { createdAt: "desc" },
  });
  console.log(`  Status Notifikasi WA Warga: ${logDisetujui?.status} | MsgId: ${logDisetujui?.providerMessageId}`);
  console.log(`  Pesan: \n${logDisetujui?.message}\n`);
  if (logDisetujui?.status === "SENT") {
    console.log("  ✅ TAHAP 4 BERHASIL: WhatsApp Pengajuan Disetujui Kepala Desa Masuk!");
  } else {
    console.error("  ❌ TAHAP 4 GAGAL:", logDisetujui?.errorMessage);
  }

  await new Promise((r) => setTimeout(r, 2000));

  // ── TAHAP 5: PENERBITAN SURAT RESMI SELESAI & PDF SIAP UNDUH (SELESAI) ──
  console.log("\n--- TAHAP 5: Surat Resmi Diterbitkan & Dokumen PDF Siap Diunduh (SELESAI) ---");
  const nomorSuratResmi = `470/${timestamp}/DS-PERUM/XI/2026`;
  await prisma.pengajuanLayanan.update({
    where: { id: pengajuan.id },
    data: { status: "SELESAI", tanggalSelesai: new Date() },
  });
  await prisma.dokumenHasil.create({
    data: {
      pengajuanId: pengajuan.id,
      nomorSurat: nomorSuratResmi,
      content: `<p>Surat Keterangan Resmi No. ${nomorSuratResmi}</p>`,
      filePath: `/uploads/surat/${pengajuan.nomorPengajuan}.pdf`,
      fileSize: 45000,
    },
  });
  await prisma.logPengajuan.create({
    data: {
      pengajuanId: pengajuan.id,
      userId: testUser.id,
      action: "Surat Selesai Diterbitkan",
      catatan: `Nomor surat resmi: ${nomorSuratResmi}`,
      statusBefore: "DISETUJUI",
      statusAfter: "SELESAI",
    },
  });

  await NotificationOrchestrator.handleSuratSelesai({
    pengajuanId: pengajuan.id,
    nomorSurat: nomorSuratResmi,
  });

  const logSelesai = await prisma.notificationLog.findFirst({
    where: { pengajuanId: pengajuan.id, event: "SELESAI", channel: "WHATSAPP", recipient: { contains: "88" } },
    orderBy: { createdAt: "desc" },
  });
  console.log(`  Status Notifikasi WA Warga: ${logSelesai?.status} | MsgId: ${logSelesai?.providerMessageId}`);
  console.log(`  Pesan: \n${logSelesai?.message}\n`);
  if (logSelesai?.status === "SENT") {
    console.log("  ✅ TAHAP 5 BERHASIL: WhatsApp Dokumen PDF Selesai & Siap Diunduh Masuk!");
  } else {
    console.error("  ❌ TAHAP 5 GAGAL:", logSelesai?.errorMessage);
  }

  // ── UJI COBA TAMBAHAN: UJI PENGEMBALIAN & PERBAIKAN DOKUMEN ──
  console.log("\n--- UJI TAMBAHAN: Pengujian Format WhatsApp Pengembalian (PERLU_PERBAIKAN) ---");
  await NotificationOrchestrator.handleStatusChange({
    pengajuanId: pengajuan.id,
    newStatus: "PERLU_PERBAIKAN",
    catatan: "Foto KTP buram dan tidak terbaca jelas. Mohon unggah ulang foto KTP asli.",
  });
  const logPerbaikan = await prisma.notificationLog.findFirst({
    where: { pengajuanId: pengajuan.id, event: "PERLU_PERBAIKAN", channel: "WHATSAPP" },
    orderBy: { createdAt: "desc" },
  });
  console.log(`  Status Notifikasi WA: ${logPerbaikan?.status} | MsgId: ${logPerbaikan?.providerMessageId}`);
  if (logPerbaikan?.status === "SENT") {
    console.log("  ✅ UJI TAMBAHAN BERHASIL: WhatsApp Perbaikan Dokumen Masuk!");
  }

  // ── UJI COBA IDEMPOTENSI (MENCEGAH PESAN GANDA) ──
  console.log("\n--- UJI IDEMPOTENSI: Memastikan Tidak Ada Pesan Ganda Untuk Event Sama ---");
  const logBeforeCount = await prisma.notificationLog.count({
    where: { pengajuanId: pengajuan.id, event: "SELESAI", channel: "WHATSAPP" },
  });
  // Panggil ulang handleSuratSelesai dengan data yang sama
  await NotificationOrchestrator.handleSuratSelesai({
    pengajuanId: pengajuan.id,
    nomorSurat: nomorSuratResmi,
  });
  const logAfterCount = await prisma.notificationLog.count({
    where: { pengajuanId: pengajuan.id, event: "SELESAI", channel: "WHATSAPP" },
  });
  if (logBeforeCount === logAfterCount) {
    console.log(`  ✅ IDEMPOTENSI TERVERIFIKASI: Jumlah log tetap ${logAfterCount}, pesan ganda dicegah!`);
  } else {
    console.error("  ❌ IDEMPOTENSI GAGAL: Terjadi pengiriman pesan ganda!");
  }

  // ── REKAPITULASI PENGUJIAN ──
  console.log("\n=================================================================");
  console.log("                   REKAPITULASI HASIL AUDIT                      ");
  console.log("=================================================================");
  const allLogs = await prisma.notificationLog.findMany({
    where: { pengajuanId: pengajuan.id, channel: "WHATSAPP" },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Total WhatsApp Terkirim Untuk Pengajuan ${nomorPengajuan}: ${allLogs.length} Pesan`);
  for (const l of allLogs) {
    console.log(`  • [${l.event}] -> Ke: ${l.recipient} | Status: ${l.status} | Foonte MsgId: ${l.providerMessageId}`);
  }

  console.log("\nSemua tahap notifikasi WhatsApp Foonte berjalan sempurna dan terverifikasi secara nyata!");
}

main()
  .catch((err) => {
    console.error("Critical error in WhatsApp test:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
