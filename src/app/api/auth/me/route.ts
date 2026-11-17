import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      name: user.nama || session.user.name || "Pengguna",
      email: user.email || session.user.email || "",
      role: user.role || session.user.role,
    });
  } catch (error) {
    console.error("GET /api/auth/me error:", error);
    // Fallback to session data if DB query fails
    return NextResponse.json({
      id: session.user.id,
      name: session.user.name || "Pengguna",
      email: session.user.email || "",
      role: session.user.role,
    });
  }
}
