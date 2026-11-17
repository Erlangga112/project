import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma, StatusPengajuan } from "@prisma/client";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "SUPERVISOR" && session.user.role !== "KEPALA_DESA")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const jenisLayananId = searchParams.get("jenisLayananId");
  const status = searchParams.get("status");

  const where: Prisma.PengajuanLayananWhereInput = {};

  if (startDate && endDate) {
    where.tanggalPengajuan = {
      gte: new Date(startDate),
      lte: new Date(endDate + 'T23:59:59.999Z')
    };
  } else if (startDate) {
    where.tanggalPengajuan = { gte: new Date(startDate) };
  } else if (endDate) {
    where.tanggalPengajuan = { lte: new Date(endDate + 'T23:59:59.999Z') };
  }

  if (jenisLayananId) {
    where.jenisLayananId = jenisLayananId;
  }
  
  if (status) {
    where.status = status as StatusPengajuan;
  }

  try {
    const [total, selesai, ditolak, dalamProses, byJenisLayananData] = await Promise.all([
      prisma.pengajuanLayanan.count({ where }),
      prisma.pengajuanLayanan.count({ where: { ...where, status: "SELESAI" } }),
      prisma.pengajuanLayanan.count({ where: { ...where, status: "DITOLAK" } }),
      prisma.pengajuanLayanan.count({ where: { ...where, status: { notIn: ["SELESAI", "DITOLAK"] } } }),
      prisma.pengajuanLayanan.groupBy({
        by: ['jenisLayananId'],
        where,
        _count: { id: true }
      })
    ]);

    // get names for byJenisLayanan
    const jenisLayananList = await prisma.jenisLayanan.findMany({
      where: { id: { in: byJenisLayananData.map(d => d.jenisLayananId) } }
    });

    const byJenisLayanan = byJenisLayananData.map(d => ({
      jenisLayanan: jenisLayananList.find(j => j.id === d.jenisLayananId)?.nama || "Unknown",
      count: d._count.id
    }));

    return NextResponse.json({
      total,
      selesai,
      ditolak,
      dalamProses,
      byJenisLayanan
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
