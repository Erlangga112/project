import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { generateNomorSurat } from "@/lib/surat/pdf-generator";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !["STAF_DESA", "SUPERVISOR", "KEPALA_DESA"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { jenisLayananKode } = body;

    const nomorSurat = await generateNomorSurat(jenisLayananKode || "SKTM");
    return NextResponse.json({ success: true, nomorSurat });
  } catch (error) {
    console.error("Generate nomor surat error:", error);
    return NextResponse.json({ error: "Gagal membuat nomor surat otomatis" }, { status: 500 });
  }
}

