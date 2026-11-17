import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";

export const metadata = {
  title: "Layanan Tersedia — Sistem Pelayanan Desa Perum",
};

// Assign icon based on service name keywords
function getServiceIcon(nama: string) {
  const lower = nama.toLowerCase();
  if (lower.includes("usaha") || lower.includes("bisnis")) {
    return (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    );
  }
  if (lower.includes("domisili") || lower.includes("tinggal")) {
    return (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    );
  }
  if (lower.includes("mampu") || lower.includes("miskin") || lower.includes("tidak mampu")) {
    return (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    );
  }
  if (lower.includes("pengantar")) {
    return (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  }
  // Default: document icon
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export default async function DaftarLayananWargaPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "WARGA") {
    redirect("/unauthorized");
  }

  const layananList = await prisma.jenisLayanan.findMany({
    where: { isActive: true },
    orderBy: { nama: "asc" },
  });

  return (
    <div className="page-container">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Layanan Desa Tersedia</h1>
          <p className="page-header-subtitle">
            Pilih jenis surat permohonan yang Anda butuhkan
          </p>
        </div>
        <Link href="/warga" className="btn btn-ghost btn-sm">
          ← Kembali ke Dashboard
        </Link>
      </div>

      {/* ── Service Grid ── */}
      {layananList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {layananList.map((l) => (
            <div key={l.id} className="service-card">
              {/* Icon */}
              <div className="service-card-icon">
                {getServiceIcon(l.nama)}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="text-base font-bold text-[#1E293B] leading-snug">
                    {l.nama}
                  </h2>
                  <span className="flex-shrink-0 inline-block px-2 py-0.5 bg-[#EFF4FB] text-[#17365D] font-mono text-[11px] font-semibold rounded-lg border border-[#DBEAFE]">
                    {l.kode}
                  </span>
                </div>
                <p className="text-sm text-[#64748B] line-clamp-3 leading-relaxed">
                  {l.deskripsi}
                </p>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-xs text-[#64748B] font-medium">
                  <svg
                    className="w-4 h-4 text-[#0F766E]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Est. {l.estimasiWaktu} Hari Kerja
                </span>
                <Link
                  href={`/warga/layanan/${l.id}`}
                  className="btn btn-primary btn-sm"
                >
                  Ajukan →
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state py-16">
            <svg
              className="empty-state-icon w-16 h-16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="font-semibold text-base">Belum ada layanan tersedia</p>
            <p className="text-sm">
              Layanan sedang dalam proses pengaktifan oleh perangkat desa.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
