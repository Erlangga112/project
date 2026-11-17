import prisma from "@/lib/prisma";
import { ChatRole } from "./roles";
import { getActualUserStats, getActualPelayananStats } from "./stats";

export interface ChatbotContextData {
  role: ChatRole;
  userName?: string;
  contextText: string;
}

export async function getAuthorizedChatbotContext(
  role: ChatRole,
  userId?: string
): Promise<ChatbotContextData> {
  // Always fetch active services for reference
  const activeLayanan = await prisma.jenisLayanan.findMany({
    where: { isActive: true },
    select: {
      id: true,
      kode: true,
      nama: true,
      deskripsi: true,
      persyaratan: true,
      estimasiWaktu: true,
    },
    orderBy: { nama: "asc" },
  });

  let layananFormatted = "DAFTAR LAYANAN SURAT DESA YANG AKTIF DI SISTEM:\n";
  for (const l of activeLayanan) {
    let reqs: string[] = [];
    try {
      reqs = JSON.parse(l.persyaratan);
    } catch {
      reqs = [l.persyaratan];
    }
    layananFormatted += `• [${l.kode}] ${l.nama}\n`;
    layananFormatted += `  - Estimasi Proses: ${l.estimasiWaktu} hari kerja\n`;
    layananFormatted += `  - Deskripsi: ${l.deskripsi || "Pelayanan persuratan administrasi desa"}\n`;
    layananFormatted += `  - Persyaratan: ${reqs.join(", ")}\n`;
  }

  // 1. GUEST Context
  if (role === "GUEST" || !userId) {
    const guestText = `
=== DATA KONTEKS PUBLIK DESA ===
Nama Desa: Desa Perum, Kota Cirebon
Jam Pelayanan Kantor Desa: Senin s/d Jumat, Pukul 08.00 - 15.00 WIB (Hari Sabtu, Minggu & Hari Libur Nasional Tutup)
Alamat Kantor: Kantor Pelayanan Terpadu Desa Perum
Biaya Pelayanan: Seluruh pelayanan administrasi persuratan desa adalah GRATIS (Rp 0).

${layananFormatted}

INFORMASI TAMBAHAN PUBLIK:
- Untuk mengajukan surat atau memeriksa status pengajuan pribadi, masyarakat wajib login/masuk ke akun warga.
- Jika belum memiliki akun, masyarakat dapat mendaftar melalui halaman registrasi.
`;
    return { role: "GUEST", contextText: guestText };
  }

  // Fetch current user details
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { profilWarga: true },
  });

  const userName = currentUser?.nama || currentUser?.profilWarga?.namaLengkap || "Pengguna";

  // 2. WARGA (Masyarakat) Context
  if (role === "WARGA") {
    // ONLY fetch user's OWN applications! Cross-user data is NEVER queried!
    const userPengajuan = await prisma.pengajuanLayanan.findMany({
      where: { pemohonId: userId },
      include: {
        jenisLayanan: true,
        dokumenHasil: true,
      },
      orderBy: { tanggalPengajuan: "desc" },
    });

    let pengajuanText = `DATA PENGAJUAN SURAT MILIK ANDA (${userName}):\n`;
    if (userPengajuan.length === 0) {
      pengajuanText += "Saat ini Anda belum memiliki pengajuan surat di sistem.\n";
    } else {
      userPengajuan.forEach((p, idx) => {
        const tgl = new Date(p.tanggalPengajuan).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        pengajuanText += `${idx + 1}. Nomor Registrasi: ${p.nomorPengajuan}\n`;
        pengajuanText += `   - Layanan: ${p.jenisLayanan.nama} (${p.jenisLayanan.kode})\n`;
        pengajuanText += `   - Status Saat Ini: ${p.status}\n`;
        pengajuanText += `   - Tanggal Pengajuan: ${tgl}\n`;
        if (p.status === "SELESAI" && p.dokumenHasil) {
          pengajuanText += `   - Nomor Surat Sah: ${p.dokumenHasil.nomorSurat} (SIAP DICETAK via link /surat/${p.dokumenHasil.id})\n`;
        } else {
          pengajuanText += `   - Pratinjau Draft: /surat/preview/${p.id}\n`;
        }
        pengajuanText += `   - Catatan: ${p.catatan || "Tidak ada catatan"}\n`;
      });
    }

    const wargaText = `
=== KONTEKS DATA WARGA ===
Nama Pengguna: ${userName}
Role: Masyarakat / Warga
NIK: ${currentUser?.profilWarga?.nik ? `${currentUser.profilWarga.nik.slice(0, 6)}******` : "Belum terdata"}
Alamat Terdaftar: ${currentUser?.profilWarga?.alamat || "Desa Perum"}

${pengajuanText}

${layananFormatted}

KETENTUAN PRIVASI:
- Pengguna hanya memiliki akses ke pengajuan miliknya sendiri di atas.
- Tidak ada data warga lain yang boleh diakses atau dibagikan.
`;
    return { role: "WARGA", userName, contextText: wargaText };
  }

  // 3. STAF_DESA (Operator / Petugas Pelayanan & Admin Desa) Context
  if (role === "STAF_DESA") {
    const [
      antrean,
      totalAntrean,
      userStats,
      pelayananStats,
      daftarTerbaru,
      daftarAparatur,
      sampleWarga,
    ] = await Promise.all([
      // Submissions queue that require operator attention
      prisma.pengajuanLayanan.findMany({
        where: {
          status: {
            in: ["DIAJUKAN", "DIPERIKSA", "PERLU_PERBAIKAN", "MENUNGGU_VALIDASI"],
          },
        },
        include: {
          pemohon: { select: { nama: true } },
          jenisLayanan: { select: { nama: true, estimasiWaktu: true } },
        },
        orderBy: { tanggalPengajuan: "asc" },
        take: 15,
      }),
      prisma.pengajuanLayanan.count({
        where: {
          status: {
            in: ["DIAJUKAN", "DIPERIKSA", "PERLU_PERBAIKAN", "MENUNGGU_VALIDASI"],
          },
        },
      }),
      getActualUserStats(),
      getActualPelayananStats(),
      // Riwayat pengajuan terbaru dari seluruh status (termasuk SELESAI & DITOLAK)
      prisma.pengajuanLayanan.findMany({
        orderBy: { tanggalPengajuan: "desc" },
        include: {
          pemohon: { select: { nama: true } },
          jenisLayanan: { select: { nama: true } },
          dokumenHasil: { select: { nomorSurat: true } },
        },
        take: 15,
      }),
      // Daftar seluruh aparatur desa (Staf, Supervisor, Kepala Desa)
      prisma.user.findMany({
        where: {
          role: { in: ["STAF_DESA", "SUPERVISOR", "KEPALA_DESA"] },
        },
        select: {
          nama: true,
          email: true,
          role: true,
        },
      }),
      // Sampel data kependudukan warga terdaftar
      prisma.profilWarga.findMany({
        include: {
          user: { select: { nama: true, email: true } },
        },
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    let antreanText = `ANTREAN PENGAJUAN PELAYANAN AKTIF (Total Antrean: ${totalAntrean}):\n`;
    if (antrean.length === 0) {
      antreanText += "Saat ini antrean pengajuan bersih / tidak ada pengajuan yang tertunda diproses.\n";
    } else {
      antrean.forEach((item, idx) => {
        const tgl = new Date(item.tanggalPengajuan).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        antreanText += `${idx + 1}. [${item.nomorPengajuan}] - ${item.jenisLayanan.nama}\n`;
        antreanText += `   - Pemohon: ${item.pemohon.nama}\n`;
        antreanText += `   - Status: ${item.status}\n`;
        antreanText += `   - Diajukan: ${tgl}\n`;
        antreanText += `   - Catatan: ${item.catatan || "-"}\n`;
      });
    }

    let berkasTerbaruText = `RIWAYAT PENGAJUAN TERBARU SISTEM (15 BERKAS TERAKHIR):\n`;
    if (daftarTerbaru.length === 0) {
      berkasTerbaruText += "Belum ada berkas pengajuan yang tercatat di sistem.\n";
    } else {
      daftarTerbaru.forEach((item, idx) => {
        const tgl = new Date(item.tanggalPengajuan).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const noSurat = item.dokumenHasil?.nomorSurat ? ` (No. Surat: ${item.dokumenHasil.nomorSurat})` : "";
        berkasTerbaruText += `${idx + 1}. [${item.nomorPengajuan}] ${item.jenisLayanan.nama} - Pemohon: ${item.pemohon.nama} | Status: ${item.status}${noSurat} | Tanggal: ${tgl}\n`;
        if (item.catatan) {
          berkasTerbaruText += `   Catatan/Alasan: ${item.catatan}\n`;
        }
      });
    }

    const stafList = daftarAparatur.filter((a) => a.role === "STAF_DESA");
    const spvList = daftarAparatur.filter((a) => a.role === "SUPERVISOR");
    const kadesList = daftarAparatur.filter((a) => a.role === "KEPALA_DESA");

    let aparaturText = `DATA APARATUR DESA TERDAFTAR:\n`;
    aparaturText += `• Staf Pelayanan / Operator Desa (${stafList.length} orang):\n`;
    stafList.forEach((s) => {
      aparaturText += `  - ${s.nama || "Staf"} (${s.email})\n`;
    });
    aparaturText += `• Supervisor Pelayanan (${spvList.length} orang):\n`;
    spvList.forEach((s) => {
      aparaturText += `  - ${s.nama || "Supervisor"} (${s.email})\n`;
    });
    aparaturText += `• Kepala Desa (${kadesList.length} orang):\n`;
    kadesList.forEach((k) => {
      aparaturText += `  - ${k.nama || "Kepala Desa"} (${k.email})\n`;
    });

    let kependudukanSampleText = `SAMPEL DATA WARGA & KEPENDUDUKAN DESA TERDAFTAR:\n`;
    sampleWarga.forEach((w, idx) => {
      const nama = w.user?.nama || w.namaLengkap || "Warga";
      kependudukanSampleText += `${idx + 1}. ${nama} | NIK: ${w.nik || "-"} | RT/RW: ${w.rt || "001"}/${w.rw || "001"} | Alamat: ${w.alamat || "Desa Perum"} | Status: ${w.status || "AKTIF"}\n`;
    });

    const breakdownLayananText = pelayananStats.layananBreakdown.length > 0
      ? pelayananStats.layananBreakdown.map((l) => `• ${l.nama}: ${l.count} permohonan`).join("\n")
      : "Belum ada pengajuan per jenis layanan.";

    const stafText = `
=== KONTEKS DATA OPERATOR PELAYANAN & STAF DESA ===
Nama Petugas: ${userName}
Role: Operator / Petugas Pelayanan Desa (STAF_DESA)

=== REKAP LENGKAP SELURUH DATABASE PENGAJUAN PELAYANAN DESA ===
Total Seluruh Pengajuan: ${pelayananStats.totalPengajuan} permohonan
Rincian Status Berkas:
• Baru Masuk (DIAJUKAN): ${pelayananStats.statusCounts["DIAJUKAN"] || 0} berkas
• Sedang Diverifikasi Operator (DIPERIKSA): ${pelayananStats.statusCounts["DIPERIKSA"] || 0} berkas
• Perlu Perbaikan oleh Warga (PERLU_PERBAIKAN): ${pelayananStats.statusCounts["PERLU_PERBAIKAN"] || 0} berkas
• Menunggu Validasi Supervisor (MENUNGGU_VALIDASI): ${pelayananStats.statusCounts["MENUNGGU_VALIDASI"] || 0} berkas
• Disetujui Supervisor (DISETUJUI_SUPERVISOR): ${pelayananStats.statusCounts["DISETUJUI_SUPERVISOR"] || 0} berkas
• Menunggu Pengesahan Kades (MENUNGGU_APPROVAL_KEPALA_DESA): ${pelayananStats.statusCounts["MENUNGGU_APPROVAL_KEPALA_DESA"] || 0} berkas
• Disetujui Kepala Desa (DISETUJUI): ${pelayananStats.statusCounts["DISETUJUI"] || 0} berkas
• Selesai / Dokumen Sah Terbit (SELESAI): ${pelayananStats.statusCounts["SELESAI"] || 0} berkas
• Ditolak (DITOLAK): ${pelayananStats.statusCounts["DITOLAK"] || 0} berkas

Rekap Pengajuan Bulan Ini (${pelayananStats.bulanIni.bulanNama}):
• Total Berkas Masuk Bulan Ini: ${pelayananStats.bulanIni.total} berkas
• Berkas Selesai Bulan Ini: ${pelayananStats.bulanIni.selesai} berkas

Rincian Jumlah Pengajuan per Jenis Layanan:
${breakdownLayananText}

=== DATA PENGGUNA & KEPENDUDUKAN AKTUAL (DATABASE SISTEM) ===
Total Seluruh Akun Pengguna: ${userStats.totalAkun} akun
- Jumlah Akun Warga: ${userStats.wargaCount} akun
- Jumlah Akun Staf / Operator Pelayanan: ${userStats.stafCount} akun
- Jumlah Akun Supervisor: ${userStats.supervisorCount} akun
- Jumlah Akun Kepala Desa: ${userStats.kadesCount} akun

Rincian Status Kependudukan Warga Terdaftar:
- Warga Status Aktif: ${userStats.wargaAktif} orang
- Warga Status Pindah: ${userStats.wargaPindah} orang
- Warga Status Meninggal: ${userStats.wargaMeninggal} orang
- Total Data Profil Warga: ${userStats.totalProfilWarga} data

${aparaturText}

${kependudukanSampleText}

${antreanText}

${berkasTerbaruText}

${layananFormatted}

SOP ALUR PELAYANAN DAN VERIFIKASI:
1. Tahap Masuk: Pengajuan berstatus "DIAJUKAN" diperiksa berkas persyaratannya oleh Petugas Staf.
2. Tahap Pemeriksaan: Status diubah menjadi "DIPERIKSA" saat berkas sedang diteliti.
3. Jika Berkas Tidak Lengkap: Ubah status menjadi "PERLU_PERBAIKAN" dengan mencantumkan catatan perbaikan spesifik.
4. Jika Berkas Lengkap: Ajukan berkas ke Supervisor dengan status "MENUNGGU_VALIDASI".
5. Validasi Supervisor: Supervisor memeriksa dan menyetujui ("DISETUJUI_SUPERVISOR") lalu diajukan ke Kepala Desa ("MENUNGGU_APPROVAL_KEPALA_DESA").
6. Pengesahan Kepala Desa: Kepala Desa menyetujui ("DISETUJUI"), dokumen surat diterbitkan dan selesai ("SELESAI").
7. Jika Pengajuan Ditolak: Status diubah menjadi "DITOLAK" dengan alasan penolakan yang jelas.

ATURAN OPERATOR:
- Operator memiliki akses penuh terhadap seluruh informasi database pelayanan desa (pengajuan masuk, berkas ditolak, berkas selesai, master layanan, aparatur, dan data kependudukan).
- Jika operator menanyakan jumlah warga, jumlah pengajuan, berkas yang ditolak, berkas yang selesai, atau statistik layanan, berikan jawaban secara langsung dan tepat menggunakan angka riil dari blok konteks database di atas.
- Chatbot TIDAK DAPAT menyetujui pengajuan secara otomatis. Persetujuan harus dilakukan petugas melalui tombol resmi di dashboard.
`;
    return { role: "STAF_DESA", userName, contextText: stafText };
  }

  // 4. SUPERVISOR Context (Actual aggregated statistics from DB)
  if (role === "SUPERVISOR") {
    const [
      totalPengajuan,
      statusCounts,
      jenisLayananGroup,
      allActiveList,
      userStats,
    ] = await Promise.all([
      prisma.pengajuanLayanan.count(),
      prisma.pengajuanLayanan.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.pengajuanLayanan.groupBy({
        by: ["jenisLayananId"],
        _count: { id: true },
      }),
      prisma.pengajuanLayanan.findMany({
        where: {
          status: { notIn: ["SELESAI", "DITOLAK"] },
        },
        include: { jenisLayanan: true },
      }),
      getActualUserStats(),
    ]);

    // Calculate delayed applications based on tanggalPengajuan + estimasiWaktu
    const now = new Date();
    const delayedItems = allActiveList.filter((item) => {
      const created = new Date(item.tanggalPengajuan);
      const estDays = item.jenisLayanan.estimasiWaktu || 3;
      const deadline = new Date(created.getTime() + estDays * 24 * 60 * 60 * 1000);
      return now > deadline;
    });

    // Formatted status map
    const statusMap: Record<string, number> = {};
    statusCounts.forEach((s) => {
      statusMap[s.status] = s._count.id;
    });

    // Match service names for breakdown
    const jenisLayananIds = jenisLayananGroup.map((j) => j.jenisLayananId);
    const jenisLayananRef = await prisma.jenisLayanan.findMany({
      where: { id: { in: jenisLayananIds } },
      select: { id: true, nama: true },
    });
    const jenisLayananStats = jenisLayananGroup.map((j) => {
      const match = jenisLayananRef.find((r) => r.id === j.jenisLayananId);
      return {
        nama: match?.nama || "Layanan Lainnya",
        count: j._count.id,
      };
    });

    const nowMonth = now.getMonth();
    const nowYear = now.getFullYear();
    const startOfMonth = new Date(nowYear, nowMonth, 1);
    const monthlyTotal = await prisma.pengajuanLayanan.count({
      where: { tanggalPengajuan: { gte: startOfMonth } },
    });
    const monthlyDone = await prisma.pengajuanLayanan.count({
      where: {
        tanggalPengajuan: { gte: startOfMonth },
        status: "SELESAI",
      },
    });

    let delayedText = `Pengajuan Tertunda Melebihi Estimasi Waktu: ${delayedItems.length} berkas\n`;
    if (delayedItems.length > 0) {
      delayedItems.slice(0, 5).forEach((d, idx) => {
        delayedText += `  ${idx + 1}. [${d.nomorPengajuan}] - ${d.jenisLayanan.nama} (Status: ${d.status})\n`;
      });
    }

    const supervisorText = `
=== DATA STATISTIK PENGGUNA & KEPENDUDUKAN (SUPERVISOR) ===
Total Seluruh Akun Pengguna: ${userStats.totalAkun} akun
- Jumlah Akun Warga: ${userStats.wargaCount} akun
- Jumlah Akun Operator / Staf Pelayanan: ${userStats.stafCount} akun
- Jumlah Akun Supervisor: ${userStats.supervisorCount} akun
- Jumlah Akun Kepala Desa: ${userStats.kadesCount} akun
- Status Warga: ${userStats.wargaAktif} Aktif, ${userStats.wargaPindah} Pindah, ${userStats.wargaMeninggal} Meninggal

=== WIDGET DASHBOARD SUPERVISOR — SUMBER DATA WAJIB UNTUK SEMUA JAWABAN ===
Data berikut IDENTIK dengan 5 widget kartu statistik yang ditampilkan di halaman Dashboard Supervisor.
Jika pengguna menanyakan angka statistik, WAJIB menggunakan angka dari sini. JANGAN menghitung ulang sendiri.

Widget 1 — Total Pengajuan      : ${totalPengajuan} berkas  (seluruh record di tabel pengajuan)
Widget 2 — Menunggu Validasi    : ${statusMap["MENUNGGU_VALIDASI"] || 0} berkas  (status MENUNGGU_VALIDASI)
Widget 3 — Disetujui            : ${(statusMap["DISETUJUI_SUPERVISOR"] || 0) + (statusMap["MENUNGGU_APPROVAL_KEPALA_DESA"] || 0) + (statusMap["DISETUJUI"] || 0) + (statusMap["SELESAI"] || 0)} berkas  (mencakup: DISETUJUI_SUPERVISOR + MENUNGGU_APPROVAL_KEPALA_DESA + DISETUJUI + SELESAI)
Widget 4 — Ditolak              : ${statusMap["DITOLAK"] || 0} berkas  (status DITOLAK)
Widget 5 — Basis Data Pengguna  : ${userStats.totalAkun} akun  (seluruh akun pengguna)

Statistik tambahan sinkron dashboard:
- Pengajuan Selesai      : ${statusMap["SELESAI"] || 0} berkas  (status SELESAI saja)
- Pengajuan Diproses     : ${totalPengajuan - (statusMap["SELESAI"] || 0) - (statusMap["DITOLAK"] || 0)} berkas  (semua status selain SELESAI dan DITOLAK)
- Total Warga            : ${userStats.wargaCount} akun  (role WARGA)
- Total Staf Desa        : ${userStats.stafCount} akun  (role STAF_DESA)

=== DATA STATISTIK PENGAJUAN PELAYANAN AKTUAL (SUPERVISOR) ===
Total Seluruh Pengajuan di Sistem: ${totalPengajuan} berkas
Total Pengajuan Bulan Ini (${now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}): ${monthlyTotal} berkas (Selesai: ${monthlyDone})

RINCIAN BERDASARKAN STATUS PENGAJUAN (DATA RIIL DATABASE):
- DIAJUKAN (Baru masuk): ${statusMap["DIAJUKAN"] || 0}
- DIPERIKSA (Sedang diperiksa operator): ${statusMap["DIPERIKSA"] || 0}
- PERLU_PERBAIKAN (Menunggu perbaikan warga): ${statusMap["PERLU_PERBAIKAN"] || 0}
- MENUNGGU_VALIDASI (Menunggu persetujuan Supervisor): ${statusMap["MENUNGGU_VALIDASI"] || 0}
- DISETUJUI_SUPERVISOR (Telah disetujui Supervisor): ${statusMap["DISETUJUI_SUPERVISOR"] || 0}
- MENUNGGU_APPROVAL_KEPALA_DESA (Antrean TTD Kades): ${statusMap["MENUNGGU_APPROVAL_KEPALA_DESA"] || 0}
- DISETUJUI (Disetujui Kades): ${statusMap["DISETUJUI"] || 0}
- SELESAI (Dokumen telah terbit): ${statusMap["SELESAI"] || 0}
- DITOLAK: ${statusMap["DITOLAK"] || 0}

${delayedText}

RINCIAN BERDASARKAN JENIS LAYANAN:
${jenisLayananStats.length > 0 ? jenisLayananStats.map((s) => `• ${s.nama}: ${s.count} pengajuan`).join("\n") : "Belum ada pengajuan"}

ATURAN SUPERVISOR:
- Semua angka statistik di atas BERSUMBER LANGSUNG DARI DATABASE AKTUAL.
- JANGAN PERNAH mengarang atau memanipulasi angka.
- Jika pengguna menanyakan angka jumlah warga atau laporan, gunakan persis data di atas.
- Kata "Disetujui" mencakup 4 status: DISETUJUI_SUPERVISOR, MENUNGGU_APPROVAL_KEPALA_DESA, DISETUJUI, dan SELESAI.
  Total disetujui = ${(statusMap["DISETUJUI_SUPERVISOR"] || 0) + (statusMap["MENUNGGU_APPROVAL_KEPALA_DESA"] || 0) + (statusMap["DISETUJUI"] || 0) + (statusMap["SELESAI"] || 0)} berkas (sesuai Widget 3 Dashboard Supervisor).
`;
    return { role: "SUPERVISOR", userName, contextText: supervisorText };
  }

  // 5. KEPALA_DESA Context (Executive Summary & Pending Approvals)
  if (role === "KEPALA_DESA") {
    const [
      totalPengajuan,
      selesai,
      ditolak,
      menungguKades,
      jenisLayananGroup,
      userStats,
    ] = await Promise.all([
      prisma.pengajuanLayanan.count(),
      prisma.pengajuanLayanan.count({ where: { status: "SELESAI" } }),
      prisma.pengajuanLayanan.count({ where: { status: "DITOLAK" } }),
      prisma.pengajuanLayanan.findMany({
        where: { status: "MENUNGGU_APPROVAL_KEPALA_DESA" },
        include: {
          pemohon: { select: { nama: true } },
          jenisLayanan: { select: { nama: true } },
        },
        orderBy: { tanggalPengajuan: "asc" },
      }),
      prisma.pengajuanLayanan.groupBy({
        by: ["jenisLayananId"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      getActualUserStats(),
    ]);

    const processed = selesai + ditolak;
    const approvalRate = processed > 0 ? ((selesai / processed) * 100).toFixed(1) : "100";

    const jenisLayananIds = jenisLayananGroup.map((j) => j.jenisLayananId);
    const jenisLayananRef = await prisma.jenisLayanan.findMany({
      where: { id: { in: jenisLayananIds } },
      select: { id: true, nama: true },
    });
    const topLayanan = jenisLayananGroup.map((j) => {
      const match = jenisLayananRef.find((r) => r.id === j.jenisLayananId);
      return `• ${match?.nama || "Layanan Lain"}: ${j._count.id} permohonan`;
    });

    let pendingListText = `Pengajuan Menunggu Persetujuan / Pengesahan Kepala Desa: ${menungguKades.length} berkas\n`;
    if (menungguKades.length === 0) {
      pendingListText += "Tidak ada berkas yang saat ini menunggu tanda tangan Kepala Desa.\n";
    } else {
      menungguKades.forEach((item, idx) => {
        pendingListText += `  ${idx + 1}. [${item.nomorPengajuan}] - ${item.jenisLayanan.nama} (Pemohon: ${item.pemohon.nama})\n`;
      });
    }

    const kadesText = `
=== LAPORAN EKSEKUTIF PELAYANAN DESA (UNTUK KEPALA DESA) ===
Pimpinan: ${userName}
Role: Kepala Desa / Pejabat Berwenang

RINGKASAN EKSEKUTIF PENGGUNA & KEPENDUDUKAN:
- Total Seluruh Akun Terdaftar: ${userStats.totalAkun} akun
- Jumlah Akun Warga: ${userStats.wargaCount} akun
- Jumlah Operator & Staf Desa: ${userStats.stafCount} akun
- Status Warga Terdaftar: ${userStats.wargaAktif} Aktif, ${userStats.wargaPindah} Pindah

RINGKASAN EKSEKUTIF KINERJA PELAYANAN:
- Total Seluruh Pengajuan Masuk: ${totalPengajuan} berkas
- Pengajuan Telah Selesai Diterbitkan: ${selesai} berkas
- Pengajuan Ditolak: ${ditolak} berkas
- Rasio Persetujuan/Penyelesaian: ${approvalRate}%
- Berkas Sedang Berjalan dalam Proses: ${totalPengajuan - selesai - ditolak} berkas

${pendingListText}

TREN PERMOHONAN LAYANAN MASYARAKAT:
${topLayanan.length > 0 ? topLayanan.join("\n") : "Belum ada permohonan tercatat"}

PEDOMAN KEPALA DESA:
- Bedakan antara fakta data riil, evaluasi kinerja, dan rekomendasi kebijakan pelayanan desa.
- Persetujuan resmi dokumen surat tetap dilakukan melalui fitur tanda tangan / persetujuan resmi sistem.
`;
    return { role: "KEPALA_DESA", userName, contextText: kadesText };
  }

  // Fallback to Guest/Public if unknown
  return { role: "GUEST", contextText: layananFormatted };
}
