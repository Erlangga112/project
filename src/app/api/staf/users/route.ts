import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role, StatusWarga } from "@prisma/client";
import { NotificationOrchestrator } from "@/lib/notifications/notification.service";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "STAF_DESA" && session.user.role !== "SUPERVISOR" && session.user.role !== "KEPALA_DESA")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const role = searchParams.get("role") || "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (search) {
    where.OR = [
      { nama: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { profilWarga: { nik: { contains: search } } },
      { profilWarga: { namaLengkap: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (role && Object.values(Role).includes(role as Role)) {
    where.role = role as Role;
  }

  try {
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        createdAt: true,
        profilWarga: {
          select: {
            id: true,
            nik: true,
            noKk: true,
            namaLengkap: true,
            tempatLahir: true,
            tanggalLahir: true,
            alamat: true,
            rt: true,
            rw: true,
            noTelepon: true,
            status: true,
          },
        },
        petugasContact: {
          select: {
            noWhatsapp: true,
          },
        },
        _count: {
          select: {
            pengajuanLayanan: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/staf/users error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "STAF_DESA" && session.user.role !== "SUPERVISOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { nama, email, password, role, nik, noKk, tempatLahir, tanggalLahir, alamat, rt, rw, noTelepon, statusWarga } = body;

    if (!nama || !email || !password) {
      return NextResponse.json({ error: "Nama, email, dan kata sandi wajib diisi" }, { status: 400 });
    }

    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!cleanEmail) {
      return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
    }

    // Check duplicate email (case-insensitive)
    const existing = await prisma.user.findFirst({
      where: {
        email: { equals: cleanEmail, mode: "insensitive" },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar pada akun lain" }, { status: 400 });
    }

    if (nik) {
      const existingNik = await prisma.profilWarga.findUnique({ where: { nik } });
      if (existingNik) {
        return NextResponse.json({ error: "NIK sudah terdaftar pada warga lain" }, { status: 400 });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedRole = (role && Object.values(Role).includes(role)) ? role : Role.WARGA;

    // Tentukan apakah perlu membuat profilWarga
    // Untuk WARGA: buat profilWarga jika ada NIK ATAU ada noTelepon
    const shouldCreateProfil = assignedRole === Role.WARGA && (nik || noTelepon);

    const user = await prisma.user.create({
      data: {
        nama: typeof nama === "string" ? nama.trim() : nama,
        email: cleanEmail,
        password: hashedPassword,
        role: assignedRole,
        ...(shouldCreateProfil
          ? {
              profilWarga: {
                create: {
                  nik: nik || `TEMP-${Date.now()}`, // placeholder jika tidak ada NIK
                  noKk: noKk || "0000000000000000",
                  namaLengkap: nama,
                  tempatLahir: tempatLahir || "Cirebon",
                  tanggalLahir: tanggalLahir ? new Date(tanggalLahir) : new Date("1990-01-01"),
                  alamat: alamat || "Desa Perum",
                  rt: rt || "001",
                  rw: rw || "001",
                  noTelepon: noTelepon || null,
                  status: (statusWarga && Object.values(StatusWarga).includes(statusWarga)) ? statusWarga : StatusWarga.AKTIF,
                },
              },
            }
          : nik
          ? {
              profilWarga: {
                create: {
                  nik,
                  noKk: noKk || "0000000000000000",
                  namaLengkap: nama,
                  tempatLahir: tempatLahir || "Cirebon",
                  tanggalLahir: tanggalLahir ? new Date(tanggalLahir) : new Date("1990-01-01"),
                  alamat: alamat || "Desa Perum",
                  rt: rt || "001",
                  rw: rw || "001",
                  noTelepon: noTelepon || null,
                  status: (statusWarga && Object.values(StatusWarga).includes(statusWarga)) ? statusWarga : StatusWarga.AKTIF,
                },
              },
            }
          : {}),
      },
    });

    try {
      await prisma.systemLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE_USER",
          entity: "USER",
          entityId: user.id,
          details: `Menambahkan user baru: ${nama} (${email}) dengan role ${assignedRole}`,
        },
      });

      // Kirim email sambutan pendaftaran akun warga
      if (assignedRole === Role.WARGA && user.email) {
        NotificationOrchestrator.handlePendaftaranWarga({
          userId: user.id,
          namaWarga: user.nama || "Warga",
          email: user.email,
        }).catch((err) => console.error("Gagal mengirim email pendaftaran warga:", err));
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ message: "Pengguna berhasil dibuat", id: user.id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/staf/users error:", error);
    return NextResponse.json({ error: "Gagal membuat pengguna" }, { status: 500 });
  }
}
