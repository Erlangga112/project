import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import StatCard from "@/components/dashboard/StatCard";
import StatusBadge from "@/components/dashboard/StatusBadge";
import Link from "next/link";

export const metadata = {
  title: "Dashboard Supervisor — Sistem Pelayanan Desa Perum",
};

export default async function SupervisorDashboard() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPERVISOR") {
    redirect("/unauthorized");
  }

  const [total, diproses, disetujui, ditolak, totalUsers, perluDitinjau, daftarDatabasePengajuan] =
    await Promise.all([
      prisma.pengajuanLayanan.count(),
      prisma.pengajuanLayanan.count({
        where: { status: "MENUNGGU_VALIDASI" },
      }),
      prisma.pengajuanLayanan.count({
        where: {
          status: {
            in: [
              "DISETUJUI_SUPERVISOR",
              "MENUNGGU_APPROVAL_KEPALA_DESA",
              "DISETUJUI",
              "SELESAI",
            ],
          },
        },
      }),
      prisma.pengajuanLayanan.count({ where: { status: "DITOLAK" } }),
      prisma.user.count(),
      prisma.pengajuanLayanan.findMany({
        where: { status: "MENUNGGU_VALIDASI" },
        orderBy: { tanggalPengajuan: "asc" },
        take: 5,
        include: {
          jenisLayanan: true,
          pemohon: { select: { nama: true, profilWarga: { select: { nik: true } } } },
        },
      }),
      prisma.pengajuanLayanan.findMany({
        orderBy: { tanggalPengajuan: "desc" },
        take: 8,
        include: {
          jenisLayanan: true,
          pemohon: { select: { nama: true, profilWarga: { select: { nik: true } } } },
        },
      }),
    ]);

  return (
    <div className="page-container">
      {/* ── Dashboard Header ── */}
      <header className="dashboard-header">
        <div className="dashboard-header-top">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="role-badge">Supervisor</span>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                Dashboard Pengawasan
              </h1>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm lg:text-base">
              Monitor verifikasi berkas, validasi permohonan, dan pantau seluruh basis data sistem desa
            </p>
          </div>
          <LogoutButton />
        </div>

        <nav className="header-nav" aria-label="Menu supervisor">
          <Link href="/supervisor" className="nav-link nav-link-active">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>
          <Link href="/supervisor/pengajuan" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Validasi Pengajuan
          </Link>
          <Link href="/supervisor/laporan" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Laporan & Statistik
          </Link>
          <Link href="/supervisor/database" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            Database Desa
          </Link>
          <Link href="/supervisor/audit" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Audit Logs
          </Link>
          <Link href="/supervisor/pengaturan" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Pengaturan API
          </Link>
        </nav>
      </header>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
        <StatCard
          title="Total Pengajuan"
          value={total}
          color="gray"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          }
        />
        <StatCard
          title="Menunggu Validasi"
          value={diproses}
          color="yellow"
          description="Butuh review segera"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        />
        <StatCard
          title="Disetujui"
          value={disetujui}
          color="green"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
        <StatCard
          title="Basis Data Pengguna"
          value={totalUsers}
          color="blue"
          description="Total akun terdaftar"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
      </div>

      {/* ── Review Queue (Prioritas Validasi) ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <h2 className="text-base lg:text-lg font-bold text-[#1E293B]">
                Antrian Validasi — Perlu Ditinjau
              </h2>
            </div>
            <p className="text-xs lg:text-sm text-[#64748B] mt-0.5">
              Pengajuan berstatus &ldquo;Menunggu Validasi&rdquo; yang perlu segera ditindaklanjuti
            </p>
          </div>
          <Link href="/supervisor/pengajuan" className="btn btn-primary btn-xs lg:btn-sm">
            Buka Semua Antrian →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pemohon</th>
                <th>Layanan</th>
                <th>Tgl. Pengajuan</th>
                <th className="text-center">Status</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {perluDitinjau.length > 0 ? (
                perluDitinjau.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="font-semibold text-[#1E293B]">
                        {p.pemohon.nama}
                      </div>
                      <div className="text-xs text-[#64748B] font-mono">
                        NIK: {p.pemohon.profilWarga?.nik || "-"}
                      </div>
                    </td>
                    <td className="text-[#64748B]">{p.jenisLayanan.nama}</td>
                    <td className="text-[#64748B] font-mono text-xs">
                      {p.tanggalPengajuan.toLocaleDateString("id-ID")}
                    </td>
                    <td className="text-center">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/supervisor/pengajuan/${p.id}`}
                        className="btn btn-primary btn-xs"
                      >
                        Validasi
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <svg
                        className="empty-state-icon"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="font-medium">
                        Tidak ada pengajuan yang perlu divalidasi saat ini
                      </p>
                      <p className="text-sm">Semua pengajuan sudah ditangani.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Tabel Database Pengajuan Terkini (Full Database View) ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="text-base lg:text-lg font-bold text-[#1E293B]">
              Tabel Database Pengajuan Terkini
            </h2>
            <p className="text-xs lg:text-sm text-[#64748B] mt-0.5">
              8 berkas pengajuan terbaru yang tercatat di seluruh basis data sistem desa
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/supervisor/database" className="btn btn-outline btn-xs lg:btn-sm">
              Buka Pusat Database →
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>No. Pengajuan</th>
                <th>Pemohon</th>
                <th>Layanan</th>
                <th>Tgl. Pengajuan</th>
                <th className="text-center">Status</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {daftarDatabasePengajuan.length > 0 ? (
                daftarDatabasePengajuan.map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono text-xs font-semibold text-[#17365D]">
                      {item.nomorPengajuan}
                    </td>
                    <td>
                      <div className="font-semibold text-[#1E293B]">
                        {item.pemohon.nama}
                      </div>
                      <div className="text-xs text-[#64748B] font-mono">
                        NIK: {item.pemohon.profilWarga?.nik || "-"}
                      </div>
                    </td>
                    <td className="text-[#64748B]">{item.jenisLayanan.nama}</td>
                    <td className="text-[#64748B] font-mono text-xs">
                      {item.tanggalPengajuan.toLocaleDateString("id-ID")}
                    </td>
                    <td className="text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/supervisor/pengajuan/${item.id}`}
                        className="btn btn-primary btn-xs"
                      >
                        Tinjau
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500 text-sm">
                    Belum ada data pengajuan dalam database sistem.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
