import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { saveFile } from "@/lib/storage";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function generateNomorPengajuan() {
  const date = new Date();
  const yymmdd = date.toISOString().slice(2, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `REQ-${yymmdd}-${random}`;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session || session.user.role !== "WARGA") {
    return NextResponse.json({ error: "Forbidden. Hanya warga yang dapat mengajukan layanan." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const jenisLayananId = formData.get("jenisLayananId") as string;
    const catatan = formData.get("catatan") as string;
    
    // Verify Layanan
    const layanan = await prisma.jenisLayanan.findUnique({
      where: { id: jenisLayananId, isActive: true }
    });
    if (!layanan) return NextResponse.json({ error: "Layanan tidak valid atau tidak aktif" }, { status: 400 });

    const persyaratan = JSON.parse(layanan.persyaratan || "[]");
    
    // Extract files
    const documentsData = [];
    for (const syarat of persyaratan) {
      const file = formData.get(`file_${syarat}`) as File | null;
      if (!file) {
        return NextResponse.json({ error: `Dokumen persyaratan "${syarat}" wajib diupload` }, { status: 400 });
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: `Tipe file untuk "${syarat}" tidak diizinkan. Hanya PDF/JPG/PNG.` }, { status: 400 });
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `Ukuran file "${syarat}" maksimal 5MB.` }, { status: 400 });
      }

      const savedFile = await saveFile(file);
      documentsData.push({
        namaDokumen: syarat,
        filePath: savedFile.filePath,
        fileType: savedFile.fileType,
        fileSize: savedFile.fileSize
      });
    }

    // Create Pengajuan
    const pengajuan = await prisma.pengajuanLayanan.create({
      data: {
        nomorPengajuan: generateNomorPengajuan(),
        pemohonId: session.user.id,
        jenisLayananId: layanan.id,
        catatan: catatan || null,
        dokumen: {
          create: documentsData,
        },
        logs: {
          create: {
            userId: session.user.id,
            action: "Pengajuan Dikirim oleh Warga",
            catatan: catatan || "Permohonan baru dikirimkan melalui portal warga.",
            statusBefore: null,
            statusAfter: "DIAJUKAN",
          },
        },
      },
    });

    await prisma.notification.create({
      data: {
        userId: session.user.id,
        title: "Pengajuan Dibuat",
        message: `Pengajuan Anda dengan nomor ${pengajuan.nomorPengajuan} berhasil dikirim dan sedang dalam status DIAJUKAN.`,
        type: "SUCCESS",
        link: `/warga/pengajuan/${pengajuan.id}`,
      },
    });

    // Notifikasi otomatis ke staf & warga
    try {
      const { NotificationOrchestrator } = await import("@/lib/notifications/notification.service");
      await NotificationOrchestrator.handlePengajuanBaru(pengajuan.id);
    } catch (notifErr) {
      console.warn("handlePengajuanBaru non-blocking error:", notifErr);
    }

    return NextResponse.json(pengajuan, { status: 201 });
  } catch (error) {
    console.error("Submit pengajuan error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";

  // Jika minta spesifik
  if (id) {
    const pengajuan = await prisma.pengajuanLayanan.findUnique({
      where: { id },
      include: {
        jenisLayanan: true,
        dokumen: true,
        dokumenHasil: true,
        diprosesOleh: {
          select: { nama: true, role: true },
        },
        logs: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: { nama: true, role: true },
            },
          },
        },
      },
    });
    if (!pengajuan) return NextResponse.json({ error: "Not found" }, { status: 404 });
    
    // Warga hanya boleh akses miliknya sendiri
    if (session.user.role === "WARGA" && pengajuan.pemohonId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(pengajuan);
  }

  // Warga list
  if (session.user.role === "WARGA") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { pemohonId: session.user.id };

    if (status) {
      where.status = status;
    }

    if (search.trim()) {
      where.OR = [
        { nomorPengajuan: { contains: search.trim(), mode: "insensitive" } },
        { jenisLayanan: { nama: { contains: search.trim(), mode: "insensitive" } } },
        { catatan: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const myPengajuan = await prisma.pengajuanLayanan.findMany({
      where,
      orderBy: { tanggalPengajuan: "desc" },
      include: {
        jenisLayanan: true,
        dokumenHasil: true,
        diprosesOleh: {
          select: { nama: true, role: true },
        },
        logs: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: { nama: true, role: true },
            },
          },
        },
      },
    });
    return NextResponse.json(myPengajuan);
  }
  
  return NextResponse.json({ error: "Forbidden for this endpoint without ID" }, { status: 403 });
}
