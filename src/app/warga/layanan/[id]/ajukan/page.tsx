"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface LayananData {
  id: string;
  nama: string;
  persyaratanArr: string[];
}

export default function AjukanPelayananPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [layanan, setLayanan] = useState<LayananData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [catatan, setCatatan] = useState("");

  useEffect(() => {
    fetch(`/api/layanan/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        const persyaratans = JSON.parse(data.persyaratan || "[]");
        data.persyaratanArr = persyaratans;
        setLayanan(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleFileChange = (syarat: string, file: File | null) => {
    setFiles(prev => ({ ...prev, [syarat]: file }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!layanan) return;
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("jenisLayananId", id);
    formData.append("catatan", catatan);

    for (const syarat of layanan.persyaratanArr) {
      if (!files[syarat]) {
        setError(`Mohon upload dokumen untuk persyaratan: ${syarat}`);
        setSubmitting(false);
        return;
      }
      formData.append(`file_${syarat}`, files[syarat] as File);
    }

    try {
      const res = await fetch("/api/pengajuan", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal submit");
      
      router.push(`/warga/pengajuan/${data.id}?success=true`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Terjadi kesalahan.");
      }
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-[#64748B]">Memuat formulir...</div>;
  if (!layanan) return <div className="p-8 text-center text-[#DC2626]">Layanan tidak ditemukan: {error}</div>;

  return (
    <div className="p-3 sm:p-4 md:p-8 w-full lg:w-[95%] max-w-[1400px] mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Link 
          href={`/warga/layanan/${id}`} 
          className="px-3.5 sm:px-4 py-2 bg-white text-[#17365D] border border-[#CBD5E1] hover:bg-[#F1F5F9] rounded-xl font-medium text-xs sm:text-sm transition-colors"
        >
          &larr; Batal
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-[#17365D]">Form Pengajuan: {layanan.nama}</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-sm border border-[#E2E8F0] space-y-6">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-[#DC2626] rounded-xl font-medium text-sm">
            {error}
          </div>
        )}

        <div className="bg-[#17365D]/5 border border-[#17365D]/15 rounded-xl p-5 mb-6">
          <h2 className="font-bold text-[#17365D] mb-1">Upload Dokumen Persyaratan</h2>
          <p className="text-xs text-[#64748B] mb-4">Pastikan file yang diupload berupa PDF, JPG, atau PNG dengan ukuran maksimal 5MB per file.</p>
          
          <div className="space-y-3">
            {layanan.persyaratanArr.map((syarat: string, idx: number) => (
              <div key={idx} className="bg-white p-4 rounded-xl border border-[#CBD5E1] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="font-semibold text-sm text-[#1E293B]">
                  {syarat} <span className="text-[#DC2626]">*</span>
                </div>
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/jpg"
                  required
                  onChange={(e) => handleFileChange(syarat, e.target.files?.[0] || null)}
                  className="text-xs text-[#64748B] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#0F766E]/10 file:text-[#0F766E] hover:file:bg-[#0F766E]/20 cursor-pointer"
                />
              </div>
            ))}
            {layanan.persyaratanArr.length === 0 && (
              <p className="text-sm text-[#64748B] italic">Tidak ada dokumen persyaratan khusus.</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#1E293B] mb-2">
            Catatan Tambahan (Opsional)
          </label>
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-[#1E293B] text-sm h-28 transition-colors"
            placeholder="Tuliskan keterangan tambahan atau keperluan permohonan jika diperlukan..."
          />
        </div>

        <div className="pt-6 border-t border-[#E2E8F0] flex flex-col-reverse sm:flex-row justify-end gap-3">
          <Link
            href={`/warga/layanan/${id}`}
            className="w-full sm:w-auto text-center px-6 py-2.5 bg-white text-[#1E293B] border border-[#CBD5E1] hover:bg-[#F1F5F9] rounded-xl font-medium text-sm transition-colors"
          >
            Batal
          </Link>
          <button 
            type="submit" 
            disabled={submitting}
            className="w-full sm:w-auto px-8 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all text-sm disabled:opacity-50"
          >
            {submitting ? "Mengirim..." : "Kirim Pengajuan"}
          </button>
        </div>
      </form>
    </div>
  );
}
