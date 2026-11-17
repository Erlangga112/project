"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { jenisLayananSchema, JenisLayananPayload } from "@/lib/validations/layanan";
import Link from "next/link";

interface LayananFormProps {
  initialData?: JenisLayananPayload & { id: string };
  isEdit?: boolean;
}

export default function LayananForm({ initialData, isEdit }: LayananFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<JenisLayananPayload>({
    kode: initialData?.kode || "",
    nama: initialData?.nama || "",
    deskripsi: initialData?.deskripsi || "",
    estimasiWaktu: initialData?.estimasiWaktu || 1,
    persyaratan: initialData?.persyaratan || [""],
    templateSurat: initialData?.templateSurat || "",
    isActive: initialData?.isActive ?? true,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handlePersyaratanChange = (index: number, value: string) => {
    const newPersyaratan = [...formData.persyaratan];
    newPersyaratan[index] = value;
    setFormData({ ...formData, persyaratan: newPersyaratan });
  };

  const addPersyaratan = () => setFormData({ ...formData, persyaratan: [...formData.persyaratan, ""] });
  
  const removePersyaratan = (index: number) => {
    const newPersyaratan = formData.persyaratan.filter((_, i) => i !== index);
    setFormData({ ...formData, persyaratan: newPersyaratan });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setValidationErrors({});

    // Filter empty strings
    const cleanedData = {
      ...formData,
      persyaratan: formData.persyaratan.filter(p => p.trim() !== ""),
    };

    try {
      jenisLayananSchema.parse(cleanedData);
      
      const url = isEdit ? `/api/layanan/${initialData?.id}` : "/api/layanan";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanedData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Terjadi kesalahan");
      }

      router.push("/staf/layanan");
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        const zodErrors = (err as unknown as { errors: z.ZodIssue[] }).errors;
        const fieldErrors: Record<string, string> = {};
        zodErrors.forEach((e) => {
          if (e.path[0]) fieldErrors[e.path[0].toString()] = e.message;
        });
        setValidationErrors(fieldErrors);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Terjadi kesalahan tidak dikenal");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-sm border border-[#E2E8F0]">
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-[#DC2626] rounded-xl text-sm font-medium">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-[#1E293B] mb-1.5">Kode Layanan</label>
          <input
            type="text"
            value={formData.kode}
            onChange={(e) => setFormData({ ...formData, kode: e.target.value })}
            className="w-full px-4 py-2.5 bg-white border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-sm text-[#1E293B] transition-colors"
            placeholder="Misal: SKU-01"
          />
          {validationErrors.kode && <p className="text-[#DC2626] text-xs mt-1">{validationErrors.kode}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#1E293B] mb-1.5">Nama Layanan</label>
          <input
            type="text"
            value={formData.nama}
            onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
            className="w-full px-4 py-2.5 bg-white border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-sm text-[#1E293B] transition-colors"
            placeholder="Surat Keterangan Usaha"
          />
          {validationErrors.nama && <p className="text-[#DC2626] text-xs mt-1">{validationErrors.nama}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#1E293B] mb-1.5">Deskripsi Pelayanan</label>
        <textarea
          value={formData.deskripsi}
          onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
          className="w-full px-4 py-2.5 bg-white border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-sm text-[#1E293B] h-24 transition-colors"
          placeholder="Jelaskan mengenai kegunaan dan informasi layanan ini..."
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#1E293B] mb-1.5">Estimasi Waktu Pengerjaan (Hari Kerja)</label>
        <input
          type="number"
          min={1}
          value={formData.estimasiWaktu}
          onChange={(e) => setFormData({ ...formData, estimasiWaktu: parseInt(e.target.value) || 1 })}
          className="w-full md:w-1/3 px-4 py-2.5 bg-white border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-sm text-[#1E293B] transition-colors"
        />
        {validationErrors.estimasiWaktu && <p className="text-[#DC2626] text-xs mt-1">{validationErrors.estimasiWaktu}</p>}
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#1E293B] mb-2">Persyaratan Dokumen yang Wajib Diunggah</label>
        {validationErrors.persyaratan && <p className="text-[#DC2626] text-xs mb-2">{validationErrors.persyaratan}</p>}
        <div className="space-y-3">
          {formData.persyaratan.map((syarat, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={syarat}
                onChange={(e) => handlePersyaratanChange(idx, e.target.value)}
                className="flex-1 px-4 py-2.5 bg-white border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-sm text-[#1E293B] transition-colors"
                placeholder={`Persyaratan ${idx + 1} (Misal: KTP, KK, Pengantar RT)`}
              />
              <button
                type="button"
                onClick={() => removePersyaratan(idx)}
                className="px-3.5 py-2.5 bg-rose-50 text-[#DC2626] border border-rose-200 rounded-xl hover:bg-rose-100 text-xs font-semibold transition-colors"
              >
                Hapus
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addPersyaratan}
          className="mt-3 px-4 py-2 bg-[#F1F5F9] text-[#17365D] border border-[#CBD5E1] text-xs font-semibold rounded-xl hover:bg-slate-200 transition-colors"
        >
          + Tambah Persyaratan
        </button>
      </div>

      {/* Konfigurasi Template Surat Resmi */}
      <div className="pt-4 border-t border-[#E2E8F0]">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-semibold text-[#1E293B]">
            Template Format Surat Resmi (HTML)
          </label>
          <span className="text-xs text-[#64748B]">
            Variabel: <code className="bg-slate-100 text-[#0F766E] px-1 py-0.5 rounded">{"{{nama}}"}</code>, <code className="bg-slate-100 text-[#0F766E] px-1 py-0.5 rounded">{"{{nik}}"}</code>, <code className="bg-slate-100 text-[#0F766E] px-1 py-0.5 rounded">{"{{alamat}}"}</code>, <code className="bg-slate-100 text-[#0F766E] px-1 py-0.5 rounded">{"{{nomor_surat}}"}</code>, <code className="bg-slate-100 text-[#0F766E] px-1 py-0.5 rounded">{"{{tanggal}}"}</code>, <code className="bg-slate-100 text-[#0F766E] px-1 py-0.5 rounded">{"{{keperluan}}"}</code>
          </span>
        </div>
        <textarea
          rows={7}
          value={formData.templateSurat || ""}
          onChange={(e) => setFormData({ ...formData, templateSurat: e.target.value })}
          className="w-full px-4 py-3 bg-white border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-xs font-mono text-[#1E293B] transition-colors leading-relaxed"
          placeholder="Masukkan template HTML surat resmi dengan kop desa dan variabel {{nama}}, {{nik}}, {{alamat}}, {{nomor_surat}}, {{tanggal}}, {{keperluan}}..."
        />
        <p className="text-[11px] text-[#64748B] mt-1">
          Format HTML ini akan digunakan oleh sistem untuk merender lembar pratinjau dan dokumen cetak PDF resmi desa.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-[#E2E8F0]">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0F766E]"></div>
          <span className="ml-3 text-sm font-semibold text-[#1E293B]">Status Layanan Aktif</span>
        </label>
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-[#E2E8F0]">
        <Link 
          href="/staf/layanan" 
          className="w-full sm:w-auto text-center px-6 py-2.5 rounded-xl border border-[#CBD5E1] text-[#1E293B] text-sm font-semibold hover:bg-[#F1F5F9] transition-colors"
        >
          Batal
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto text-center px-6 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50"
        >
          {loading ? "Menyimpan..." : (isEdit ? "Simpan Perubahan" : "Tambah Layanan")}
        </button>
      </div>
    </form>
  );
}
