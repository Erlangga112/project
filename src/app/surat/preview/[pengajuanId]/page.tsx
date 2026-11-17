import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import PrintButton from "@/components/PrintButton";
import { getSuratDocument } from "@/lib/surat/service";

export default async function PreviewSuratPage({
  params,
}: {
  params: Promise<{ pengajuanId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const { pengajuanId } = await params;
  const result = await getSuratDocument(pengajuanId, session.user.id, session.user.role);

  if (!result.success || !result.data) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0] text-center">
          <div className="w-12 h-12 bg-rose-50 text-[#DC2626] rounded-xl flex items-center justify-center mx-auto mb-3 font-bold text-lg">
            ✕
          </div>
          <h2 className="text-lg font-bold text-[#17365D] mb-1">Gagal Memuat Dokumen</h2>
          <p className="text-xs text-[#64748B] mb-5">{result.error || "Dokumen tidak ditemukan."}</p>
          <Link
            href="/warga"
            className="inline-block px-4 py-2 bg-[#17365D] text-white rounded-xl text-xs font-semibold hover:bg-[#122844] transition-colors"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const doc = result.data;

  return (
    <div className="min-h-screen bg-[#F1F5F9] py-4 sm:py-8 px-2 sm:px-4">
      <div className="max-w-4xl mx-auto bg-white p-4 sm:p-8 md:p-12 shadow-sm border border-[#E2E8F0] rounded-2xl print:border-none print:shadow-none print:p-0 print:m-0">
        {/* Navigation & Print Action Header (Hidden saat dicetak) */}
        <div className="mb-6 sm:mb-8 print:hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E2E8F0] pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Link
                href={`/warga/pengajuan/${pengajuanId}`}
                className="text-xs font-medium text-[#0F766E] hover:underline flex items-center gap-1"
              >
                &larr; Detail Pengajuan
              </Link>
              <span className="text-slate-300">•</span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  doc.isFinal
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {doc.isFinal ? "Dokumen Resmi Final" : `Pratinjau (${doc.status})`}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-[#17365D]">{doc.jenisLayananNama}</h1>
            <p className="text-xs text-[#64748B] mt-0.5 font-mono break-all">
              Ref Pengajuan: {doc.nomorPengajuan} | Nomor Surat: {doc.nomorSurat}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {doc.isFinal && (
              <a
                href={`/api/surat/download/${pengajuanId}`}
                download
                className="px-4 py-2.5 bg-white border border-[#CBD5E1] hover:bg-slate-50 text-[#17365D] rounded-xl font-semibold text-xs shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Unduh PDF
              </a>
            )}
            <PrintButton />
          </div>
        </div>

        {/* Lembar Dokumen Surat Resmi (A4 Layout) with scroll protection */}
        <div className="overflow-x-auto">
          <div
            className="prose max-w-none text-[#1E293B]"
            style={{ minHeight: "297mm" }}
            dangerouslySetInnerHTML={{ __html: doc.htmlContent }}
          />
        </div>
      </div>
    </div>
  );
}
