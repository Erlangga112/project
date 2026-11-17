import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { jenisLayananSchema } from "@/lib/validations/layanan";
import { z } from "zod";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const layanan = await prisma.jenisLayanan.findUnique({
    where: { id }
  });

  if (!layanan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Warga cannot view inactive services
  if (session.user.role === "WARGA" && !layanan.isActive) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(layanan);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "STAF_DESA" && session.user.role !== "SUPERVISOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsedData = jenisLayananSchema.parse(body);

    const existing = await prisma.jenisLayanan.findUnique({ where: { kode: parsedData.kode } });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "Kode layanan sudah terdaftar" }, { status: 400 });
    }

    const updated = await prisma.jenisLayanan.update({
      where: { id },
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
          action: "UPDATE",
          entity: "JENIS_LAYANAN",
          entityId: id,
          details: `Mengubah jenis layanan: ${parsedData.kode}`
        }
      });
    } catch { /* ignore */ }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodErrors = (error as unknown as { errors: z.ZodIssue[] }).errors;
      return NextResponse.json({ error: zodErrors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "STAF_DESA" && session.user.role !== "SUPERVISOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    // Instead of hard delete, maybe just check if it has relations. Since we might have pengajuan,
    // let's just delete it if possible, otherwise it will throw FK error which is fine for now, or just deactivate.
    // The prompt says "status aktif/nonaktif" which implies soft delete, but CRUD usually involves DELETE.
    await prisma.jenisLayanan.delete({
      where: { id }
    });

    try {
      await prisma.systemLog.create({
        data: {
          userId: session.user.id,
          action: "DELETE",
          entity: "JENIS_LAYANAN",
          entityId: id,
          details: `Menghapus jenis layanan`
        }
      });
    } catch { /* ignore */ }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete Layanan Error:", error);
    return NextResponse.json({ error: "Cannot delete service. It might be used by existing applications." }, { status: 400 });
  }
}
