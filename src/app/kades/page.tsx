import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import StatCard from "@/components/dashboard/StatCard";
import StatusBadge from "@/components/dashboard/StatusBadge";
import Link from "next/link";

export const metadata = {
  title: "Dashboard Kepala Desa — Sistem Pelayanan Desa Perum",
};

export default async function KadesDashboard() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "KEPALA_DESA") {
    redirect("/unauthorized");
  }

  const [total, selesai, ditolak, berjalan, byJenis] = await Promise.all([
    prisma.pengajuanLayanan.count(),
    prisma.pengajuanLayanan.count({ where: { status: "SELESAI" } }),
    prisma.pengajuanLayanan.count({ where: { status: "DITOLAK" } }),
    prisma.pengajuanLayanan.count({
      where: {
        status: {
          in: [
            "DIAJUKAN",
            "DIPERIKSA",
            "PERLU_PERBAIKAN",
            "MENUNGGU_VALIDASI",
            "DISETUJUI_SUPERVISOR",
            "MENUNGGU_APPROVAL_KEPALA_DESA",
            "DISETUJUI",
          ],
        },
      },
    }),
    prisma.pengajuanLayanan.groupBy({
      by: ["jenisLayananId"],
      _count: { id: true },
    }),
  ]);

  const layananIds = byJenis.map((b) => b.jenisLayananId);
  const jenisLayananList = await prisma.jenisLayanan.findMany({
    where: { id: { in: layananIds } },
    select: { id: true, nama: true },
  });

  const statistikLayanan = byJenis.map((b) => ({
    nama:
      jenisLayananList.find((j) => j.id === b.jenisLayananId)?.nama ||
      "Unknown",
    jumlah: b._count.id,
  }));

  const aktivitasTerbaru = await prisma.pengajuanLayanan.findMany({
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: {
      pemohon: { select: { nama: true } },
      jenisLayanan: { select: { nama: true } },
    },
  });

  return (
    <div className="page-container">
      {/* ── Dashboard Header ── */}
      <header className="dashboard-header">
        <div className="dashboard-header-top">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="role-badge">Kepala Desa</span>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                Dashboard Eksekutif
              </h1>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm lg:text-base">
              Ringkasan kinerja pelayanan dan persetujuan tanda tangan digital surat warga
            </p>
          </div>
          <LogoutButton />
        </div>

        <nav className="header-nav" aria-label="Menu kepala desa">
          <Link href="/kades" className="nav-link nav-link-active">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>
          <Link href="/kades/pengajuan" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Persetujuan Pengajuan
          </Link>
          <Link href="/kades/laporan" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Laporan & Statistik
          </Link>
          <Link href="/kades/audit" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Audit Logs
          </Link>
        </nav>
      </header>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        <StatCard
          title="Total Pelayanan"
          value={total}
          color="gray"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          }
        />
        <StatCard
          title="Selesai"
          value={selesai}
          color="green"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Sedang Berjalan"
          value={berjalan}
          color="blue"
          description="Menunggu & Diproses"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Ditolak"
          value={ditolak}
          color="red"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* ── 2-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Statistik Layanan */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-base font-bold text-[#1E293B]">
              Statistik per Layanan
            </h2>
          </div>
          <div className="card-body">
            {statistikLayanan.length > 0 ? (
              <ul className="space-y-3">
                {statistikLayanan.map((stat, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[#1E293B] font-medium leading-snug">
                      {stat.nama}
                    </span>
                    <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[2rem] h-7 px-2.5 bg-[#EFF4FB] text-[#17365D] font-bold text-xs rounded-full border border-[#DBEAFE]">
                      {stat.jumlah}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state py-8">
                <p className="text-sm">Belum ada data statistik layanan.</p>
              </div>
            )}
          </div>
        </div>

        {/* Aktivitas Terbaru */}
        <div className="card lg:col-span-2">
          <div className="card-header">
            <div>
              <h2 className="text-base font-bold text-[#1E293B]">
                Ringkasan Aktivitas Terakhir
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                5 aktivitas paling baru
              </p>
            </div>
            <Link href="/kades/pengajuan" className="btn btn-primary btn-xs">
              Ke Persetujuan →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pemohon</th>
                  <th>Layanan</th>
                  <th>Update</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {aktivitasTerbaru.length > 0 ? (
                  aktivitasTerbaru.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span className="font-semibold text-[#1E293B]">
                          {p.pemohon.nama}
                        </span>
                      </td>
                      <td className="text-[#64748B]">
                        {p.jenisLayanan.nama}
                      </td>
                      <td className="text-[#64748B] font-mono text-xs">
                        {p.updatedAt.toLocaleDateString("id-ID")}
                      </td>
                      <td className="text-center">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/kades/pengajuan/${p.id}`}
                          className="link-accent text-sm"
                        >
                          Detail →
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state">
                        <p className="font-medium">Belum ada aktivitas terekam.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
