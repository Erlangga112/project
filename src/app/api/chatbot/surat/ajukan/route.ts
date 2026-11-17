import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NotificationOrchestrator } from "@/lib/notifications";

function generateNomorPengajuan() {
  const date = new Date();
  const yymmdd = date.toISOString().slice(2, 10).replace(/-/g, "");
  const random = Math.floor(1000 + Math.random() * 9000).toString();
  return `REQ-${yymmdd}-${random}`;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "WARGA") {
    return NextResponse.json(
      { error: "Akses ditolak. Fitur pembuatan surat hanya dapat diajukan oleh Warga yang telah login." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { kodeLayanan, jenisLayananId, keperluan, catatan } = body;

    // Cari jenis layanan di database berdasarkan kode atau ID
    let layanan = null;
    if (jenisLayananId) {
      layanan = await prisma.jenisLayanan.findUnique({
        where: { id: jenisLayananId, isActive: true },
      });
    } else if (kodeLayanan) {
      layanan = await prisma.jenisLayanan.findFirst({
        where: {
          kode: { equals: kodeLayanan.trim(), mode: "insensitive" },
          isActive: true,
        },
      });
    }

    if (!layanan) {
      return NextResponse.json(
        { error: "Jenis layanan yang diminta tidak ditemukan atau sedang tidak aktif." },
        { status: 400 }
      );
    }

    // Ambil data profil warga dari database untuk memastikan validitas
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { profilWarga: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Data pengguna tidak ditemukan." }, { status: 404 });
    }

    const catatanLengkap = [
      keperluan ? `Keperluan: ${keperluan}` : "",
      catatan ? `Catatan Tambahan: ${catatan}` : "",
    ]
      .filter(Boolean)
      .join(" | ") || "Pengajuan surat via Asisten Desa";

    // Simpan Pengajuan Baru secara Nyata ke Database
    const pengajuan = await prisma.pengajuanLayanan.create({
      data: {
        nomorPengajuan: generateNomorPengajuan(),
        pemohonId: session.user.id,
        jenisLayananId: layanan.id,
        status: "DIAJUKAN",
        catatan: catatanLengkap,
        logs: {
          create: {
            userId: session.user.id,
            action: "Pengajuan Dibuat Melalui Asisten AI Desa",
            catatan: catatanLengkap,
          },
        },
      },
      include: {
        jenisLayanan: true,
      },
    });

    // Catat notifikasi sistem untuk warga
    try {
      await prisma.notification.create({
        data: {
          userId: session.user.id,
          title: "Pengajuan Berhasil Dibuat",
          message: `Permohonan ${layanan.nama} Anda dengan nomor ${pengajuan.nomorPengajuan} berhasil dikirim ke staf desa.`,
          type: "SUCCESS",
          link: `/warga/pengajuan/${pengajuan.id}`,
        },
      });
    } catch (notifErr) {
      console.warn("Gagal membuat notifikasi lokal:", notifErr);
    }

    // Trigger notifikasi WhatsApp ke staf desa dan email ke warga secara asinkron
    NotificationOrchestrator.handlePengajuanBaru(pengajuan.id).catch((err) => {
      console.error("Gagal mengirim notifikasi baru ke staf:", err);
    });

    return NextResponse.json({
      success: true,
      message: "Permohonan surat berhasil dibuat di sistem database desa.",
      pengajuan: {
        id: pengajuan.id,
        nomorPengajuan: pengajuan.nomorPengajuan,
        status: pengajuan.status,
        jenisLayananNama: layanan.nama,
        jenisLayananKode: layanan.kode,
        tanggalPengajuan: pengajuan.tanggalPengajuan,
        previewUrl: `/surat/preview/${pengajuan.id}`,
        detailUrl: `/warga/pengajuan/${pengajuan.id}`,
      },
    });
  } catch (error) {
    console.error("Error creating pengajuan via chatbot:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat memproses permohonan surat." },
      { status: 500 }
    );
  }
}
