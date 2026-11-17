import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { renderSuratTemplate } from "@/lib/template";
import { generateSuratPDF, saveSuratPDF } from "@/lib/surat/pdf-generator";
import { NotificationOrchestrator } from "@/lib/notifications/notification.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (
    !session ||
    (session.user.role !== "STAF_DESA" &&
      session.user.role !== "SUPERVISOR" &&
      session.user.role !== "KEPALA_DESA")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { nomorSurat } = body;

    if (!nomorSurat || !nomorSurat.trim()) {
      return NextResponse.json({ error: "Nomor surat wajib diisi" }, { status: 400 });
    }

    const pengajuan = await prisma.pengajuanLayanan.findUnique({
      where: { id },
      include: {
        pemohon: { include: { profilWarga: true } },
        jenisLayanan: true,
        dokumenHasil: true,
      },
    });

    if (!pengajuan) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Cek apakah surat sudah pernah diterbitkan sebelumnya
    if (pengajuan.status === "SELESAI" && pengajuan.dokumenHasil) {
      return NextResponse.json({
        success: true,
        dokumenHasilId: pengajuan.dokumenHasil.id,
        message: "Surat sudah pernah diterbitkan sebelumnya.",
      });
    }

    if (pengajuan.status !== "DISETUJUI") {
      return NextResponse.json(
        { error: "Pengajuan belum disetujui Kepala Desa secara sah." },
        { status: 400 }
      );
    }

    // Cek keunikan nomor surat di sistem agar tidak ada nomor surat ganda
    const existingSurat = await prisma.dokumenHasil.findUnique({
      where: { nomorSurat: nomorSurat.trim() },
    });
    if (existingSurat && existingSurat.pengajuanId !== id) {
      return NextResponse.json(
        { error: `Nomor surat "${nomorSurat.trim()}" sudah digunakan pada pengajuan lain.` },
        { status: 400 }
      );
    }

    const namaPemohon =
      pengajuan.pemohon.nama || pengajuan.pemohon.profilWarga?.namaLengkap || "Warga Pemohon";
    const nikPemohon = pengajuan.pemohon.profilWarga?.nik || "-";
    const alamatPemohon = pengajuan.pemohon.profilWarga?.alamat
      ? `${pengajuan.pemohon.profilWarga.alamat}, RT ${pengajuan.pemohon.profilWarga.rt || "001"} / RW ${pengajuan.pemohon.profilWarga.rw || "001"}, Desa Perum`
      : "Desa Perum, Kec. Harjamukti, Cirebon";
    const keperluanSurat = pengajuan.catatan?.trim() || "Keperluan administrasi umum";
    const tanggalFormatted = new Date().toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // 1. Render konten HTML untuk web view & preview
    const template = pengajuan.jenisLayanan.templateSurat || "";
    const htmlData = {
      nama: namaPemohon,
      nik: nikPemohon,
      alamat: alamatPemohon,
      jenis_pelayanan: pengajuan.jenisLayanan.nama,
      nomor_surat: nomorSurat.trim(),
      tanggal: tanggalFormatted,
      keperluan: keperluanSurat,
    };
    const content = template ? renderSuratTemplate(template, htmlData) : "";

    // 2. Generate PDF resmi berformat A4 dengan PDFKit
    let filePath: string | null = null;
    let fileSize: number | null = null;
    try {
      const pdfBuffer = await generateSuratPDF({
        nomorSurat: nomorSurat.trim(),
        nomorPengajuan: pengajuan.nomorPengajuan,
        jenisLayananKode: pengajuan.jenisLayanan.kode,
        jenisLayananNama: pengajuan.jenisLayanan.nama,
        pemohonNama: namaPemohon,
        pemohonNIK: nikPemohon,
        pemohonAlamat: alamatPemohon,
        keperluan: keperluanSurat,
        tanggal: tanggalFormatted,
      });

      const saved = await saveSuratPDF(pengajuan.nomorPengajuan, pdfBuffer);
      filePath = saved.filePath;
      fileSize = saved.fileSize;
    } catch (pdfErr) {
      console.error("Gagal men-generate PDF surat fisik:", pdfErr);
    }

    // 3. Simpan dokumen hasil, ubah status ke SELESAI, dan catat log
    const updated = await prisma.$transaction([
      prisma.dokumenHasil.create({
        data: {
          pengajuanId: id,
          nomorSurat: nomorSurat.trim(),
          content,
          filePath,
          fileSize,
        },
      }),
      prisma.pengajuanLayanan.update({
        where: { id },
        data: {
          status: "SELESAI",
          tanggalSelesai: new Date(),
        },
      }),
      prisma.logPengajuan.create({
        data: {
          pengajuanId: id,
          userId: session.user.id,
          action: "Surat Diterbitkan (Selesai)",
          catatan: `Nomor Surat: ${nomorSurat.trim()}`,
          statusBefore: "DISETUJUI",
          statusAfter: "SELESAI",
        },
      }),
      prisma.notification.create({
        data: {
          userId: pengajuan.pemohonId,
          title: "Surat Resmi Telah Terbit!",
          message: `Surat Anda dengan nomor registrasi ${nomorSurat.trim()} telah berhasil diterbitkan. Silakan unduh dokumen PDF atau cetak surat Anda.`,
          type: "SUCCESS",
          link: `/warga/pengajuan/${id}`,
        },
      }),
    ]);

    // 4. Picu Notifikasi WhatsApp & Email otomatis via NotificationOrchestrator
    try {
      await NotificationOrchestrator.handleSuratSelesai({
        pengajuanId: id,
        nomorSurat: nomorSurat.trim(),
      });
    } catch (notifErr) {
      console.warn("NotificationOrchestrator handleSuratSelesai non-blocking error:", notifErr);
    }

    return NextResponse.json({
      success: true,
      dokumenHasilId: updated[0].id,
      filePath,
      fileSize,
    });
  } catch (error) {
    console.error("Terbitkan surat error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
