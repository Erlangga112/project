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
  jenisLayanan: { nama: string };
  pemohon: { nama: string; profilWarga: { nik: string; alamat: string; noTelepon?: string | null; nomorTelepon?: string | null } | null };
  dokumen: Dokumen[];
  logs: Array<{ id: string, action: string, catatan: string | null, createdAt: string, user: { nama: string } }>;
}

export default function DetailPengajuanKades() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<PengajuanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionCatatan, setActionCatatan] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/kades/pengajuan/${id}`);
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
  }, [fetchData]);

  const handleAction = async (action: string) => {
    if (!confirm(`Apakah Anda yakin ingin melakukan: ${action}?`)) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/kades/pengajuan/${id}/action`, {
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

  if (loading) return <div className="p-8 text-center text-[#64748B]">Memuat data pengajuan...</div>;
  if (error || !data) return <div className="p-8 text-center text-[#DC2626]">{error || "Data tidak ditemukan"}</div>;

  const isEditable = data.status === "MENUNGGU_APPROVAL_KEPALA_DESA";

  return (
    <div className="p-3 sm:p-4 md:p-8 w-full lg:w-[95%] max-w-[1600px] 2xl:max-w-[1640px] mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-4 mb-4 sm:mb-6">
        <Link 
          href="/kades/pengajuan" 
          className="px-3.5 sm:px-4 py-2 bg-white text-[#17365D] border border-[#CBD5E1] hover:bg-[#F1F5F9] rounded-xl font-medium text-xs sm:text-sm transition-colors"
        >
          &larr; Kembali ke Daftar Persetujuan
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
            <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">Verifikasi Dokumen (Oleh Staf & Supervisor)</h3>
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
                    <span className="text-xs font-medium text-[#64748B]">Status:</span>
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
                      Catatan Verifikasi: {doc.catatanVerifikasi}
                    </div>
                  )}
                </div>
              )) : (
                <p className="text-sm text-[#64748B]">Tidak ada dokumen persyaratan.</p>
              )}
            </div>
          </div>
        </div>

        {/* Action Panel for Kepala Desa */}
        {isEditable && (
          <div className="bg-[#17365D]/5 p-4 sm:p-6 md:p-8 border-t border-[#E2E8F0]">
            <h3 className="text-xs font-bold text-[#17365D] uppercase tracking-wider mb-3">Tindakan Persetujuan Akhir (Kepala Desa)</h3>
            <div className="space-y-4">
              <textarea 
                value={actionCatatan}
                onChange={(e) => setActionCatatan(e.target.value)}
                placeholder="Tambahkan catatan untuk tindakan persetujuan ini (Opsional/Wajib jika menolak)..."
                className="w-full px-4 py-3 bg-white border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none h-24 text-sm text-[#1E293B]"
              />
              <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 sm:gap-3">
                <button 
                  onClick={() => handleAction("SETUJUI")} 
                  disabled={submitting} 
                  className="w-full sm:w-auto px-5 sm:px-6 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  ✓ Setujui Pengajuan & Sahkan Surat
                </button>
                <button 
                  onClick={() => handleAction("TOLAK")} 
                  disabled={submitting} 
                  className="w-full sm:w-auto px-5 sm:px-6 py-2.5 bg-[#DC2626] hover:bg-[#b91c1c] text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  ✕ Tolak Pengajuan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Linimasa Pelacakan Berjenjang */}
        <div className="p-4 sm:p-6 md:p-8 border-t border-[#E2E8F0] bg-slate-50/50">
          <TrackingTimeline
            status={data.status}
            logs={data.logs}
            tanggalPengajuan={data.tanggalPengajuan}
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
