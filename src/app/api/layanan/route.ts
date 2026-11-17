import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { jenisLayananSchema } from "@/lib/validations/layanan";
import { z } from "zod";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") === "true";

  // Warga only sees active, Staf/Supervisor sees all (unless activeOnly is passed)
  const where = (session.user.role === "WARGA" || activeOnly) ? { isActive: true } : {};

  const layanan = await prisma.jenisLayanan.findMany({
    where,
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json(layanan);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session || (session.user.role !== "STAF_DESA" && session.user.role !== "SUPERVISOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsedData = jenisLayananSchema.parse(body);

    const existingKode = await prisma.jenisLayanan.findUnique({
      where: { kode: parsedData.kode }
    });

    if (existingKode) {
      return NextResponse.json({ error: "Kode layanan sudah terdaftar" }, { status: 400 });
    }

    const newLayanan = await prisma.jenisLayanan.create({
      data: {
        kode: parsedData.kode,
        nama: parsedData.nama,
        deskripsi: parsedData.deskripsi,
        estimasiWaktu: parsedData.estimasiWaktu,
        persyaratan: JSON.stringify(parsedData.persyaratan),
        templateSurat: parsedData.templateSurat || null,
        isActive: parsedData.isActive,
      }
    });

    try {
      await prisma.systemLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entity: "JENIS_LAYANAN",
          entityId: newLayanan.id,
          details: `Membuat jenis layanan baru: ${newLayanan.kode}`
        }
      });
    } catch { /* ignore */ }

    return NextResponse.json(newLayanan, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodErrors = (error as unknown as { errors: z.ZodIssue[] }).errors;
      return NextResponse.json({ error: zodErrors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
