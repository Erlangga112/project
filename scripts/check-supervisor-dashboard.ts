import prisma from "../src/lib/prisma";

async function checkSupervisorDashboardData() {
  console.log("=== NILAI WIDGET DASHBOARD SUPERVISOR AKTUAL ===");
  const [
    totalPengajuan,
    menungguValidasi,
    disetujui,
    ditolak,
    totalUsers,
    totalWarga,
    totalStaf,
    selesai,
    dalamProses,
  ] = await Promise.all([
    // Widget 1: Total Pengajuan
    prisma.pengajuanLayanan.count(),
    // Widget 2: Menunggu Validasi
    prisma.pengajuanLayanan.count({ where: { status: "MENUNGGU_VALIDASI" } }),
    // Widget 3: Disetujui (definisi di supervisor/page.tsx: DISETUJUI_SUPERVISOR, MENUNGGU_APPROVAL_KEPALA_DESA, DISETUJUI, SELESAI)
    prisma.pengajuanLayanan.count({
      where: {
        status: {
          in: ["DISETUJUI_SUPERVISOR", "MENUNGGU_APPROVAL_KEPALA_DESA", "DISETUJUI", "SELESAI"],
        },
      },
    }),
    // Widget 4: Ditolak
    prisma.pengajuanLayanan.count({ where: { status: "DITOLAK" } }),
    // Widget 5: Basis Data Pengguna
    prisma.user.count(),
    // Data Warga
    prisma.user.count({ where: { role: "WARGA" } }),
    // Data Staf
    prisma.user.count({ where: { role: "STAF_DESA" } }),
    // Status Selesai
    prisma.pengajuanLayanan.count({ where: { status: "SELESAI" } }),
    // Status Sedang Diproses (not in SELESAI, DITOLAK)
    prisma.pengajuanLayanan.count({ where: { status: { notIn: ["SELESAI", "DITOLAK"] } } }),
  ]);

  console.log({
    totalPengajuan,
    menungguValidasi,
    disetujui,
    ditolak,
    totalUsers,
    totalWarga,
    totalStaf,
    selesai,
    dalamProses,
  });

  const statusBreakdown = await prisma.pengajuanLayanan.groupBy({
    by: ["status"],
    _count: { id: true },
  });
  console.log("Rincian status aktual di DB:", statusBreakdown);

  await prisma.$disconnect();
}

checkSupervisorDashboardData();

