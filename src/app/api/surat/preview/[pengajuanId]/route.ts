import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getSuratDocument } from "@/lib/surat/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pengajuanId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pengajuanId } = await params;
  const result = await getSuratDocument(pengajuanId, session.user.id, session.user.role);

  if (!result.success || !result.data) {
    return NextResponse.json(
      { error: result.error || "Dokumen tidak ditemukan" },
      { status: result.statusHttp || 400 }
    );
  }

  return NextResponse.json(result.data);
}
