import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";

export default async function DaftarLayananAdminPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || (session.user.role !== "STAF_DESA" && session.user.role !== "SUPERVISOR")) {
    redirect("/unauthorized");
  }

  const layananList = await prisma.jenisLayanan.findMany({
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="p-3 sm:p-4 lg:p-8 w-full lg:w-[95%] max-w-[1600px] 2xl:max-w-[1640px] mx-auto space-y-4 sm:space-y-6">
      {/* Header / Navbar Navy Blue */}
      <header className="bg-[#17365D] text-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-[#17365D]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0F766E] text-white uppercase tracking-wider">
                Pengaturan Layanan
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Master Jenis Layanan Desa</h1>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm">Kelola daftar layanan surat permohonan yang dapat diakses oleh warga</p>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/staf/layanan/baru" 
              className="px-4 sm:px-5 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
            >
              + Tambah Layanan
            </Link>
          </div>
        </div>

        {/* Navigation Bar inside Header */}
        <nav className="flex flex-nowrap overflow-x-auto -webkit-overflow-scrolling-touch scrollbar-hide items-center gap-2 pt-4 pb-1">
          <Link
            href="/staf"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/staf/pengajuan"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Verifikasi Pengajuan
          </Link>
          <Link
            href="/staf/layanan"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0F766E] text-white shadow-xs"
          >
            Master Layanan
          </Link>
          <Link
            href="/staf/pengguna"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Data Pengguna
          </Link>
        </nav>
      </header>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F1F5F9] text-[#64748B] border-b border-[#E2E8F0]">
              <tr>
                <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Kode</th>
                <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Nama Layanan</th>
                <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Estimasi Waktu</th>
                <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {layananList.length > 0 ? (
                layananList.map((l) => (
                  <tr key={l.id} className="hover:bg-[#F1F5F9]/60 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-[#17365D]">{l.kode}</td>
                    <td className="px-6 py-4 font-semibold text-[#1E293B]">{l.nama}</td>
                    <td className="px-6 py-4 text-[#64748B] text-xs">{l.estimasiWaktu} Hari</td>
                    <td className="px-6 py-4">
                      {l.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-[#15803D] text-xs font-semibold rounded-full border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-[#DC2626] text-xs font-semibold rounded-full border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <Link href={`/staf/layanan/${l.id}`} className="text-[#0F766E] font-semibold text-xs hover:text-[#0d655e]">
                        Detail
                      </Link>
                      <Link href={`/staf/layanan/${l.id}/edit`} className="text-[#D97706] font-semibold text-xs hover:text-[#b45309]">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[#64748B]">
                    Belum ada layanan yang ditambahkan.
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
