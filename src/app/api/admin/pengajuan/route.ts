import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "STAF_DESA") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (search) {
    where.OR = [
      { nomorPengajuan: { contains: search, mode: "insensitive" } },
      { pemohon: { nama: { contains: search, mode: "insensitive" } } },
      { pemohon: { profilWarga: { nik: { contains: search } } } }
    ];
  }

  if (status) {
    where.status = status;
  }

  try {
    const pengajuan = await prisma.pengajuanLayanan.findMany({
      where,
      include: {
        pemohon: { include: { profilWarga: true } },
        jenisLayanan: true
      },
      orderBy: { tanggalPengajuan: "desc" }
    });

    return NextResponse.json(pengajuan);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
