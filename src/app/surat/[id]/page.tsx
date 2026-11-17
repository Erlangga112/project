import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PrintButton from "@/components/PrintButton";

export default async function ViewSuratPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return <div className="p-8 text-center text-[#DC2626]">Anda harus login untuk melihat surat ini.</div>;

  const { id } = await params;
  
  const dokumenHasil = await prisma.dokumenHasil.findUnique({
    where: { id },
    include: {
      pengajuan: {
        include: { pemohon: true }
      }
    }
  });

  if (!dokumenHasil) return notFound();

  // Basic authorization: Only the owner, staf, spv, and kades can view
  const isOwner = dokumenHasil.pengajuan.pemohonId === session.user.id;
  const isStaffOrAbove = ["STAF_DESA", "SUPERVISOR", "KEPALA_DESA"].includes(session.user.role);

  if (!isOwner && !isStaffOrAbove) {
    return <div className="p-8 text-center text-[#DC2626]">Anda tidak memiliki akses ke dokumen ini.</div>;
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] py-4 sm:py-8 px-2 sm:px-4">
      <div className="max-w-4xl mx-auto bg-white p-4 sm:p-8 md:p-12 shadow-sm border border-[#E2E8F0] rounded-2xl print:border-none print:shadow-none print:p-0 print:m-0">
        <div className="mb-6 sm:mb-8 print:hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E2E8F0] pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <a
                href={`/warga/pengajuan/${dokumenHasil.pengajuanId}`}
                className="text-xs font-semibold text-[#0F766E] hover:underline"
              >
                &larr; Detail Pengajuan
              </a>
              <span className="text-slate-300">•</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Surat Resmi Sah
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-[#17365D]">Lembar Cetak Surat Resmi Desa</h1>
            <p className="text-xs text-[#64748B] mt-0.5 font-mono break-all">Nomor Dokumen Sah: {dokumenHasil.nomorSurat}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={`/api/surat/download/${dokumenHasil.id}`}
              download
              className="px-4 py-2.5 bg-white border border-[#CBD5E1] hover:bg-slate-50 text-[#17365D] rounded-xl font-semibold text-xs shadow-2xs transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Unduh PDF
            </a>
            <PrintButton />
          </div>
        </div>

        {/* The rendered HTML content with horizontal scroll protection */}
        <div className="overflow-x-auto">
          <div 
            className="prose max-w-none text-[#1E293B]"
            dangerouslySetInnerHTML={{ __html: dokumenHasil.content }}
          />
        </div>
      </div>
    </div>
  );
}
