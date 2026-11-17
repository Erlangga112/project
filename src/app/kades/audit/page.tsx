"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

export default function AuditLogPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const url = entityFilter ? `/api/audit-logs?entity=${entityFilter}` : "/api/audit-logs";
      const res = await fetch(url);
      if (res.ok) {
        setLogs(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [entityFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Audit Logs Sistem Pelayanan</h1>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm">Transparansi dan rekam jejak aktivitas otentikasi serta perubahan master data</p>
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
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Laporan & Statistik
          </Link>
          <Link
            href="/kades/audit"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0F766E] text-white shadow-xs"
          >
            Audit Logs
          </Link>
        </nav>
      </header>

      {/* Audit Log Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F0] flex gap-3 items-center bg-[#F1F5F9]">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Filter Modul:</label>
          <select 
            className="px-3.5 py-2 text-xs font-medium bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 text-[#1E293B]"
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
          >
            <option value="">Semua Aktivitas</option>
            <option value="AUTH">Otentikasi (Login)</option>
            <option value="JENIS_LAYANAN">Master Jenis Layanan</option>
          </select>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#64748B]">Memuat log sistem...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-[#64748B]">Tidak ada log aktivitas ditemukan.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#1E293B]">
              <thead className="bg-[#F1F5F9] text-[#64748B] border-b border-[#E2E8F0] uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-semibold tracking-wider">Waktu</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">User</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Aksi</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Modul</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F1F5F9]/60 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-[#64748B]">
                      {new Date(log.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4">
                      {log.user ? (
                        <div>
                          <p className="font-semibold text-sm text-[#1E293B]">{log.user.nama}</p>
                          <p className="text-[11px] text-[#64748B] font-mono">{log.user.role}</p>
                        </div>
                      ) : (
                        <span className="text-[#64748B] text-xs italic">Sistem / Anonymous</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        log.action === 'LOGIN' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                        log.action === 'CREATE' ? 'bg-emerald-50 text-[#15803D] border border-emerald-200' :
                        log.action === 'UPDATE' ? 'bg-amber-50 text-[#D97706] border border-amber-200' :
                        log.action === 'DELETE' ? 'bg-rose-50 text-[#DC2626] border border-rose-200' : 
                        'bg-slate-100 text-[#64748B] border border-[#E2E8F0]'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-[#1E293B]">{log.entity || '-'}</td>
                    <td className="px-6 py-4 max-w-xs truncate text-xs text-[#64748B]" title={log.details || ''}>
                      {log.details || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
