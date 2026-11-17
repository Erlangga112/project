"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/dashboard/StatusBadge";
import TrackingTimeline from "@/components/pengajuan/TrackingTimeline";

interface Dokumen {
  id: string;
  namaDokumen: string;
  fileSize: number;
  fileType: string;
  statusVerifikasi: boolean | null;
  catatanVerifikasi: string | null;
}

interface PengajuanDetail {
  id: string;
  nomorPengajuan: string;
  status: string;
  catatan: string | null;
  tanggalPengajuan: string;
  tanggalSelesai?: string | null;
  jenisLayanan: { id: string; kode: string; nama: string };
  pemohon: { nama: string; profilWarga: { nik: string; alamat: string; noTelepon?: string | null; nomorTelepon?: string | null } | null };
  diprosesOleh?: { nama: string | null; role: string } | null;
  dokumen: Dokumen[];
  dokumenHasil: { id: string; nomorSurat: string; filePath?: string | null } | null;
  logs: Array<{ id: string; action: string; catatan: string | null; statusBefore?: string | null; statusAfter?: string | null; createdAt: string; user: { nama: string; role: string } }>;
}

export default function DetailPengajuanStaf() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<PengajuanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionCatatan, setActionCatatan] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/pengajuan/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [id, fetchData]);

  const handleVerifyDokumen = async (dokumenId: string, statusVerifikasi: boolean) => {
    const catatan = window.prompt("Catatan verifikasi dokumen (opsional):", "");
    if (catatan === null) return; // cancelled

    try {
      const res = await fetch(`/api/admin/pengajuan/${id}/dokumen`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dokumenId, statusVerifikasi, catatanVerifikasi: catatan })
      });
      if (res.ok) {
        fetchData(); // refresh
      }
    } catch {
      alert("Gagal memverifikasi dokumen");
    }
  };

  const handleAction = async (action: string) => {
    if (!confirm(`Apakah Anda yakin ingin melakukan: ${action}?`)) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/pengajuan/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, catatan: actionCatatan })
      });
      if (!res.ok) throw new Error("Gagal memproses pengajuan");
      setActionCatatan("");
      fetchData();
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const [nomorSuratInput, setNomorSuratInput] = useState("");
  const [generatingNomor, setGeneratingNomor] = useState(false);

  const handleGenerateNomorOtomatis = async () => {
    setGeneratingNomor(true);
    try {
      const res = await fetch("/api/surat/generate-nomor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jenisLayananKode: data?.jenisLayanan?.kode || "SKTM" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membuat nomor otomatis");
      setNomorSuratInput(json.nomorSurat);
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    } finally {
      setGeneratingNomor(false);
    }
  };

  const handleTerbitkan = async () => {
    if (!nomorSuratInput) {
      alert("Masukkan nomor surat");
      return;
    }
    if (!confirm("Terbitkan surat dengan nomor ini?")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/pengajuan/${id}/terbitkan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomorSurat: nomorSuratInput })
      });
      if (!res.ok) throw new Error("Gagal menerbitkan surat");
      fetchData();
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-[#64748B]">Memuat data pengajuan...</div>;
  if (error || !data) return <div className="p-8 text-center text-[#DC2626]">{error || "Data tidak ditemukan"}</div>;

  const isEditable = ["DIAJUKAN", "DIPERIKSA"].includes(data.status);

  return (
    <div className="p-3 sm:p-4 md:p-8 w-full lg:w-[95%] max-w-[1600px] 2xl:max-w-[1640px] mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-4 mb-4 sm:mb-6">
        <Link 
          href="/staf/pengajuan" 
          className="px-3.5 sm:px-4 py-2 bg-white text-[#17365D] border border-[#CBD5E1] hover:bg-[#F1F5F9] rounded-xl font-medium text-xs sm:text-sm transition-colors"
        >
          &larr; Kembali ke Daftar Pengajuan
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
        {/* Header Summary */}
        <div className="px-4 sm:px-8 py-5 sm:py-6 border-b border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Nomor Pengajuan</p>
            <h1 className="text-xl sm:text-2xl font-bold text-[#17365D] font-mono break-all">{data.nomorPengajuan}</h1>
          </div>
          <div className="text-left md:text-right">
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Status Saat Ini</p>
            <StatusBadge status={data.status} />
          </div>
        </div>

        <div className="p-4 sm:p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">Informasi Pemohon</h3>
              <div className="bg-[#F1F5F9] p-4 rounded-xl border border-[#E2E8F0] space-y-3">
                <div>
                  <p className="text-xs text-[#64748B]">Nama Lengkap</p>
                  <p className="font-semibold text-sm text-[#1E293B]">{data.pemohon.nama}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B]">NIK</p>
                  <p className="font-medium text-sm font-mono text-[#1E293B]">{data.pemohon.profilWarga?.nik || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B]">No. WhatsApp / Telepon</p>
                  <p className="font-medium text-sm text-[#1E293B]">
                    {data.pemohon.profilWarga?.noTelepon || data.pemohon.profilWarga?.nomorTelepon || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B]">Alamat</p>
                  <p className="font-medium text-sm text-[#1E293B]">{data.pemohon.profilWarga?.alamat || "-"}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">Layanan Diajukan</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-[#64748B]">Jenis Layanan</p>
                  <p className="font-semibold text-sm text-[#1E293B]">{data.jenisLayanan.nama}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B]">Tanggal Pengajuan</p>
                  <p className="font-semibold text-sm text-[#1E293B]">{new Date(data.tanggalPengajuan).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B]">Catatan Pemohon</p>
                  <p className="text-[#1E293B] bg-amber-50 p-3 rounded-xl mt-1 text-sm italic border border-amber-200">
                    {data.catatan || "Tidak ada catatan dari pemohon."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">Verifikasi Dokumen</h3>
            <div className="space-y-4">
              {data.dokumen.length > 0 ? data.dokumen.map((doc) => (
                <div key={doc.id} className="p-4 bg-white rounded-xl border border-[#CBD5E1] shadow-xs">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-sm text-[#1E293B]">{doc.namaDokumen}</p>
                      <p className="text-xs text-[#64748B]">{(doc.fileSize / 1024 / 1024).toFixed(2)} MB • {doc.fileType}</p>
                    </div>
                    <a 
                      href={`/api/files/${doc.id}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-[#0F766E] hover:text-[#0d655e] hover:bg-teal-50 px-3 py-1 rounded-lg text-xs font-semibold border border-teal-200 transition-colors"
                    >
                      Lihat File
                    </a>
                  </div>
                  
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#E2E8F0]">
                    <span className="text-xs font-medium text-[#64748B]">Status Verifikasi:</span>
                    {doc.statusVerifikasi === true && (
                      <span className="text-xs bg-emerald-50 text-[#15803D] border border-emerald-200 px-2.5 py-0.5 rounded-full font-semibold">Valid</span>
                    )}
                    {doc.statusVerifikasi === false && (
                      <span className="text-xs bg-rose-50 text-[#DC2626] border border-rose-200 px-2.5 py-0.5 rounded-full font-semibold">Tidak Valid</span>
                    )}
                    {doc.statusVerifikasi === null && (
                      <span className="text-xs bg-slate-100 text-[#64748B] border border-[#E2E8F0] px-2.5 py-0.5 rounded-full font-semibold">Belum Diperiksa</span>
                    )}
                  </div>

                  {doc.catatanVerifikasi && (
                    <div className="mt-2 text-xs text-[#DC2626] bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                      Catatan: {doc.catatanVerifikasi}
                    </div>
                  )}

                  {isEditable && (
                    <div className="flex gap-2 mt-3 pt-2">
                      <button 
                        onClick={() => handleVerifyDokumen(doc.id, true)} 
                        className="flex-1 text-xs bg-emerald-50 text-[#15803D] hover:bg-emerald-100 py-2 rounded-lg font-semibold transition-colors border border-emerald-200"
                      >
                        ✓ Set Valid
                      </button>
                      <button 
                        onClick={() => handleVerifyDokumen(doc.id, false)} 
                        className="flex-1 text-xs bg-rose-50 text-[#DC2626] hover:bg-rose-100 py-2 rounded-lg font-semibold transition-colors border border-rose-200"
                      >
                        ✕ Set Tidak Valid
                      </button>
                    </div>
                  )}
                </div>
              )) : (
                <p className="text-sm text-[#64748B]">Tidak ada dokumen persyaratan.</p>
              )}
            </div>
          </div>
        </div>

        {/* Action Panel */}
        {isEditable && (
          <div className="bg-[#F1F5F9] p-4 sm:p-6 md:p-8 border-t border-[#E2E8F0]">
            <h3 className="text-xs font-bold text-[#17365D] uppercase tracking-wider mb-3">Tindakan Verifikasi Petugas</h3>
            <div className="space-y-4">
              <textarea 
                value={actionCatatan}
                onChange={(e) => setActionCatatan(e.target.value)}
                placeholder="Tambahkan catatan untuk pemohon atau catatan internal (Wajib diisi jika meminta perbaikan)..."
                className="w-full px-4 py-3 bg-white border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none h-24 text-sm text-[#1E293B]"
              />
              <div className="flex flex-wrap gap-2.5 sm:gap-3">
                {data.status === "DIAJUKAN" && (
                  <button 
                    onClick={() => handleAction("PROSES")} 
                    disabled={submitting} 
                    className="w-full sm:w-auto px-5 sm:px-6 py-2.5 bg-[#17365D] hover:bg-[#122a49] text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-sm disabled:opacity-50"
                  >
                    Mulai Pemeriksaan (Ubah ke Diperiksa)
                  </button>
                )}
                {data.status === "DIPERIKSA" && (
                  <>
                    <button 
                      onClick={() => handleAction("MINTA_PERBAIKAN")} 
                      disabled={submitting} 
                      className="w-full sm:w-auto px-5 sm:px-6 py-2.5 bg-[#D97706] hover:bg-[#b45309] text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-sm disabled:opacity-50"
                    >
                      Minta Perbaikan Dokumen
                    </button>
                    <button 
                      onClick={() => handleAction("TERUSKAN")} 
                      disabled={submitting} 
                      className="w-full sm:w-auto px-5 sm:px-6 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-sm disabled:opacity-50"
                    >
                      Dokumen Lengkap & Teruskan ke Supervisor &rarr;
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Issuance Action if Approved */}
        {data.status === "DISETUJUI" && (
          <div className="bg-teal-50/50 p-4 sm:p-6 md:p-8 border-t border-teal-100">
            <h3 className="text-xs font-bold text-[#0F766E] uppercase tracking-wider mb-2">Terbitkan Surat (Langkah Akhir)</h3>
            <div className="space-y-4">
              <p className="text-sm text-[#1E293B]">
                Pengajuan telah disetujui Kepala Desa. Anda dapat memasukkan nomor surat manual atau klik <strong>&quot;Generate Otomatis&quot;</strong> sesuai format register desa.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    value={nomorSuratInput} 
                    onChange={e => setNomorSuratInput(e.target.value)} 
                    placeholder="Contoh: 001/SKTM/DS-PERUM/XI/2026" 
                    className="w-full px-4 py-2.5 bg-white border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-sm font-mono text-[#1E293B]" 
                  />
                </div>
                <button
                  type="button"
                  onClick={handleGenerateNomorOtomatis}
                  disabled={generatingNomor || submitting}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#17365D] font-semibold rounded-xl text-xs transition-colors border border-slate-300 disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {generatingNomor ? "Membuat..." : "⚡ Generate Otomatis"}
                </button>
                <button 
                  onClick={handleTerbitkan} 
                  disabled={submitting || !nomorSuratInput} 
                  className="px-5 sm:px-6 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap flex items-center gap-2 justify-center"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Generate & Terbitkan Surat
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Finished Result */}
        {data.dokumenHasil && (
          <div className="bg-emerald-50/80 p-4 sm:p-6 md:p-8 border-t border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#15803D]" />
                <h3 className="font-bold text-[#15803D]">Surat Telah Diterbitkan & Sah</h3>
              </div>
              <p className="text-sm text-emerald-800 mt-0.5">
                Nomor Surat Resmi: <span className="font-mono font-semibold">{data.dokumenHasil.nomorSurat}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={`/api/surat/download/${data.dokumenHasil.id}`}
                download
                className="px-4 py-2 bg-[#0F766E] hover:bg-[#0d655e] text-white font-semibold rounded-xl shadow-xs transition-colors text-xs flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Unduh PDF
              </a>
              <Link 
                href={`/surat/${data.dokumenHasil.id}`} 
                target="_blank"
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-[#17365D] font-semibold rounded-xl transition-colors text-xs text-center"
              >
                Lihat & Cetak Surat
              </Link>
            </div>
          </div>
        )}

        {/* Linimasa Pelacakan Berjenjang */}
        <div className="p-4 sm:p-6 md:p-8 border-t border-[#E2E8F0] bg-slate-50/50">
          <TrackingTimeline
            status={data.status}
            logs={data.logs}
            diprosesOleh={data.diprosesOleh}
            tanggalPengajuan={data.tanggalPengajuan}
            tanggalSelesai={data.tanggalSelesai}
            dokumenHasil={data.dokumenHasil}
          />
        </div>

        {/* Audit Log */}
        <div className="p-4 sm:p-6 md:p-8 border-t border-[#E2E8F0] bg-white">
          <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-4">Riwayat Aktivitas</h3>
          <div className="space-y-4">
            {data.logs.map(log => (
              <div key={log.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 bg-[#0F766E] rounded-full mt-1.5"></div>
                  <div className="w-px h-full bg-[#E2E8F0] my-1"></div>
                </div>
                <div className="pb-4">
                  <p className="text-sm font-semibold text-[#1E293B]">{log.action}</p>
                  <p className="text-xs text-[#64748B] mb-1">Oleh {log.user.nama} • {new Date(log.createdAt).toLocaleString('id-ID')}</p>
                  {log.catatan && (
                    <p className="text-xs text-[#1E293B] bg-[#F1F5F9] p-2.5 rounded-lg border border-[#E2E8F0] inline-block mt-1">
                      {log.catatan}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <div className="flex gap-4">
              <div className="w-2.5 h-2.5 bg-[#17365D] rounded-full mt-1.5"></div>
              <div>
                <p className="text-sm font-semibold text-[#1E293B]">Pengajuan Dibuat</p>
                <p className="text-xs text-[#64748B]">Oleh {data.pemohon.nama} • {new Date(data.tanggalPengajuan).toLocaleString('id-ID')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
