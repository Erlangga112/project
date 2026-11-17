import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getFileBuffer } from "@/lib/storage";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Cek database
  const dokumen = await prisma.dokumenPengajuan.findUnique({
    where: { id },
    include: { pengajuan: true }
  });

  if (!dokumen) return NextResponse.json({ error: "File not found in DB" }, { status: 404 });

  // Hanya pemilik pengajuan atau admin yang boleh melihat file
  const isPemilik = dokumen.pengajuan.pemohonId === session.user.id;
  const isAdmin = ["STAF_DESA", "SUPERVISOR", "KEPALA_DESA"].includes(session.user.role);

  if (!isPemilik && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const buffer = await getFileBuffer(dokumen.filePath);
  if (!buffer) return NextResponse.json({ error: "File not found on disk" }, { status: 404 });

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": dokumen.fileType,
      "Content-Length": dokumen.fileSize.toString(),
      "Content-Disposition": `inline; filename="${dokumen.filePath}"`,
      "X-Content-Type-Options": "nosniff"
    }
  });
}
