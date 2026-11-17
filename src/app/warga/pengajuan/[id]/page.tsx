"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/dashboard/StatusBadge";
import TrackingTimeline, { LogEntry } from "@/components/pengajuan/TrackingTimeline";
import DocumentHistory from "@/components/pengajuan/DocumentHistory";

interface DokumenItem {
  id: string;
  namaDokumen: string;
  fileSize: number;
  fileType: string;
  statusVerifikasi?: boolean | null;
  catatanVerifikasi?: string | null;
}

interface PengajuanData {
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
  dokumen: DokumenItem[];
  dokumenHasil: {
    id: string;
    nomorSurat: string;
    filePath?: string | null;
    fileSize?: number | null;
    version?: number;
    createdAt?: string;
  } | null;
  logs?: LogEntry[];
}

export default function DetailPengajuanWarga() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const isSuccess = searchParams.get("success") === "true";

  const [pengajuan, setPengajuan] = useState<PengajuanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch(`/api/pengajuan?id=${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPengajuan(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownloadPDF = async () => {
    if (!pengajuan?.dokumenHasil) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/surat/download/${pengajuan.dokumenHasil.id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal mengunduh file surat PDF.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Surat_Resmi_${pengajuan.jenisLayanan.kode}_${pengajuan.nomorPengajuan}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("Gagal mengunduh surat PDF.");
      }
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <div className="inline-block animate-spin w-8 h-8 border-3 border-[#0F766E] border-t-transparent rounded-full mb-3" />
        <p className="text-sm font-medium">Memuat rincian pelacakan pengajuan...</p>
      </div>
    );
  }

  if (error || !pengajuan) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
          <p className="text-sm text-[#DC2626] font-semibold mb-3">
            {error || "Pengajuan tidak ditemukan."}
          </p>
          <Link
            href="/warga/pengajuan"
            className="px-4 py-2 bg-[#17365D] text-white text-xs font-semibold rounded-xl"
          >
            &larr; Kembali ke Daftar Pengajuan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-8 w-full lg:w-[95%] max-w-[1600px] 2xl:max-w-[1640px] mx-auto space-y-4 sm:space-y-6">
      {/* Tombol Kembali & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Link
            href="/warga/pengajuan"
            className="px-3 sm:px-4 py-2 bg-white text-[#17365D] border border-[#CBD5E1] hover:bg-[#F1F5F9] rounded-xl font-medium text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            &larr; Daftar Pengajuan
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-mono text-xs font-bold text-slate-600 break-all">
            {pengajuan.nomorPengajuan}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pengajuan.status === "SELESAI" && pengajuan.dokumenHasil && (
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="px-3.5 sm:px-4 py-2 bg-[#0F766E] hover:bg-[#0d655e] text-white rounded-xl font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Mengunduh...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Unduh PDF</span>
                </>
              )}
            </button>
          )}

          <Link
            href={`/surat/preview/${id}`}
            target="_blank"
            className="px-3 sm:px-3.5 py-2 bg-white border border-[#CBD5E1] hover:bg-slate-50 text-[#17365D] rounded-xl font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Pratinjau Draft
          </Link>
        </div>
      </div>

      {/* Pesan Sukses jika baru selesai kirim permohonan */}
      {isSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-[#15803D] rounded-2xl p-4 sm:p-6 flex items-start gap-3 sm:gap-4 shadow-xs">
          <div className="p-2 sm:p-2.5 bg-emerald-100 rounded-xl text-[#15803D] shrink-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold">Permohonan Pengajuan Berhasil Terkirim!</h2>
            <p className="text-xs mt-1 text-emerald-800 leading-relaxed">
              Sistem telah mencatat permohonan Anda dengan nomor registrasi{" "}
              <strong className="font-mono">{pengajuan.nomorPengajuan}</strong>. Staf pelayanan desa akan
              segera memverifikasi kelengkapan berkas Anda. Pantau perkembangan status melalui linimasa di bawah ini.
            </p>
          </div>
        </div>
      )}

      {/* Ringkasan Header Pengajuan */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 md:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="font-mono text-xs font-bold text-[#17365D] bg-slate-100 px-2.5 py-0.5 rounded-md">
                {pengajuan.nomorPengajuan}
              </span>
              <StatusBadge status={pengajuan.status} />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-[#1E293B]">
              {pengajuan.jenisLayanan.nama}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Tanggal Pengajuan:{" "}
              {new Date(pengajuan.tanggalPengajuan).toLocaleDateString("id-ID", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          {pengajuan.dokumenHasil?.nomorSurat && (
            <div className="text-left md:text-right p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                Nomor Surat Resmi Sah
              </span>
              <strong className="text-base font-mono font-bold text-emerald-950">
                {pengajuan.dokumenHasil.nomorSurat}
              </strong>
            </div>
          )}
        </div>

        {/* Informasi Detail Dua Kolom */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
          <div>
            <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">
              Keterangan Permohonan
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block">Estimasi Waktu Pelayanan:</span>
                <span className="font-semibold text-slate-700">
                  {pengajuan.jenisLayanan.estimasiWaktu} Hari Kerja
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Catatan / Keperluan Pemohon:</span>
                <p className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 italic">
                  {pengajuan.catatan || "Tidak ada catatan pemohon."}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">
              Dokumen Persyaratan Yang Diunggah
            </h3>
            <div className="space-y-2.5">
              {pengajuan.dokumen && pengajuan.dokumen.length > 0 ? (
                pengajuan.dokumen.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{doc.namaDokumen}</p>
                      <p className="text-[11px] text-slate-400">
                        {(doc.fileSize / 1024 / 1024).toFixed(2)} MB • {doc.fileType}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {doc.statusVerifikasi === true && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[10px]">
                          Valid
                        </span>
                      )}
                      {doc.statusVerifikasi === false && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md font-bold text-[10px]">
                          Perlu Perbaikan
                        </span>
                      )}

                      <a
                        href={`/api/files/${doc.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-[#0F766E] hover:bg-teal-50 rounded-lg transition-colors"
                        title="Lihat Berkas"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">Tidak ada dokumen persyaratan terunggah.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Visual Tracking Timeline (Linimasa Pelacakan Berjenjang) ── */}
      <TrackingTimeline
        status={pengajuan.status}
        logs={pengajuan.logs}
        diprosesOleh={pengajuan.diprosesOleh}
        tanggalPengajuan={pengajuan.tanggalPengajuan}
        tanggalSelesai={pengajuan.tanggalSelesai}
        dokumenHasil={pengajuan.dokumenHasil}
      />

      {/* ── Riwayat Dokumen Surat Resmi & Aksi Unduh / Cetak ── */}
      <DocumentHistory
        pengajuanId={pengajuan.id}
        nomorPengajuan={pengajuan.nomorPengajuan}
        status={pengajuan.status}
        jenisLayanan={pengajuan.jenisLayanan}
        dokumenHasil={pengajuan.dokumenHasil}
        tanggalSelesai={pengajuan.tanggalSelesai}
      />
    </div>
  );
}
