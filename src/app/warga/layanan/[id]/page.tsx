import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";

export default async function LayananDetailWargaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  
  if (!session || session.user.role !== "WARGA") {
    redirect("/unauthorized");
  }

  const { id } = await params;
  const layanan = await prisma.jenisLayanan.findUnique({ where: { id, isActive: true } });

  if (!layanan) {
    redirect("/warga/layanan");
  }

  const persyaratan = JSON.parse(layanan.persyaratan || "[]");

  return (
    <div className="p-4 md:p-8 w-full lg:w-[95%] max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link 
          href="/warga/layanan" 
          className="px-4 py-2 bg-white text-[#17365D] border border-[#CBD5E1] hover:bg-[#F1F5F9] rounded-xl font-medium text-sm transition-colors"
        >
          &larr; Kembali ke Daftar Layanan
        </Link>
      </div>
      
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-[#E2E8F0]">
        <div className="border-b border-[#E2E8F0] pb-6 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="px-3 py-1 bg-[#17365D]/10 text-[#17365D] font-mono text-sm font-semibold rounded-lg border border-[#17365D]/15">
              {layanan.kode}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-[#17365D]">{layanan.nama}</h1>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-[#1E293B] mb-2">Deskripsi Pelayanan</h3>
            <p className="text-[#64748B] leading-relaxed text-sm">{layanan.deskripsi || "Tidak ada deskripsi."}</p>
          </div>
          
          <div className="flex items-center gap-3 text-[#1E293B] bg-[#F1F5F9] p-4 rounded-xl border border-[#E2E8F0]">
            <svg className="w-5 h-5 text-[#0F766E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">
              <strong className="font-semibold text-[#17365D]">Estimasi Waktu Pengerjaan:</strong> {layanan.estimasiWaktu} Hari Kerja
            </span>
          </div>

          <div>
            <h3 className="text-base font-bold text-[#1E293B] mb-3">Persyaratan Dokumen</h3>
            <div className="bg-[#17365D]/5 border border-[#17365D]/15 rounded-xl p-5">
              <p className="text-sm text-[#17365D] mb-3 font-semibold">Siapkan dokumen-dokumen berikut sebelum mengajukan pelayanan:</p>
              <ul className="list-disc list-inside space-y-2 text-[#1E293B] text-sm">
                {persyaratan.length > 0 ? (
                  persyaratan.map((syarat: string, idx: number) => (
                    <li key={idx} className="leading-relaxed">{syarat}</li>
                  ))
                ) : (
                  <li className="text-[#64748B]">Tidak ada syarat khusus.</li>
                )}
              </ul>
            </div>
          </div>

          <div className="pt-6 mt-8 border-t border-[#E2E8F0] flex justify-end">
            <Link 
              href={`/warga/layanan/${layanan.id}/ajukan`} 
              className="px-6 py-3 bg-[#0F766E] hover:bg-[#0d655e] text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all text-base inline-block"
            >
              Ajukan Pelayanan Ini
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
