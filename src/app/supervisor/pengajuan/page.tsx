"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { useDebounce } from "use-debounce";

interface PengajuanList {
  id: string;
  nomorPengajuan: string;
  status: string;
  tanggalPengajuan: string;
  jenisLayanan: { nama: string };
  pemohon: { nama: string; profilWarga: { nik: string } | null };
}

export default function DaftarPengajuanSupervisor() {
  const [data, setData] = useState<PengajuanList[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [debouncedSearch] = useDebounce(search, 500);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (debouncedSearch) query.set("search", debouncedSearch);
    if (status) query.set("status", status);

    try {
      const res = await fetch(`/api/supervisor/pengajuan?${query.toString()}`);
      const resData = await res.json();
      setData(resData || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="p-3 sm:p-4 md:p-8 w-full lg:w-[95%] max-w-[1600px] 2xl:max-w-[1640px] mx-auto space-y-4 sm:space-y-6">
      {/* Header / Navbar Navy Blue */}
      <header className="bg-[#17365D] text-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-[#17365D]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0F766E] text-white uppercase tracking-wider">
                Supervisor
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Validasi Berkas Pengajuan</h1>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm">Daftar pengajuan layanan yang telah diverifikasi staf dan menunggu validasi pengawas</p>
          </div>
          <Link
            href="/supervisor"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/20 transition-colors"
          >
            &larr; Ke Dashboard
          </Link>
        </div>

        {/* Navigation Bar inside Header */}
        <nav className="flex flex-nowrap overflow-x-auto -webkit-overflow-scrolling-touch scrollbar-hide items-center gap-2 pt-4 pb-1">
          <Link
            href="/supervisor"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/supervisor/pengajuan"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0F766E] text-white shadow-xs"
          >
            Validasi Pengajuan
          </Link>
          <Link
            href="/supervisor/laporan"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Laporan & Statistik
          </Link>
          <Link
            href="/supervisor/database"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Database Desa
          </Link>
          <Link
            href="/supervisor/audit"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Audit Logs
          </Link>
          <Link
            href="/supervisor/pengaturan"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Pengaturan API
          </Link>
        </nav>
      </header>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#E2E8F0] flex flex-col md:flex-row gap-4">
        <input
          type="text"
          placeholder="Cari Nomor Pengajuan / NIK / Nama..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-sm text-[#1E293B]"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-4 py-2.5 border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-sm text-[#1E293B] bg-white"
        >
          <option value="">Semua Status</option>
          <option value="MENUNGGU_VALIDASI">Menunggu Validasi</option>
          <option value="DISETUJUI_SUPERVISOR">Disetujui Supervisor</option>
          <option value="MENUNGGU_APPROVAL_KEPALA_DESA">Menunggu Kades</option>
          <option value="DISETUJUI">Disetujui</option>
          <option value="DITOLAK">Ditolak</option>
          <option value="SELESAI">Selesai</option>
        </select>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0]">
                <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Nomor</th>
                <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Pemohon</th>
                <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Layanan</th>
                <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Tanggal</th>
                <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Status</th>
                <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#64748B]">Memuat data pengajuan...</td>
                </tr>
              ) : data.length > 0 ? (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F1F5F9]/60 transition-colors">
                    <td className="p-4 font-mono text-xs font-semibold text-[#17365D]">{item.nomorPengajuan}</td>
                    <td className="p-4">
                      <div className="font-semibold text-sm text-[#1E293B]">{item.pemohon.nama}</div>
                      <div className="text-xs text-[#64748B] font-mono">{item.pemohon.profilWarga?.nik || "-"}</div>
                    </td>
                    <td className="p-4 text-sm text-[#1E293B]">{item.jenisLayanan.nama}</td>
                    <td className="p-4 text-xs text-[#64748B] font-mono">
                      {new Date(item.tanggalPengajuan).toLocaleDateString('id-ID')}
                    </td>
                    <td className="p-4"><StatusBadge status={item.status} /></td>
                    <td className="p-4 text-right">
                      <Link 
                        href={`/supervisor/pengajuan/${item.id}`} 
                        className="px-4 py-1.5 bg-[#0F766E] hover:bg-[#0d655e] text-white rounded-lg text-xs font-semibold inline-block shadow-xs transition-colors"
                      >
                        Tinjau &rarr;
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#64748B]">Tidak ada pengajuan ditemukan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
