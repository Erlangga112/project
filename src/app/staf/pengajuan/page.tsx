"use client";

import { useState, useEffect } from "react";
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

export default function DaftarPengajuanStaf() {
  const [data, setData] = useState<PengajuanList[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const [debouncedSearch] = useDebounce(search, 500);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, status]);

  useEffect(() => {
    setLoading(true);
    const query = new URLSearchParams();
    if (debouncedSearch) query.set("search", debouncedSearch);
    if (status) query.set("status", status);

    fetch(`/api/admin/pengajuan?${query.toString()}`)
      .then(res => res.json())
      .then(resData => {
        setData(resData || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedSearch, status]);

  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const currentItems = data.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    if (activePage <= 3) {
      pages.push(1, 2, 3, 4, "...", totalPages);
    } else if (activePage >= totalPages - 2) {
      pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", activePage - 1, activePage, activePage + 1, "...", totalPages);
    }
    return pages;
  };

  return (
    <div className="p-3 sm:p-4 lg:p-8 w-full lg:w-[95%] max-w-[1600px] 2xl:max-w-[1640px] mx-auto space-y-4 sm:space-y-6">
      {/* Header / Navbar Navy Blue */}
      <header className="bg-[#17365D] text-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-[#17365D]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0F766E] text-white uppercase tracking-wider">
                Staf Desa
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Verifikasi Berkas Pengajuan</h1>
            </div>
            <p className="text-slate-300 text-sm">Daftar permohonan layanan warga yang perlu diperiksa dan diverifikasi</p>
          </div>
          <Link
            href="/staf"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/20 transition-colors"
          >
            &larr; Ke Dashboard
          </Link>
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
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0F766E] text-white shadow-xs"
          >
            Verifikasi Pengajuan
          </Link>
          <Link
            href="/staf/layanan"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
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

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#E2E8F0] flex flex-col md:flex-row gap-4">
        <input
          type="text"
          placeholder="Cari Nomor Pengajuan / NIK / Nama..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-sm text-[#1E293B] placeholder-slate-400"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-4 py-2.5 border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-sm text-[#1E293B] bg-white"
        >
          <option value="">Semua Status</option>
          <option value="DIAJUKAN">Diajukan (Baru)</option>
          <option value="DIPERIKSA">Diperiksa</option>
          <option value="PERLU_PERBAIKAN">Perlu Perbaikan</option>
          <option value="MENUNGGU_VALIDASI">Menunggu Validasi</option>
          <option value="DISETUJUI">Disetujui</option>
          <option value="DITOLAK">Ditolak</option>
          <option value="SELESAI">Selesai</option>
        </select>
      </div>

      {/* Table */}
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
              ) : currentItems.length > 0 ? (
                currentItems.map((item) => (
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
                        href={`/staf/pengajuan/${item.id}`} 
                        className="px-4 py-1.5 bg-[#0F766E] hover:bg-[#0d655e] text-white rounded-lg text-xs font-semibold inline-block shadow-xs transition-colors"
                      >
                        Periksa &rarr;
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

        {/* Pagination Bar */}
        {!loading && totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-slate-50/70 border-t border-[#E2E8F0] text-xs">
            <div className="text-[#64748B]">
              Menampilkan{" "}
              <span className="font-semibold text-[#1E293B]">
                {startIndex + 1}
              </span>
              {" - "}
              <span className="font-semibold text-[#1E293B]">{endIndex}</span> dari{" "}
              <span className="font-semibold text-[#1E293B]">{totalItems}</span> pengajuan
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={activePage === 1}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#1E293B] font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-xs"
                aria-label="Halaman sebelumnya"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Sebelumnya</span>
              </button>

              <div className="flex items-center gap-1">
                {getPageNumbers().map((pageNum, idx) => {
                  if (pageNum === "...") {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1 text-slate-400">
                        ...
                      </span>
                    );
                  }
                  const isSelected = pageNum === activePage;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(Number(pageNum))}
                      className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-[#17365D] text-white shadow-xs"
                          : "bg-white border border-[#CBD5E1] text-[#1E293B] hover:bg-slate-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={activePage === totalPages}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#1E293B] font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-xs"
                aria-label="Halaman selanjutnya"
              >
                <span className="hidden sm:inline">Selanjutnya</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
