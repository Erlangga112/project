import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { generateSuratPDF, saveSuratPDF } from "@/lib/surat/pdf-generator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized. Silakan login terlebih dahulu." }, { status: 401 });
  }

  const { id } = await params;

  // Cari DokumenHasil berdasarkan id DokumenHasil atau id PengajuanLayanan
  const dokumenHasil = await prisma.dokumenHasil.findFirst({
    where: {
      OR: [{ id }, { pengajuanId: id }],
    },
    include: {
      pengajuan: {
        include: {
          pemohon: { include: { profilWarga: true } },
          jenisLayanan: true,
        },
      },
    },
  });

  if (!dokumenHasil || !dokumenHasil.pengajuan) {
    return NextResponse.json({ error: "Dokumen surat resmi tidak ditemukan atau belum diterbitkan." }, { status: 404 });
  }

  const pengajuan = dokumenHasil.pengajuan;

  // VALIDASI KEAMANAN KEPEMILIKAN DOKUMEN:
  // Warga hanya boleh mengunduh surat miliknya sendiri.
  const isOwner = pengajuan.pemohonId === session.user.id;
  const isAparatur = ["STAF_DESA", "SUPERVISOR", "KEPALA_DESA"].includes(session.user.role);

  if (!isOwner && !isAparatur) {
    return NextResponse.json(
      { error: "Akses Ditolak: Anda tidak memiliki hak akses untuk mengunduh dokumen surat ini." },
      { status: 403 }
    );
  }

  const safeNomor = pengajuan.nomorPengajuan.replace(/[^a-zA-Z0-9_-]/g, "");
  const downloadFileName = `Surat_Resmi_${pengajuan.jenisLayanan.kode}_${safeNomor}.pdf`;

  // Periksa apakah file PDF fisik sudah ada di disk
  let pdfBuffer: Buffer | null = null;
  if (dokumenHasil.filePath && fs.existsSync(dokumenHasil.filePath)) {
    try {
      pdfBuffer = await fs.promises.readFile(dokumenHasil.filePath);
    } catch {
      pdfBuffer = null;
    }
  }

  // Jika belum ada file fisik, generate sekarang juga
  if (!pdfBuffer) {
    const namaWarga =
      pengajuan.pemohon.nama || pengajuan.pemohon.profilWarga?.namaLengkap || "Warga Pemohon";
    const nikWarga = pengajuan.pemohon.profilWarga?.nik || "-";
    const alamatWarga = pengajuan.pemohon.profilWarga?.alamat
      ? `${pengajuan.pemohon.profilWarga.alamat}, RT ${pengajuan.pemohon.profilWarga.rt || "001"} / RW ${pengajuan.pemohon.profilWarga.rw || "001"}, Desa Perum`
      : "Desa Perum, Kec. Harjamukti, Cirebon";

    const tanggalFormatted = new Date(
      pengajuan.tanggalSelesai || dokumenHasil.createdAt
    ).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    pdfBuffer = await generateSuratPDF({
      nomorSurat: dokumenHasil.nomorSurat,
      nomorPengajuan: pengajuan.nomorPengajuan,
      jenisLayananKode: pengajuan.jenisLayanan.kode,
      jenisLayananNama: pengajuan.jenisLayanan.nama,
      pemohonNama: namaWarga,
      pemohonNIK: nikWarga,
      pemohonAlamat: alamatWarga,
      keperluan: pengajuan.catatan?.trim() || "Keperluan administrasi kependudukan / kedinasan",
      tanggal: tanggalFormatted,
    });

    // Simpan ke disk dan perbarui DokumenHasil di DB
    const saved = await saveSuratPDF(pengajuan.nomorPengajuan, pdfBuffer);
    await prisma.dokumenHasil.update({
      where: { id: dokumenHasil.id },
      data: {
        filePath: saved.filePath,
        fileSize: saved.fileSize,
      },
    });
  }

  // Kirim response PDF sebagai binary attachment
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${downloadFileName}"`,
      "Content-Length": pdfBuffer.length.toString(),
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
}

