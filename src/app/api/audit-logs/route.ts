import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "SUPERVISOR" && session.user.role !== "KEPALA_DESA")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const take = parseInt(searchParams.get("take") || "50");
  const entity = searchParams.get("entity"); // e.g. AUTH, JENIS_LAYANAN

  const where: Prisma.SystemLogWhereInput = {};
  if (entity) {
    where.entity = entity;
  }

  try {
    const logs = await prisma.systemLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: {
        user: { select: { nama: true, role: true, email: true } }
      }
    });

    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
