import "dotenv/config";
import prisma from "../src/lib/prisma";

async function seedPengajuan() {
  const count = await prisma.pengajuanLayanan.count();
  if (count > 0) {
    console.log("Pengajuan already has", count, "records. Skipping.");
    return;
  }

  const budi = await prisma.user.findFirst({ where: { email: "budi@warga.id" } });
  const siti = await prisma.user.findFirst({ where: { email: "siti@warga.id" } });
  const sku = await prisma.jenisLayanan.findFirst({ where: { kode: "SKU-01" } });
  const sktm = await prisma.jenisLayanan.findFirst({ where: { kode: "SKTM-01" } });

  if (!budi || !siti || !sku || !sktm) {
    console.error("Required users or services not found");
    return;
  }

  // 1. Budi: Pengajuan SKU (DIAJUKAN)
  await prisma.pengajuanLayanan.create({
    data: {
      nomorPengajuan: "PJ-2026-0001",
      pemohonId: budi.id,
      jenisLayananId: sku.id,
      status: "DIAJUKAN",
      catatan: "Pengajuan izin usaha warung sembako",
      tanggalPengajuan: new Date(),
    }
  });

  // 2. Budi: Pengajuan SKTM (SELESAI)
  await prisma.pengajuanLayanan.create({
    data: {
      nomorPengajuan: "PJ-2026-0002",
      pemohonId: budi.id,
      jenisLayananId: sktm.id,
      status: "SELESAI",
      catatan: "Surat SKTM telah selesai dan diterbitkan",
      tanggalPengajuan: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      tanggalSelesai: new Date(),
    }
  });

  // 3. Siti: Pengajuan SKU (DIPERIKSA)
  await prisma.pengajuanLayanan.create({
    data: {
      nomorPengajuan: "PJ-2026-0003",
      pemohonId: siti.id,
      jenisLayananId: sku.id,
      status: "DIPERIKSA",
      catatan: "Dokumen KTP dan KK sedang diperiksa staf",
      tanggalPengajuan: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    }
  });

  // 4. Siti: Pengajuan SKTM (MENUNGGU_APPROVAL_KEPALA_DESA)
  await prisma.pengajuanLayanan.create({
    data: {
      nomorPengajuan: "PJ-2026-0004",
      pemohonId: siti.id,
      jenisLayananId: sktm.id,
      status: "MENUNGGU_APPROVAL_KEPALA_DESA",
      catatan: "Telah divalidasi supervisor, menunggu tanda tangan digital Kepala Desa",
      tanggalPengajuan: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    }
  });

  console.log("Successfully seeded 4 sample pengajuan for testing.");
}

seedPengajuan()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
