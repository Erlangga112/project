"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function LaporanPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    jenisLayananId: "",
    status: ""
  });
  const [layananOptions, setLayananOptions] = useState<{id: string, nama: string}[]>([]);

  useEffect(() => {
    fetch("/api/layanan").then(r => r.json()).then(data => setLayananOptions(data));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.jenisLayananId) params.append("jenisLayananId", filters.jenisLayananId);
      if (filters.status) params.append("status", filters.status);

      const res = await fetch(`/api/laporan/statistik?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartData = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    labels: (data?.byJenisLayanan as any[])?.map((d: any) => d.jenisLayanan) || [],
    datasets: [
      {
        label: 'Jumlah Pengajuan',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: (data?.byJenisLayanan as any[])?.map((d: any) => d.count) || [],
        backgroundColor: 'rgba(15, 118, 110, 0.75)',
        borderColor: '#0F766E',
        borderRadius: 8,
        borderWidth: 1.5,
      },
    ],
  };

  return (
    <div className="p-3 sm:p-4 md:p-8 w-full lg:w-[95%] max-w-[1600px] 2xl:max-w-[1640px] mx-auto space-y-4 sm:space-y-6">
      {/* Header / Navbar Navy Blue */}
      <header className="bg-[#17365D] text-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-[#17365D]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0F766E] text-white uppercase tracking-wider">
                Kepala Desa
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Laporan & Statistik Pelayanan Desa</h1>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm">Rekapitulasi berkala data pelayanan publik dan statistik permohonan surat warga</p>
          </div>
          <Link
            href="/kades"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/20 transition-colors"
          >
            &larr; Ke Dashboard
          </Link>
        </div>

        {/* Navigation Bar inside Header */}
        <nav className="flex flex-nowrap overflow-x-auto -webkit-overflow-scrolling-touch scrollbar-hide items-center gap-2 pt-4 pb-1">
          <Link
            href="/kades"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/kades/pengajuan"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Persetujuan Pengajuan
          </Link>
          <Link
            href="/kades/laporan"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0F766E] text-white shadow-xs"
          >
            Laporan & Statistik
          </Link>
          <Link
            href="/kades/audit"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Audit Logs
          </Link>
        </nav>
      </header>

      {/* Filter Toolbar */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0] space-y-4">
        <h3 className="font-bold text-sm text-[#1E293B]">Filter Data Statistik</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Mulai Tanggal</label>
            <input 
              type="date" 
              className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-[#1E293B]" 
              value={filters.startDate} 
              onChange={e => setFilters({...filters, startDate: e.target.value})} 
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Sampai Tanggal</label>
            <input 
              type="date" 
              className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-[#1E293B]" 
              value={filters.endDate} 
              onChange={e => setFilters({...filters, endDate: e.target.value})} 
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Jenis Layanan</label>
            <select 
              className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-[#1E293B]" 
              value={filters.jenisLayananId} 
              onChange={e => setFilters({...filters, jenisLayananId: e.target.value})}
            >
              <option value="">Semua Layanan</option>
              {layananOptions.map(l => (
                <option key={l.id} value={l.id}>{l.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Status</label>
            <select 
              className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-xl text-sm focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-[#1E293B]" 
              value={filters.status} 
              onChange={e => setFilters({...filters, status: e.target.value})}
            >
              <option value="">Semua Status</option>
              <option value="SELESAI">Selesai</option>
              <option value="DITOLAK">Ditolak</option>
              <option value="PERLU_PERBAIKAN">Perlu Perbaikan</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#64748B]">Memuat data statistik...</div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">Total Pengajuan</p>
              <h2 className="text-3xl font-bold text-[#17365D] tracking-tight">{data.total}</h2>
            </div>
            <div className="bg-emerald-50/60 p-6 rounded-2xl border border-emerald-200 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#15803D] mb-1">Selesai (Surat Terbit)</p>
              <h2 className="text-3xl font-bold text-[#15803D] tracking-tight">{data.selesai}</h2>
            </div>
            <div className="bg-rose-50/60 p-6 rounded-2xl border border-rose-200 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#DC2626] mb-1">Ditolak</p>
              <h2 className="text-3xl font-bold text-[#DC2626] tracking-tight">{data.ditolak}</h2>
            </div>
            <div className="bg-amber-50/60 p-6 rounded-2xl border border-amber-200 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#D97706] mb-1">Sedang Diproses</p>
              <h2 className="text-3xl font-bold text-[#D97706] tracking-tight">{data.dalamProses}</h2>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0]">
            <h3 className="font-bold text-sm text-[#1E293B] mb-6">Distribusi per Jenis Layanan</h3>
            <div className="h-80 flex items-center justify-center">
              {data.byJenisLayanan.length > 0 ? (
                <Bar options={{ responsive: true, maintainAspectRatio: false }} data={chartData} />
              ) : (
                <p className="text-[#64748B] text-sm">Tidak ada data untuk ditampilkan</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
