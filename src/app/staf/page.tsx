import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import StatCard from "@/components/dashboard/StatCard";
import StatusBadge from "@/components/dashboard/StatusBadge";
import Link from "next/link";

export const metadata = {
  title: "Dashboard Administrasi — Sistem Pelayanan Desa Perum",
};

export default async function StafDashboard() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "STAF_DESA") {
    redirect("/unauthorized");
  }

  const [
    total,
    antreanVerifikasi,
    disetujui,
    ditolak,
    totalUsers,
    perluDitinjau,
    daftarDatabasePengajuan,
  ] = await Promise.all([
    prisma.pengajuanLayanan.count(),
    prisma.pengajuanLayanan.count({
      where: { status: { in: ["DIAJUKAN", "DIPERIKSA"] } },
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
      where: { status: { in: ["DIAJUKAN", "DIPERIKSA"] } },
      orderBy: { tanggalPengajuan: "asc" },
      take: 5,
      include: {
        jenisLayanan: true,
        pemohon: {
          select: {
            nama: true,
            profilWarga: { select: { nik: true } },
          },
        },
      },
    }),
    prisma.pengajuanLayanan.findMany({
      orderBy: { tanggalPengajuan: "desc" },
      take: 8,
      include: {
        jenisLayanan: true,
        pemohon: {
          select: {
            nama: true,
            profilWarga: { select: { nik: true } },
          },
        },
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
              <span className="role-badge">Staf Desa</span>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                Dashboard Administrasi
              </h1>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm lg:text-base">
              Verifikasi berkas permohonan, proses antrean pelayanan warga, dan pantau seluruh basis data sistem desa
            </p>
          </div>
          <LogoutButton />
        </div>

        <nav className="header-nav" aria-label="Menu staf desa">
          <Link href="/staf" className="nav-link nav-link-active">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>
          <Link href="/staf/pengajuan" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Verifikasi Pengajuan
          </Link>
          <Link href="/staf/layanan" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Master Layanan
          </Link>
          <Link href="/staf/pengguna" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Data Pengguna
          </Link>
          <Link href="/staf/notifikasi" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Notifikasi WhatsApp
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
          title="Menunggu Verifikasi"
          value={antreanVerifikasi}
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

      {/* ── Review Queue (Prioritas Verifikasi Staf) ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <h2 className="text-base lg:text-lg font-bold text-[#1E293B]">
                Antrian Verifikasi — Perlu Ditindaklanjuti
              </h2>
            </div>
            <p className="text-xs lg:text-sm text-[#64748B] mt-0.5">
              Pengajuan baru dan berkas dalam pemeriksaan yang perlu segera diverifikasi oleh operator
            </p>
          </div>
          <Link href="/staf/pengajuan" className="btn btn-primary btn-xs lg:btn-sm">
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
                        href={`/staf/pengajuan/${p.id}`}
                        className="btn btn-primary btn-xs"
                      >
                        Verifikasi
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
                        Tidak ada pengajuan yang perlu diverifikasi saat ini
                      </p>
                      <p className="text-sm">Semua berkas permohonan telah ditindaklanjuti.</p>
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
            <Link href="/staf/pengajuan" className="btn btn-outline btn-xs lg:btn-sm">
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
                        href={`/staf/pengajuan/${item.id}`}
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
