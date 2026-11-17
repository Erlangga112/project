import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";

export default async function LayananDetailAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  
  if (!session || (session.user.role !== "STAF_DESA" && session.user.role !== "SUPERVISOR")) {
    redirect("/unauthorized");
  }

  const { id } = await params;
  const layanan = await prisma.jenisLayanan.findUnique({ where: { id } });

  if (!layanan) {
    redirect("/staf/layanan");
  }

  const persyaratan = JSON.parse(layanan.persyaratan || "[]");

  return (
    <div className="p-4 md:p-8 w-full lg:w-[95%] max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link 
            href="/staf/layanan" 
            className="px-4 py-2 bg-white text-[#17365D] border border-[#CBD5E1] hover:bg-[#F1F5F9] rounded-xl font-medium text-sm transition-colors"
          >
            &larr; Kembali
          </Link>
          <h1 className="text-2xl font-bold text-[#17365D]">Detail Layanan</h1>
        </div>
        <Link 
          href={`/staf/layanan/${id}/edit`} 
          className="px-5 py-2.5 bg-[#D97706] hover:bg-[#b45309] text-white font-semibold rounded-xl text-sm shadow-sm transition-colors"
        >
          Edit Layanan
        </Link>
      </div>
      
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-[#E2E8F0]">
        <div className="flex items-start justify-between border-b border-[#E2E8F0] pb-6 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-[#17365D]/10 text-[#17365D] font-mono text-sm font-semibold rounded-lg border border-[#17365D]/15">
                {layanan.kode}
              </span>
              {layanan.isActive ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-[#15803D] text-xs font-semibold rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
                  Aktif
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-[#DC2626] text-xs font-semibold rounded-full border border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
                  Nonaktif
                </span>
              )}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-[#1E293B]">{layanan.nama}</h2>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-bold text-[#64748B] uppercase tracking-wider mb-2">Deskripsi</h3>
            <p className="text-[#1E293B] leading-relaxed text-sm">{layanan.deskripsi || "Tidak ada deskripsi."}</p>
          </div>
          
          <div className="bg-[#F1F5F9] p-4 rounded-xl border border-[#E2E8F0]">
            <h3 className="text-sm font-bold text-[#64748B] uppercase tracking-wider mb-1">Estimasi Waktu</h3>
            <p className="text-[#17365D] font-bold text-base">{layanan.estimasiWaktu} Hari Kerja</p>
          </div>

          <div>
            <h3 className="text-sm font-bold text-[#64748B] uppercase tracking-wider mb-3">Persyaratan Dokumen</h3>
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
      </div>
    </div>
  );
}
