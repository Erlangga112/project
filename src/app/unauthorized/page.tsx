import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center space-y-6 bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-[#E2E8F0]">
        <h1 className="text-8xl font-black text-[#DC2626] tracking-tight">403</h1>
        <div>
          <h2 className="text-2xl font-bold text-[#17365D]">
            Akses Ditolak
          </h2>
          <p className="text-sm text-[#64748B] mt-2 leading-relaxed">
            Maaf, akun Anda tidak memiliki hak akses yang diperlukan untuk membuka halaman ini.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-semibold rounded-xl text-white bg-[#0F766E] hover:bg-[#0d655e] transition-colors shadow-sm hover:shadow"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
