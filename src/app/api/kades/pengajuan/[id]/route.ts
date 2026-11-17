import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "KEPALA_DESA") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const pengajuan = await prisma.pengajuanLayanan.findUnique({
      where: { id },
      include: {
        pemohon: { include: { profilWarga: true } },
        jenisLayanan: true,
        dokumen: true,
        dokumenHasil: true,
        notificationLogs: {
          where: { channel: "WHATSAPP" },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        logs: {
          include: { user: true },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!pengajuan) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(pengajuan);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
