"use client";

import React, { useState } from "react";
import Link from "next/link";

interface DocumentHistoryProps {
  pengajuanId: string;
  nomorPengajuan: string;
  status: string;
  jenisLayanan: {
    kode: string;
    nama: string;
  };
  dokumenHasil: {
    id: string;
    nomorSurat: string;
    filePath?: string | null;
    fileSize?: number | null;
    version?: number;
    createdAt?: string;
  } | null;
  tanggalSelesai?: string | null;
}

export default function DocumentHistory({
  pengajuanId,
  nomorPengajuan,
  status,
  jenisLayanan,
  dokumenHasil,
  tanggalSelesai,
}: DocumentHistoryProps) {
  const [downloading, setDownloading] = useState(false);
  const isFinal = status === "SELESAI" && !!dokumenHasil;

  const handleDownloadPDF = async () => {
    if (!dokumenHasil) return;
    setDownloading(true);
    try {
      // Trigger download dari API resmi yang memverifikasi kepemilikan
      const res = await fetch(`/api/surat/download/${dokumenHasil.id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal mengunduh file surat.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Surat_Resmi_${jenisLayanan.kode}_${nomorPengajuan}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(`Gagal mengunduh PDF: ${err.message}`);
      } else {
        alert("Gagal mengunduh berkas surat PDF.");
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-[#17365D] flex items-center gap-2">
            <svg className="w-5 h-5 text-[#0F766E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Riwayat Dokumen Surat Resmi
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Dokumen sah hasil pelayanan terpadu desa yang telah melalui persetujuan Kepala Desa.
          </p>
        </div>

        <span
          className={`text-xs font-semibold px-3 py-1 rounded-full border self-start sm:self-auto ${
            isFinal
              ? "bg-emerald-50 text-[#15803D] border-emerald-200"
              : "bg-amber-50 text-[#D97706] border-amber-200"
          }`}
        >
          {isFinal ? "Dokumen Terbit & Sah" : "Menunggu Pengesahan Akhir"}
        </span>
      </div>

      {isFinal && dokumenHasil ? (
        <div className="space-y-4">
          <div className="p-4 sm:p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-[#15803D] flex items-center justify-center shrink-0 border border-emerald-200">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">
                  Surat Keterangan Resmi Desa Perum
                </span>
                <h4 className="text-base font-bold text-[#1E293B]">{jenisLayanan.nama}</h4>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-600">
                  <span>
                    No. Surat: <strong className="font-mono text-emerald-900">{dokumenHasil.nomorSurat}</strong>
                  </span>
                  <span>•</span>
                  <span>Versi: v{dokumenHasil.version || 1}.0</span>
                  {tanggalSelesai && (
                    <>
                      <span>•</span>
                      <span>
                        Diterbitkan: {new Date(tanggalSelesai).toLocaleDateString("id-ID", { dateStyle: "long" })}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Aksi Unduh & Cetak */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0">
              <button
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="px-4 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Mengunduh...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Unduh Surat PDF</span>
                  </>
                )}
              </button>

              <Link
                href={`/surat/${dokumenHasil.id}`}
                target="_blank"
                className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-[#17365D] text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 shadow-2xs"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Cetak Lembar Surat</span>
              </Link>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
            Catatan Keaslian: Dokumen ini telah terdaftar dalam sistem register surat keluar Pemerintah Desa Perum dan dapat dicetak sendiri oleh warga pemohon sebagai dokumen resmi yang sah.
          </p>
        </div>
      ) : (
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-3">
          <div className="w-12 h-12 bg-amber-100 text-[#D97706] rounded-xl flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h4 className="text-sm font-bold text-[#1E293B]">Dokumen Resmi Belum Diterbitkan</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Surat resmi dalam format PDF akan otomatis tersedia untuk diunduh dan dicetak setelah permohonan disetujui oleh Kepala Desa dan nomor registrasi surat diterbitkan.
          </p>
          <div className="pt-2">
            <Link
              href={`/surat/preview/${pengajuanId}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-[#17365D] text-xs font-semibold rounded-xl transition-colors shadow-2xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>Lihat Pratinjau Draft A4</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

