"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import StatusBadge from "@/components/dashboard/StatusBadge";
import TrackingTimeline, { LogEntry } from "@/components/pengajuan/TrackingTimeline";
import { useDebounce } from "use-debounce";

interface DokumenHasil {
  id: string;
  nomorSurat: string;
  filePath?: string | null;
}

interface PengajuanItem {
  id: string;
  nomorPengajuan: string;
  status: string;
  catatan: string | null;
  tanggalPengajuan: string;
  tanggalSelesai: string | null;
  updatedAt: string;
  jenisLayanan: {
    id: string;
    kode: string;
    nama: string;
    estimasiWaktu: number;
  };
  diprosesOleh?: {
    nama: string | null;
    role: string;
  } | null;
  dokumenHasil: DokumenHasil | null;
  logs?: LogEntry[];
}

export default function StatusPengajuanWargaPage() {
  const [data, setData] = useState<PengajuanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [debouncedSearch] = useDebounce(search, 400);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/pengajuan?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Gagal mengambil data pengajuan (Status HTTP ${res.status})`);
      }

      const resData = await res.json();
      setData(Array.isArray(resData) ? resData : []);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Terjadi kesalahan jaringan saat memuat daftar pengajuan.");
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Helper untuk menentukan ringkasan tahapan alur persetujuan
  const getTahapPersetujuan = (item: PengajuanItem) => {
    switch (item.status) {
      case "DIAJUKAN":
        return {
          step: 1,
          total: 5,
          label: "1/5 • Permohonan Dikirim",
          desc: "Menunggu antrean pemeriksaan awal oleh staf pelayanan desa.",
          tone: "amber",
        };
      case "DIPERIKSA":
        return {
          step: 2,
          total: 5,
          label: "2/5 • Pemeriksaan Berkas Staf",
          desc: "Staf desa sedang memverifikasi kelengkapan berkas persyaratan Anda.",
          tone: "sky",
        };
      case "PERLU_PERBAIKAN":
        return {
          step: 2,
          total: 5,
          label: "⚠️ Perlu Perbaikan Berkas",
          desc: "Petugas meminta Anda melengkapi data atau dokumen persyaratan.",
          tone: "rose",
        };
      case "MENUNGGU_VALIDASI":
        return {
          step: 3,
          total: 5,
          label: "3/5 • Menunggu Validasi Supervisor",
          desc: "Berkas telah diverifikasi staf dan sedang ditinjau pengawas pelayanan.",
          tone: "amber",
        };
      case "DISETUJUI_SUPERVISOR":
        return {
          step: 3,
          total: 5,
          label: "3/5 • Divalidasi Supervisor",
          desc: "Supervisor telah menyetujui, berkas diteruskan ke meja Kepala Desa.",
          tone: "teal",
        };
      case "MENUNGGU_APPROVAL_KEPALA_DESA":
        return {
          step: 4,
          total: 5,
          label: "4/5 • Menunggu Pengesahan Kades",
          desc: "Menunggu persetujuan dan pengesahan akhir dari Bapak Kepala Desa.",
          tone: "amber",
        };
      case "DISETUJUI":
        return {
          step: 4,
          total: 5,
          label: "4/5 • Telah Disetujui Kepala Desa",
          desc: "Kepala Desa telah memberikan persetujuan resmi. Sedang dalam tahap penomoran dan pencetakan dokumen.",
          tone: "emerald",
        };
      case "SELESAI":
        return {
          step: 5,
          total: 5,
          label: "5/5 • Selesai & Surat Terbit",
          desc: "Surat resmi telah terbit dan siap Anda unduh / cetak.",
          tone: "emerald",
        };
      case "DITOLAK":
        return {
          step: 0,
          total: 5,
          label: "Permohonan Ditolak",
          desc: "Permohonan tidak dapat disetujui sesuai catatan yang tercantum.",
          tone: "rose",
        };
      default:
        return {
          step: 1,
          total: 5,
          label: item.status,
          desc: "Sedang dalam proses pelayanan desa.",
          tone: "slate",
        };
    }
  };

  return (
    <div className="page-container">
      {/* ── Header Navigasi Navy Blue ── */}
      <header className="dashboard-header">
        <div className="dashboard-header-top">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <span className="role-badge">Warga</span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Status & Riwayat Pengajuan
              </h1>
            </div>
            <p className="text-slate-300 text-sm">
              Pantau status verifikasi, riwayat tahapan persetujuan, serta unduh dan cetak surat resmi desa Anda.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/warga/layanan"
              className="btn btn-primary btn-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              + Ajukan Surat Baru
            </Link>
            <Link
              href="/warga"
              className="btn btn-ghost-white btn-sm"
            >
              &larr; Dashboard
            </Link>
          </div>
        </div>

        {/* Tab Navigasi Cepat */}
        <nav className="header-nav" aria-label="Menu navigasi status pengajuan">
          <Link href="/warga" className="nav-link">
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
          <Link href="/warga/pengajuan" className="nav-link nav-link-active">
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

      {/* ── Filter Toolbar ── */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-[#E2E8F0] flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Cari nomor pengajuan (REQ-...), jenis surat, atau keperluan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-sm text-[#1E293B] placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 border border-[#CBD5E1] rounded-xl text-sm bg-white text-[#1E293B] focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none cursor-pointer"
          >
            <option value="">Semua Status Pengajuan</option>
            <option value="DIAJUKAN">Diajukan</option>
            <option value="DIPERIKSA">Sedang Diperiksa Staf</option>
            <option value="PERLU_PERBAIKAN">Perlu Perbaikan</option>
            <option value="MENUNGGU_VALIDASI">Menunggu Validasi</option>
            <option value="DISETUJUI_SUPERVISOR">Disetujui Supervisor</option>
            <option value="MENUNGGU_APPROVAL_KEPALA_DESA">Menunggu Kades</option>
            <option value="DISETUJUI">Disetujui Kades</option>
            <option value="SELESAI">Selesai (Surat Terbit)</option>
            <option value="DITOLAK">Ditolak</option>
          </select>

          {(search || statusFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("");
              }}
              className="px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-[#CBD5E1] rounded-xl hover:bg-slate-50 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Konten Kondisi Data ── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-12 text-center text-slate-500 shadow-xs">
          <div className="inline-block animate-spin w-8 h-8 border-3 border-[#0F766E] border-t-transparent rounded-full mb-3" />
          <p className="text-sm font-medium">Memuat daftar status pengajuan Anda...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center shadow-xs">
          <div className="w-12 h-12 bg-rose-100 text-[#DC2626] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[#1E293B] mb-1">Gagal Mengambil Data</h2>
          <p className="text-sm text-[#DC2626] mb-5 max-w-md mx-auto">{error}</p>
          <button
            onClick={() => fetchData()}
            className="px-5 py-2.5 bg-[#17365D] hover:bg-[#122844] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Coba Muat Ulang
          </button>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[#17365D] mb-1">
            {search || statusFilter ? "Tidak Ada Pengajuan yang Cocok" : "Belum Ada Pengajuan Surat"}
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            {search || statusFilter
              ? "Coba ubah kata kunci pencarian atau reset filter status pengajuan di atas."
              : "Anda belum pernah mengajukan permohonan surat. Ajukan surat baru dengan mudah secara online atau melalui Asisten AI."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {search || statusFilter ? (
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                }}
                className="px-5 py-2.5 bg-[#F1F5F9] text-[#17365D] text-xs font-semibold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Reset Filter
              </button>
            ) : (
              <Link
                href="/warga/layanan"
                className="px-6 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
              >
                + Ajukan Surat Sekarang
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>Menampilkan <strong>{data.length}</strong> berkas permohonan pelayanan</span>
            <span>Data diperbarui secara otomatis dari sistem desa</span>
          </div>

          {data.map((item) => {
            const tahap = getTahapPersetujuan(item);
            const tgl = new Date(item.tanggalPengajuan).toLocaleDateString("id-ID", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            });

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs hover:shadow-sm transition-all overflow-hidden"
              >
                {/* Header Kartu */}
                <div className="p-5 sm:p-6 border-b border-[#F1F5F9] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#17365D]/10 text-[#17365D] font-bold text-xs flex items-center justify-center shrink-0 border border-[#17365D]/15">
                      {item.jenisLayanan.kode.slice(0, 3)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-[#17365D] bg-slate-100 px-2 py-0.5 rounded-md">
                          {item.nomorPengajuan}
                        </span>
                        <StatusBadge status={item.status} />
                      </div>
                      <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
                        {item.jenisLayanan.nama}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Diajukan pada: {tgl}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                    {/* Jika Selesai: Tombol Unduh PDF & Cetak Dokumen Resmi Sah */}
                    {item.status === "SELESAI" && item.dokumenHasil && (
                      <>
                        <a
                          href={`/api/surat/download/${item.dokumenHasil.id}`}
                          download
                          className="px-3.5 py-2 bg-[#0F766E] hover:bg-[#0d655e] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Unduh PDF
                        </a>
                        <Link
                          href={`/surat/${item.dokumenHasil.id}`}
                          target="_blank"
                          className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-[#17365D] text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
                        >
                          <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          Cetak
                        </Link>
                      </>
                    )}

                    {/* Pratinjau Draft A4 */}
                    <Link
                      href={`/surat/preview/${item.id}`}
                      target="_blank"
                      className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-[#17365D] border border-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Pratinjau
                    </Link>

                    {/* Detail Pengajuan */}
                    <Link
                      href={`/warga/pengajuan/${item.id}`}
                      className="px-3.5 py-2 bg-[#17365D] hover:bg-[#122844] text-white text-xs font-semibold rounded-xl transition-colors"
                    >
                      Detail &rarr;
                    </Link>
                  </div>
                </div>

                {/* Progress Visual Timeline Bar */}
                <div className="px-5 py-4 sm:px-6 bg-[#F8FAFC] border-b border-[#F1F5F9]">
                  <TrackingTimeline
                    status={item.status}
                    logs={item.logs}
                    diprosesOleh={item.diprosesOleh}
                    tanggalPengajuan={item.tanggalPengajuan}
                    tanggalSelesai={item.tanggalSelesai}
                    dokumenHasil={item.dokumenHasil}
                    isCompact={true}
                  />
                </div>

                {/* Info Petugas & Nomor Surat */}
                <div className="px-5 py-3 sm:px-6 bg-white border-b border-[#F1F5F9] flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="font-bold text-[#1E293B]">Tahapan Saat Ini:</span>
                    <span className="font-semibold text-[#0F766E]">{tahap.label}</span>
                    {item.diprosesOleh?.nama && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-500">
                          Petugas: <strong>{item.diprosesOleh.nama}</strong>
                        </span>
                      </>
                    )}
                  </div>

                  {item.dokumenHasil?.nomorSurat && (
                    <div className="text-right">
                      <span className="text-slate-500">Nomor Registrasi Surat: </span>
                      <strong className="font-mono text-emerald-800">{item.dokumenHasil.nomorSurat}</strong>
                    </div>
                  )}
                </div>

                {/* Catatan Terkini / Catatan Perbaikan */}
                {item.catatan && (
                  <div className="px-5 py-3.5 sm:px-6 text-xs text-slate-700 bg-white flex items-start gap-2.5">
                    <span className="font-bold text-slate-500 shrink-0">Catatan Pemohon:</span>
                    <span className="italic text-slate-600">{item.catatan}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
