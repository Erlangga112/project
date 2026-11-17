import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma, StatusPengajuan } from "@prisma/client";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "KEPALA_DESA") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "MENUNGGU_APPROVAL_KEPALA_DESA";

  const where: Prisma.PengajuanLayananWhereInput = {};

  if (search) {
    where.OR = [
      { nomorPengajuan: { contains: search, mode: "insensitive" } },
      { pemohon: { nama: { contains: search, mode: "insensitive" } } },
      { pemohon: { profilWarga: { nik: { contains: search } } } }
    ];
  }

  if (status) {
    where.status = status as StatusPengajuan;
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
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
