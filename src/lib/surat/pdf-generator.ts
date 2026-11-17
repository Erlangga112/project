import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import prisma from "@/lib/prisma";

export interface SuratPDFData {
  nomorSurat: string;
  nomorPengajuan: string;
  jenisLayananKode: string;
  jenisLayananNama: string;
  pemohonNama: string;
  pemohonNIK: string;
  pemohonAlamat: string;
  keperluan: string;
  tanggal: string;
  pejabatNama?: string;
  pejabatJabatan?: string;
  pejabatNip?: string;
}

/**
 * Konversi angka bulan (1-12) ke angka romawi
 */
function toRomanMonth(monthIndex: number): string {
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return romans[monthIndex] || "I";
}

/**
 * Ambil singkatan kode layanan standar
 */
export function getShortServiceCode(rawKode: string): string {
  const clean = rawKode.toUpperCase();
  if (clean.includes("SKTM")) return "SKTM";
  if (clean.includes("SKD")) return "SKD";
  if (clean.includes("SKU")) return "SKU";
  if (clean.includes("SPK")) return "SPK";
  return clean.replace(/[^A-Z0-9]/g, "").slice(0, 5) || "KET";
}

/**
 * Generate Nomor Surat Resmi Otomatis Berurutan
 * Format: 001/SKTM/DS-PERUM/XI/2026
 */
export async function generateNomorSurat(kodeLayanan: string): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const monthRoman = toRomanMonth(now.getMonth());
  const shortCode = getShortServiceCode(kodeLayanan);

  // Hitung jumlah surat yang sudah diterbitkan tahun ini
  const countThisYear = await prisma.dokumenHasil.count({
    where: {
      createdAt: {
        gte: new Date(year, 0, 1),
        lt: new Date(year + 1, 0, 1),
      },
    },
  });

  const nextSeq = (countThisYear + 1).toString().padStart(3, "0");
  return `${nextSeq}/${shortCode}/DS-PERUM/${monthRoman}/${year}`;
}

/**
 * Buat isi spesifik berdasarkan jenis layanan
 */
function getKlausulLayanan(jenisLayananKode: string): string {
  const code = getShortServiceCode(jenisLayananKode);
  switch (code) {
    case "SKTM":
      return "Menerangkan bahwa nama tersebut di atas adalah benar-benar warga yang berdomisili di Desa Perum dan berdasarkan data kependudukan serta hasil verifikasi lapangan tergolong sebagai Keluarga Kurang Mampu / Pra-Sejahtera.";
    case "SKD":
      return "Nama tersebut di atas adalah benar-benar penduduk yang berdomisili dan menetap di lingkungan Desa Perum, Kecamatan Harjamukti, Kabupaten Cirebon hingga saat surat keterangan ini diterbitkan.";
    case "SKU":
      return "Orang tersebut di atas adalah benar-benar memiliki kegiatan usaha aktif dan bertempat tinggal di wilayah Desa Perum. Surat ini dibuat untuk kelengkapan administrasi usaha, pengajuan permodalan UMKM/KUR, atau perizinan resmi.";
    case "SPK":
      return "Orang yang bersangkutan adalah penduduk terdaftar di Desa Perum dan tidak memiliki catatan pelanggaran administrasi desa. Surat pengantar ini berlaku untuk keperluan pengurusan administrasi kependudukan di Kecamatan / Disdukcapil.";
    default:
      return "Nama tersebut di atas adalah benar-benar warga penduduk Desa Perum, Kecamatan Harjamukti, Kabupaten Cirebon yang berkelakuan baik dan tercatat dalam register kependudukan desa kami.";
  }
}

/**
 * Generate PDF Surat Resmi menggunakan PDFKit
 */
