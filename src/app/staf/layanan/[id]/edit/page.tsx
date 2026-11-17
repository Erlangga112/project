import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import LayananForm from "@/components/layanan/LayananForm";
import Link from "next/link";

export default async function EditLayananPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  
  if (!session || (session.user.role !== "STAF_DESA" && session.user.role !== "SUPERVISOR")) {
    redirect("/unauthorized");
  }

  const { id } = await params;
  const layanan = await prisma.jenisLayanan.findUnique({ where: { id } });

  if (!layanan) {
    redirect("/staf/layanan");
  }

  const initialData = {
    ...layanan,
    deskripsi: layanan.deskripsi ?? undefined,
    persyaratan: JSON.parse(layanan.persyaratan || "[]")
  };

  return (
    <div className="p-3 sm:p-4 md:p-8 w-full lg:w-[95%] max-w-[1400px] mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Link 
          href="/staf/layanan" 
          className="px-3.5 sm:px-4 py-2 bg-white text-[#17365D] border border-[#CBD5E1] hover:bg-[#F1F5F9] rounded-xl font-medium text-xs sm:text-sm transition-colors"
        >
          &larr; Kembali
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-[#17365D]">Edit Layanan: {layanan.kode}</h1>
      </div>
      
      <LayananForm initialData={initialData} isEdit />
    </div>
  );
}
