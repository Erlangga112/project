import prisma from "@/lib/prisma";

export interface UserStatsResult {
  totalAkun: number;
  wargaCount: number;
  stafCount: number;
  supervisorCount: number;
  kadesCount: number;
  wargaAktif: number;
  wargaPindah: number;
  wargaMeninggal: number;
  totalProfilWarga: number;
}

export interface PelayananStatsResult {
  totalPengajuan: number;
  pengajuanBelumSelesai: number;
  statusCounts: Record<string, number>;
  layananBreakdown: Array<{ nama: string; count: number }>;
  bulanIni: {
    bulanNama: string;
    total: number;
    selesai: number;
  };
  /**
   * Metrik sinkron dengan widget Dashboard Supervisor (src/app/supervisor/page.tsx).
   * Definisi identik dengan kartu statistik yang ditampilkan di dashboard.
   */
  /** Widget "Disetujui": DISETUJUI_SUPERVISOR + MENUNGGU_APPROVAL_KEPALA_DESA + DISETUJUI + SELESAI */
  disetujui: number;
  /** Widget "Ditolak": DITOLAK */
  ditolak: number;
  /** Widget "Sedang Diproses": semua status selain SELESAI dan DITOLAK */
  sedangDiproses: number;
  /** Widget "Menunggu Validasi": MENUNGGU_VALIDASI */
  menungguValidasi: number;
  /** Status SELESAI saja */
  selesai: number;
}

/**
 * Mengambil statistik pengguna dan warga secara langsung dari database aktual.
 * Konsisten dengan sumber data di Halaman Manajemen Pengguna.
 */
export async function getActualUserStats(): Promise<UserStatsResult> {
  const [
    totalAkun,
    roleCounts,
    wargaProfiles,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.groupBy({
      by: ["role"],
      _count: { id: true },
    }),
    // Hitung status warga HANYA untuk pengguna yang ber-role WARGA (menghindari profil staf dihitung sebagai warga)
    prisma.profilWarga.findMany({
      where: {
        user: {
          role: "WARGA",
        },
      },
      select: {
        status: true,
      },
    }),
  ]);

  const roleMap: Record<string, number> = {
    WARGA: 0,
    STAF_DESA: 0,
    SUPERVISOR: 0,
    KEPALA_DESA: 0,
  };

  for (const r of roleCounts) {
    roleMap[r.role] = r._count.id;
  }

  let wargaAktif = 0;
  let wargaPindah = 0;
  let wargaMeninggal = 0;

  for (const p of wargaProfiles) {
    if (p.status === "AKTIF") wargaAktif++;
    else if (p.status === "PINDAH") wargaPindah++;
    else if (p.status === "MENINGGAL") wargaMeninggal++;
  }

  return {
    totalAkun,
    wargaCount: roleMap["WARGA"] || 0,
    stafCount: roleMap["STAF_DESA"] || 0,
    supervisorCount: roleMap["SUPERVISOR"] || 0,
    kadesCount: roleMap["KEPALA_DESA"] || 0,
    wargaAktif,
    wargaPindah,
    wargaMeninggal,
    totalProfilWarga: wargaProfiles.length,
  };
}

/**
 * Mengambil statistik pengajuan pelayanan secara langsung dari database aktual.
 */
export async function getActualPelayananStats(): Promise<PelayananStatsResult> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const bulanNama = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const [
    totalPengajuan,
    pengajuanBelumSelesai,
    statusGroup,
    jenisLayananGroup,
    bulanTotal,
    bulanSelesai,
  ] = await Promise.all([
    prisma.pengajuanLayanan.count(),
    prisma.pengajuanLayanan.count({
      where: {
        status: {
          notIn: ["SELESAI", "DITOLAK"],
        },
      },
    }),
    prisma.pengajuanLayanan.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    prisma.pengajuanLayanan.groupBy({
      by: ["jenisLayananId"],
      _count: { id: true },
    }),
    prisma.pengajuanLayanan.count({
      where: {
        tanggalPengajuan: { gte: startOfMonth },
      },
    }),
    prisma.pengajuanLayanan.count({
      where: {
        tanggalPengajuan: { gte: startOfMonth },
        status: "SELESAI",
      },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const sg of statusGroup) {
    statusCounts[sg.status] = sg._count.id;
  }

  const jenisLayananIds = jenisLayananGroup.map((j) => j.jenisLayananId);
  const layananMaster = await prisma.jenisLayanan.findMany({
    where: { id: { in: jenisLayananIds } },
    select: { id: true, nama: true },
  });

  const layananBreakdown = jenisLayananGroup.map((j) => {
    const item = layananMaster.find((l) => l.id === j.jenisLayananId);
    return {
      nama: item?.nama || "Layanan Lainnya",
      count: j._count.id,
    };
  });

  // ── Metrik sinkron dengan widget Dashboard Supervisor (src/app/supervisor/page.tsx) ──
  // Widget "Disetujui": status in [DISETUJUI_SUPERVISOR, MENUNGGU_APPROVAL_KEPALA_DESA, DISETUJUI, SELESAI]
  const disetujui =
    (statusCounts["DISETUJUI_SUPERVISOR"] || 0) +
    (statusCounts["MENUNGGU_APPROVAL_KEPALA_DESA"] || 0) +
    (statusCounts["DISETUJUI"] || 0) +
    (statusCounts["SELESAI"] || 0);

  // Widget "Ditolak": status DITOLAK saja
  const ditolak = statusCounts["DITOLAK"] || 0;

  // Widget "Sedang Diproses": selain SELESAI dan DITOLAK (sama dengan pengajuanBelumSelesai)
  const sedangDiproses = pengajuanBelumSelesai;

  // Widget "Menunggu Validasi": MENUNGGU_VALIDASI saja
  const menungguValidasi = statusCounts["MENUNGGU_VALIDASI"] || 0;

  // Selesai saja
  const selesai = statusCounts["SELESAI"] || 0;

  return {
    totalPengajuan,
    pengajuanBelumSelesai,
    statusCounts,
    layananBreakdown,
    bulanIni: {
      bulanNama,
      total: bulanTotal,
      selesai: bulanSelesai,
    },
    disetujui,
    ditolak,
    sedangDiproses,
    menungguValidasi,
    selesai,
  };
}
