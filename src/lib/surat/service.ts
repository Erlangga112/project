import prisma from "@/lib/prisma";
import { renderSuratTemplate } from "@/lib/template";

export interface RenderedSuratResult {
  isFinal: boolean;
  status: string;
  nomorSurat: string;
  nomorPengajuan: string;
  jenisLayananNama: string;
  jenisLayananKode: string;
  htmlContent: string;
  pemohonNama: string;
  tanggalSurat: string;
  filename: string;
}

/**
 * Service untuk memproses dokumen surat desa (Draft Pratinjau maupun Dokumen Final Resmi)
 */
export async function getSuratDocument(
  pengajuanId: string,
  userId: string,
  userRole: string
): Promise<{ success: boolean; data?: RenderedSuratResult; error?: string; statusHttp?: number }> {
  const pengajuan = await prisma.pengajuanLayanan.findUnique({
    where: { id: pengajuanId },
    include: {
      pemohon: { include: { profilWarga: true } },
      jenisLayanan: true,
      dokumenHasil: true,
    },
  });

  if (!pengajuan) {
    return { success: false, error: "Pengajuan surat tidak ditemukan.", statusHttp: 404 };
  }

  // Validasi Hak Akses:
  // Warga hanya boleh mengakses surat miliknya sendiri.
  // Aparatur desa (STAF_DESA, SUPERVISOR, KEPALA_DESA) memiliki akses sesuai kedinasan.
  const isOwner = pengajuan.pemohonId === userId;
  const isAparatur = ["STAF_DESA", "SUPERVISOR", "KEPALA_DESA"].includes(userRole);

  if (!isOwner && !isAparatur) {
    return {
      success: false,
      error: "Akses ditolak. Anda tidak memiliki izin untuk melihat dokumen ini.",
      statusHttp: 403,
    };
  }

  const template = pengajuan.jenisLayanan.templateSurat;
  if (!template) {
    return {
      success: false,
      error: "Template surat belum dikonfigurasi untuk layanan ini.",
      statusHttp: 400,
    };
  }

  const isFinal = pengajuan.status === "SELESAI" && !!pengajuan.dokumenHasil;
  const nomorSurat = isFinal
    ? pengajuan.dokumenHasil!.nomorSurat
    : `DRAFT-${pengajuan.nomorPengajuan}`;

  const namaWarga = pengajuan.pemohon.nama || pengajuan.pemohon.profilWarga?.namaLengkap || "Warga Desa";
  const nikWarga = pengajuan.pemohon.profilWarga?.nik || "-";
  const alamatWarga = pengajuan.pemohon.profilWarga?.alamat
    ? `${pengajuan.pemohon.profilWarga.alamat}, RT ${pengajuan.pemohon.profilWarga.rt || "001"} / RW ${pengajuan.pemohon.profilWarga.rw || "001"}, Desa Perum`
    : "Desa Perum, Kec. Harjamukti, Cirebon";

  const keperluanText = pengajuan.catatan?.trim() || "Keperluan administrasi umum";
  const tanggalFormatted = new Date(
    isFinal ? (pengajuan.tanggalSelesai || pengajuan.updatedAt) : pengajuan.tanggalPengajuan
  ).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Render variabel template surat
  const templateData: Record<string, string> = {
    nama: namaWarga,
    nik: nikWarga,
    alamat: alamatWarga,
    jenis_pelayanan: pengajuan.jenisLayanan.nama,
    nomor_surat: nomorSurat,
    tanggal: tanggalFormatted,
    keperluan: keperluanText,
  };

  let renderedBody = renderSuratTemplate(template, templateData);

  // Jika surat belum final / belum disetujui resmi, tambahkan watermark DRAFT / BELUM SAH yang tegas
  if (!isFinal) {
    const draftBanner = `
    <div style="background-color: #FEF3C7; border: 2px dashed #D97706; padding: 12px 16px; margin-bottom: 24px; border-radius: 8px; text-align: center; color: #92400E; font-family: sans-serif;">
      <strong style="display: block; font-size: 14px; letter-spacing: 1px;">⚠️ DRAFT / BELUM SAH — HANYA UNTUK PRATINJAU</strong>
      <span style="font-size: 11px;">Surat ini masih dalam status <strong>${pengajuan.status}</strong> dan belum ditandatangani atau diterbitkan secara resmi oleh Kepala Desa. Dokumen ini tidak berlaku sebagai surat keterangan sah.</span>
    </div>`;

    renderedBody = draftBanner + renderedBody;
  }

  const safeKode = pengajuan.jenisLayanan.kode.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeNomor = pengajuan.nomorPengajuan.replace(/[^a-zA-Z0-9_-]/g, "");
  const filename = `${safeKode}_${safeNomor}.pdf`;

  return {
    success: true,
    data: {
      isFinal,
      status: pengajuan.status,
      nomorSurat,
      nomorPengajuan: pengajuan.nomorPengajuan,
      jenisLayananNama: pengajuan.jenisLayanan.nama,
      jenisLayananKode: pengajuan.jenisLayanan.kode,
      htmlContent: renderedBody,
      pemohonNama: namaWarga,
      tanggalSurat: tanggalFormatted,
      filename,
    },
  };
}
