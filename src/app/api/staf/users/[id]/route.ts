import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role, StatusWarga } from "@prisma/client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "STAF_DESA" && session.user.role !== "SUPERVISOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        profilWarga: true,
        pengajuanLayanan: {
          select: {
            id: true,
            nomorPengajuan: true,
            status: true,
            tanggalPengajuan: true,
            jenisLayanan: { select: { nama: true } },
          },
          orderBy: { tanggalPengajuan: "desc" },
          take: 10,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("GET user error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "STAF_DESA" && session.user.role !== "SUPERVISOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { nama, email, password, role, nik, noKk, alamat, rt, rw, noTelepon, statusWarga } = body;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { profilWarga: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    // ── Build user update payload ─────────────────────────────────────────────
    // Always include nama if provided (even if unchanged — Prisma handles idempotency)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userUpdateData: any = {};

    if (typeof nama === "string" && nama.trim().length > 0) {
      userUpdateData.nama = nama.trim();
    }

    if (typeof email === "string" && email.trim().length > 0) {
      const cleanEmail = email.trim().toLowerCase();
      // Only check uniqueness when email actually changes
      if (cleanEmail !== user.email?.toLowerCase()) {
        const emailExists = await prisma.user.findFirst({
          where: {
            email: { equals: cleanEmail, mode: "insensitive" },
            NOT: { id },
          },
        });
        if (emailExists) {
          return NextResponse.json({ error: "Email sudah digunakan oleh pengguna lain" }, { status: 400 });
        }
        userUpdateData.email = cleanEmail;
      }
      // If email is same as existing, skip update (no-op)
    }

    if (typeof role === "string" && Object.values(Role).includes(role as Role)) {
      userUpdateData.role = role as Role;
    }

    if (typeof password === "string" && password.trim().length >= 6) {
      userUpdateData.password = await bcrypt.hash(password.trim(), 10);
    }

    // Always run update (even if only some fields changed)
    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id },
        data: userUpdateData,
      });
    }

    // ── Update profilWarga only for WARGA role ────────────────────────────────
    const effectiveRole = (userUpdateData.role ?? user.role) as string;

    if (effectiveRole === "WARGA") {
      const profData = {
        namaLengkap: (userUpdateData.nama ?? user.nama) || "",
        ...(typeof nik === "string" && nik.trim() ? { nik: nik.trim() } : {}),
        ...(typeof noKk === "string" && noKk.trim() ? { noKk: noKk.trim() } : {}),
        ...(typeof alamat === "string" && alamat.trim() ? { alamat: alamat.trim() } : {}),
        ...(typeof rt === "string" && rt.trim() ? { rt: rt.trim() } : {}),
        ...(typeof rw === "string" && rw.trim() ? { rw: rw.trim() } : {}),
        ...(typeof noTelepon === "string" ? { noTelepon: noTelepon.trim() || null } : {}),
        ...(typeof statusWarga === "string" && Object.values(StatusWarga).includes(statusWarga as StatusWarga)
          ? { status: statusWarga as StatusWarga }
          : {}),
      };

      if (user.profilWarga) {
        // Update existing profil
        await prisma.profilWarga.update({
          where: { userId: id },
          data: profData,
        });
      } else if (typeof nik === "string" && nik.trim()) {
        // Create profil only when NIK is provided for WARGA
        await prisma.profilWarga.create({
          data: {
            userId: id,
            nik: nik.trim(),
            noKk: (typeof noKk === "string" && noKk.trim()) ? noKk.trim() : "0000000000000000",
            namaLengkap: (userUpdateData.nama ?? user.nama) || "",
            tempatLahir: "Cirebon",
            tanggalLahir: new Date("1990-01-01"),
            alamat: (typeof alamat === "string" && alamat.trim()) ? alamat.trim() : "Desa Perum",
            rt: (typeof rt === "string" && rt.trim()) ? rt.trim() : "001",
            rw: (typeof rw === "string" && rw.trim()) ? rw.trim() : "001",
            noTelepon: (typeof noTelepon === "string" && noTelepon.trim()) ? noTelepon.trim() : null,
            status: (typeof statusWarga === "string" && Object.values(StatusWarga).includes(statusWarga as StatusWarga))
              ? (statusWarga as StatusWarga)
              : StatusWarga.AKTIF,
          },
        });
      }
    }
    // For non-WARGA roles (STAF_DESA, SUPERVISOR, KEPALA_DESA):
    // Simpan nomor WA ke PetugasContact jika disediakan
    if (effectiveRole !== "WARGA" && typeof noTelepon === "string" && noTelepon.trim()) {
      await prisma.petugasContact.upsert({
        where: { userId: id },
        update: {
          noWhatsapp: noTelepon.trim(),
          namaPetugas: (userUpdateData.nama ?? user.nama) || undefined,
          role: effectiveRole as Role,
        },
        create: {
          userId: id,
          noWhatsapp: noTelepon.trim(),
          namaPetugas: (userUpdateData.nama ?? user.nama) || undefined,
          role: effectiveRole as Role,
          isActive: true,
        },
      });
    }

    try {
      await prisma.systemLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE_USER",
          entity: "USER",
          entityId: id,
          details: `Memperbarui data pengguna: ${user.nama} -> ${userUpdateData.nama || user.nama}`,
        },
      });
    } catch {
      // ignore audit log failure
    }

    return NextResponse.json({ message: "Pengguna berhasil diperbarui" });
  } catch (error) {
    console.error("PUT user error:", error);
    return NextResponse.json({ error: "Gagal memperbarui pengguna" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "STAF_DESA" && session.user.role !== "SUPERVISOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (session.user.id === id) {
    return NextResponse.json({ error: "Anda tidak dapat menghapus akun Anda sendiri saat sedang login" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    await prisma.user.delete({ where: { id } });

    try {
      await prisma.systemLog.create({
        data: {
          userId: session.user.id,
          action: "DELETE_USER",
          entity: "USER",
          entityId: id,
          details: `Menghapus user: ${user.nama} (${user.email})`,
        },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ message: "Pengguna berhasil dihapus" });
  } catch (error) {
    console.error("DELETE user error:", error);
    return NextResponse.json({ error: "Gagal menghapus pengguna" }, { status: 500 });
  }
}
