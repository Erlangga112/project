import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "STAF_DESA") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { dokumenId, statusVerifikasi, catatanVerifikasi } = body;

    if (!dokumenId) return NextResponse.json({ error: "dokumenId required" }, { status: 400 });

    const dokumen = await prisma.dokumenPengajuan.update({
      where: { id: dokumenId },
      data: {
        statusVerifikasi,
        catatanVerifikasi: catatanVerifikasi || null
      }
    });

    return NextResponse.json(dokumen);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