export async function generateSuratPDF(data: SuratPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Standar A4: 595.28 x 841.89 points
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 55, right: 55 },
        info: {
          Title: `${data.jenisLayananNama} - ${data.nomorSurat}`,
          Author: "Pemerintah Desa Perum",
          Subject: data.jenisLayananNama,
          Keywords: "Surat Resmi, Desa Perum, Pelayanan Desa",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      const pageWidth = 595.28;
      const leftMargin = 55;
      const rightMargin = 55;
      const contentWidth = pageWidth - leftMargin - rightMargin;

      // 1. KOP SURAT RESMI DESA
      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .text("PEMERINTAH KABUPATEN CIREBON", leftMargin, 42, {
          align: "center",
          width: contentWidth,
        });

      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .text("KECAMATAN HARJAMUKTI", leftMargin, 58, {
          align: "center",
          width: contentWidth,
        });

      doc
        .font("Helvetica-Bold")
        .fontSize(15)
        .text("KANTOR KUWU DESA PERUM", leftMargin, 74, {
          align: "center",
          width: contentWidth,
        });

      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor("#333333")
        .text(
          "Alamat: Jl. Flamboyan Raya No. 01, Desa Perum, Cirebon 45143 | Email: pelayanan@desa.id",
          leftMargin,
          95,
          { align: "center", width: contentWidth }
        );

      // Garis Ganda Kop Surat
      const lineY = 110;
      doc
        .strokeColor("#000000")
        .lineWidth(2.5)
        .moveTo(leftMargin, lineY)
        .lineTo(pageWidth - rightMargin, lineY)
        .stroke();

      doc
        .strokeColor("#000000")
        .lineWidth(0.8)
        .moveTo(leftMargin, lineY + 3.5)
        .lineTo(pageWidth - rightMargin, lineY + 3.5)
        .stroke();

      // 2. JUDUL SURAT & NOMOR
      doc.fillColor("#000000");
      const titleY = 135;
      const uppercaseTitle = data.jenisLayananNama.toUpperCase();

      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .text(uppercaseTitle, leftMargin, titleY, {
          align: "center",
          width: contentWidth,
          underline: true,
        });

      doc
        .font("Helvetica")
        .fontSize(10.5)
        .text(`Nomor: ${data.nomorSurat}`, leftMargin, titleY + 18, {
          align: "center",
          width: contentWidth,
        });

      // 3. PARAGRAF PEMBUKA
      let currentY = titleY + 48;
      doc
        .font("Helvetica")
        .fontSize(10.5)
        .text(
          "Yang bertanda tangan di bawah ini Kuwu / Kepala Desa Perum, Kecamatan Harjamukti, Kabupaten Cirebon, menerangkan dengan sebenarnya bahwa:",
          leftMargin,
          currentY,
          { align: "justify", width: contentWidth, lineGap: 3 }
        );

      currentY += 32;

      // 4. DATA PEMOHON (Format Tabel / Key-Value Rapi)
      const labelX = leftMargin + 25;
      const colonX = leftMargin + 160;
      const valueX = leftMargin + 172;
      const valueWidth = contentWidth - 172;
      const rowHeight = 18;

      const items = [
        { label: "Nama Lengkap", value: data.pemohonNama, isBold: true },
        { label: "NIK", value: data.pemohonNIK, isBold: false },
        { label: "Alamat / Domisili", value: data.pemohonAlamat, isBold: false },
        { label: "Keperluan", value: data.keperluan, isBold: false },
      ];

      for (const item of items) {
        doc.font("Helvetica").fontSize(10).text(item.label, labelX, currentY);
        doc.text(":", colonX, currentY);

        if (item.isBold) {
          doc.font("Helvetica-Bold");
        } else {
          doc.font("Helvetica");
        }

        doc.text(item.value, valueX, currentY, { width: valueWidth, lineGap: 2 });
        const heightUsed = doc.heightOfString(item.value, { width: valueWidth, lineGap: 2 });
        currentY += Math.max(rowHeight, heightUsed + 4);
      }

      currentY += 10;

      // 5. ISI KETERANGAN / KLAUSUL LAYANAN
      const klausulText = getKlausulLayanan(data.jenisLayananKode);
      doc
        .font("Helvetica")
        .fontSize(10.5)
        .text(klausulText, leftMargin, currentY, {
          align: "justify",
          width: contentWidth,
          indent: 25,
          lineGap: 3,
        });

      currentY += doc.heightOfString(klausulText, { width: contentWidth, indent: 25, lineGap: 3 }) + 14;

      // 6. PARAGRAF PENUTUP
      const penutupText =
        "Demikian Surat Keterangan ini dibuat dengan sebenarnya dan penuh rasa tanggung jawab agar dapat dipergunakan sebagaimana mestinya oleh yang berkepentingan.";
      doc
        .font("Helvetica")
        .fontSize(10.5)
        .text(penutupText, leftMargin, currentY, {
          align: "justify",
          width: contentWidth,
          indent: 25,
          lineGap: 3,
        });

      // 7. TITIMANGSA & BLOK TANDA TANGAN PEJABAT
      const ttdBoxX = pageWidth - rightMargin - 210;
      const ttdY = Math.max(currentY + 35, 590);

      doc
        .font("Helvetica")
        .fontSize(10)
        .text(`Desa Perum, ${data.tanggal}`, ttdBoxX, ttdY, { width: 210, align: "center" });

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(data.pejabatJabatan || "Kepala Desa Perum", ttdBoxX, ttdY + 15, {
          width: 210,
          align: "center",
        });

      // Placeholder Stempel & TTD Resmi
      const stampBoxY = ttdY + 36;
      doc
        .rect(ttdBoxX + 30, stampBoxY, 150, 48)
        .dash(2, { space: 2 })
        .strokeColor("#94A3B8")
        .stroke()
        .undash();

      doc
        .font("Helvetica-Oblique")
        .fontSize(8)
        .fillColor("#64748B")
        .text("[Tanda Tangan & Cap Sah]", ttdBoxX + 30, stampBoxY + 18, {
          width: 150,
          align: "center",
        });

      doc.fillColor("#000000");

      const namaPejabat = data.pejabatNama || "H. SUDIRMAN, S.Sos";
      doc
        .font("Helvetica-Bold")
        .fontSize(10.5)
        .text(`( ${namaPejabat} )`, ttdBoxX, stampBoxY + 56, {
          width: 210,
          align: "center",
          underline: true,
        });

      const nipPejabat = data.pejabatNip || "NIP. 19750817 200212 1 003";
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor("#333333")
        .text(nipPejabat, ttdBoxX, stampBoxY + 72, {
          width: 210,
          align: "center",
        });

      // 8. FOOTER DOKUMEN & WATERMARK REGISTRASI SISTEM
      const footerY = 790;
      doc
        .strokeColor("#E2E8F0")
        .lineWidth(0.5)
        .moveTo(leftMargin, footerY)
        .lineTo(pageWidth - rightMargin, footerY)
        .stroke();

      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor("#64748B")
        .text(
          `Dokumen resmi Sistem Pelayanan Desa Terpadu • No. Pengajuan: ${data.nomorPengajuan} • No. Surat: ${data.nomorSurat}`,
          leftMargin,
          footerY + 6,
          { width: contentWidth, align: "left" }
        );

      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor("#64748B")
        .text(`Halaman 1 dari 1`, leftMargin, footerY + 6, {
          width: contentWidth,
          align: "right",
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Simpan file PDF ke direktori public/surat
 */
export async function saveSuratPDF(
  nomorPengajuan: string,
  pdfBuffer: Buffer
): Promise<{ filePath: string; relativePath: string; fileSize: number }> {
  const dirPath = path.join(process.cwd(), "public", "surat");
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const safeNomor = nomorPengajuan.replace(/[^a-zA-Z0-9_-]/g, "");
  const fileName = `SURAT_${safeNomor}.pdf`;
  const fullPath = path.join(dirPath, fileName);

  await fs.promises.writeFile(fullPath, pdfBuffer);

  return {
    filePath: fullPath,
    relativePath: `/surat/${fileName}`,
    fileSize: pdfBuffer.length,
  };
}

