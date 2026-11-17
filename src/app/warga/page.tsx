import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import StatCard from "@/components/dashboard/StatCard";
import StatusBadge from "@/components/dashboard/StatusBadge";
import Link from "next/link";

export const metadata = {
  title: "Dashboard Warga — Sistem Pelayanan Desa Perum",
};

export default async function WargaDashboard() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "WARGA") {
    redirect("/unauthorized");
  }

  const [pengajuanAktif, pengajuanSelesai, pengajuanDitolak, pengajuanTerbaru] =
    await Promise.all([
      prisma.pengajuanLayanan.count({
        where: {
          pemohonId: session.user.id,
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
      prisma.pengajuanLayanan.count({
        where: { pemohonId: session.user.id, status: "SELESAI" },
      }),
      prisma.pengajuanLayanan.count({
        where: { pemohonId: session.user.id, status: "DITOLAK" },
      }),
      prisma.pengajuanLayanan.findMany({
        where: { pemohonId: session.user.id },
        orderBy: { tanggalPengajuan: "desc" },
        take: 5,
        include: { jenisLayanan: true },
      }),
    ]);

  return (
    <div className="page-container">
      {/* ── Dashboard Header ── */}
      <header className="dashboard-header">
        <div className="dashboard-header-top">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="role-badge">Warga</span>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                Dashboard Pelayanan
              </h1>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm lg:text-base">
              Selamat datang,{" "}
              <span className="font-semibold text-white">
                {session.user.name}
              </span>
              . Kelola pengajuan layanan Anda di sini.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/warga/asisten-ai"
              className="btn btn-ghost-white btn-sm lg:btn-md gap-2"
            >
              <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Tanya AI
            </Link>
            <Link
              href="/warga/layanan"
              className="btn btn-primary btn-sm lg:btn-md"
            >
              <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Ajukan Pelayanan
            </Link>
            <div className="flex items-center gap-2">
              <LogoutButton />
            </div>
          </div>
        </div>

        {/* Quick-access nav */}
        <nav className="header-nav" aria-label="Menu utama warga">
          <Link href="/warga" className="nav-link nav-link-active">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>
          <Link href="/warga/layanan" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Pilih Layanan
          </Link>
          <Link href="/warga/pengajuan" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Status Pengajuan
          </Link>
          <Link href="/warga/asisten-ai" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Asisten AI
          </Link>
        </nav>
      </header>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
        <StatCard
          title="Pengajuan Aktif"
          value={pengajuanAktif}
          color="blue"
          description="Sedang diproses"
          icon={
            <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Pengajuan Selesai"
          value={pengajuanSelesai}
          color="green"
          description="Telah disetujui"
          icon={
            <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Ditolak / Perlu Perbaikan"
          value={pengajuanDitolak}
          color="red"
          description="Memerlukan tindakan"
          icon={
            <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
      </div>

      {/* ── Quick Action Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
        <Link
          href="/warga/layanan"
          className="service-card group"
          aria-label="Buat pengajuan baru"
        >
          <div className="service-card-icon group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 lg:w-7 lg:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h3 className="font-bold text-[#1E293B] text-base lg:text-lg mb-1.5">
            Ajukan Pelayanan Baru
          </h3>
          <p className="text-sm lg:text-base text-[#64748B] leading-relaxed flex-1">
            Pilih jenis layanan yang dibutuhkan dan lengkapi formulir pengajuan
            secara online.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm lg:text-base font-semibold text-[#0F766E] group-hover:gap-2.5 transition-all">
            Mulai Pengajuan
            <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </span>
        </Link>

        <Link
          href="/warga/asisten-ai"
          className="service-card group"
          aria-label="Tanya Asisten AI"
        >
          <div
            className="service-card-icon group-hover:scale-110 transition-transform"
            style={{ background: "#EFF4FB", color: "#17365D" }}
          >
            <svg className="w-6 h-6 lg:w-7 lg:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h3 className="font-bold text-[#1E293B] text-base lg:text-lg mb-1.5">
            Tanya Asisten Desa Perum
          </h3>
          <p className="text-sm lg:text-base text-[#64748B] leading-relaxed flex-1">
            Dapatkan informasi seputar persyaratan dokumen dan alur pelayanan
            dari asisten AI desa.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm lg:text-base font-semibold text-[#17365D] group-hover:gap-2.5 transition-all">
            Tanya Sekarang
            <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </span>
        </Link>
      </div>

      {/* ── Recent History Table ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="text-base lg:text-xl font-bold text-[#1E293B]">
              Riwayat Pengajuan Terbaru
            </h2>
            <p className="text-xs lg:text-sm text-[#64748B] mt-0.5">
              5 pengajuan terakhir Anda
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/warga/pengajuan"
              className="text-xs lg:text-sm font-semibold text-[#006699] hover:underline px-2 py-1"
            >
              Lihat Semua Status →
            </Link>
            <Link
              href="/warga/layanan"
              className="btn btn-primary btn-xs lg:btn-sm"
            >
              + Pengajuan Baru
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Layanan</th>
                <th>Tanggal</th>
                <th>Status</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pengajuanTerbaru.length > 0 ? (
                pengajuanTerbaru.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="font-semibold text-[#1E293B]">
                        {p.jenisLayanan.nama}
                      </span>
                    </td>
                    <td className="text-[#64748B]">
                      {p.tanggalPengajuan.toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/warga/pengajuan/${p.id}`}
                        className="link-accent text-sm"
                      >
                        Detail →
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>
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
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="font-medium">Belum ada riwayat pengajuan</p>
                      <p className="text-sm">
                        Klik{" "}
                        <Link href="/warga/layanan" className="link-accent">
                          Ajukan Pelayanan
                        </Link>{" "}
                        untuk memulai
                      </p>
                    </div>
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
