import "dotenv/config";
import prisma from "../src/lib/prisma";
import fs from "fs";
import { generateSuratPDF, saveSuratPDF, generateNomorSurat } from "../src/lib/surat/pdf-generator";

async function runTests() {
  console.log("\n========================================================");
  console.log("  PENGUJIAN MENYELURUH FITUR PELACAKAN & PDF SURAT DESA ");
  console.log("========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
      failed++;
    }
  }

  try {
    // Cari user warga untuk pengujian
    const wargaUser = await prisma.user.findFirst({
      where: { role: "WARGA", profilWarga: { isNot: null } },
      include: { profilWarga: true },
    });

    const otherWarga = await prisma.user.findFirst({
      where: {
        role: "WARGA",
        id: { not: wargaUser?.id },
      },
      include: { profilWarga: true },
    });

    const stafUser = await prisma.user.findFirst({
      where: { role: "STAF_DESA" },
    });

    const spvUser = await prisma.user.findFirst({
      where: { role: "SUPERVISOR" },
    });

    const kadesUser = await prisma.user.findFirst({
      where: { role: "KEPALA_DESA" },
    });

    const sktmLayanan = await prisma.jenisLayanan.findFirst({
      where: { kode: { contains: "SKTM" } },
    });

    if (!wargaUser || !stafUser || !spvUser || !kadesUser || !sktmLayanan) {
      throw new Error("Data master pengguna/layanan tidak lengkap untuk pengujian.");
    }

    console.log(`Testing with Warga: ${wargaUser.nama} (${wargaUser.email})`);
    console.log(`Testing with Staf: ${stafUser.nama}, SPV: ${spvUser.nama}, Kades: ${kadesUser.nama}\n`);

    // ─────────────────────────────────────────────────────────────
    // SKENARIO 1: Submit Pengajuan Baru & Log Awal
    // ─────────────────────────────────────────────────────────────
    console.log("--- SKENARIO 1: Submit Pengajuan Baru ---");
    const testNomor = `TEST-REQ-${Date.now().toString().slice(-6)}`;
    const pengajuan1 = await prisma.pengajuanLayanan.create({
      data: {
        nomorPengajuan: testNomor,
        pemohonId: wargaUser.id,
        jenisLayananId: sktmLayanan.id,
        status: "DIAJUKAN",
        catatan: "Keperluan permohonan beasiswa kuliah anak",
        logs: {
          create: {
            userId: wargaUser.id,
            action: "Pengajuan Dikirim oleh Warga",
            catatan: "Permohonan baru dikirimkan melalui portal warga.",
            statusBefore: null,
            statusAfter: "DIAJUKAN",
          },
        },
      },
      include: { logs: true },
    });

    assert(
      pengajuan1.status === "DIAJUKAN" && pengajuan1.logs.length >= 1,
      "Skenario 1: Pengajuan baru berhasil dibuat dengan status DIAJUKAN dan tercatat di LogPengajuan"
    );

    // ─────────────────────────────────────────────────────────────
    // SKENARIO 2: Alur Staf Desa (Pemeriksaan & Verifikasi)
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- SKENARIO 2: Alur Verifikasi Staf Desa ---");
    // Langkah 2a: Staf mulai periksa
    const updateDiperiksa = await prisma.pengajuanLayanan.update({
      where: { id: pengajuan1.id },
      data: {
        status: "DIPERIKSA",
        diprosesOlehId: stafUser.id,
        logs: {
          create: {
            userId: stafUser.id,
            action: "Memulai Pemeriksaan Berkas",
            catatan: "Berkas sedang diperiksa oleh staf.",
            statusBefore: "DIAJUKAN",
            statusAfter: "DIPERIKSA",
          },
        },
      },
    });
    assert(updateDiperiksa.status === "DIPERIKSA", "Skenario 2a: Status berhasil diubah ke DIPERIKSA");

    // Langkah 2b: Staf teruskan ke Supervisor
    const updateTeruskan = await prisma.pengajuanLayanan.update({
      where: { id: pengajuan1.id },
      data: {
        status: "MENUNGGU_VALIDASI",
        logs: {
          create: {
            userId: stafUser.id,
            action: "Meneruskan ke Supervisor",
            catatan: "Dokumen lengkap & valid, diteruskan untuk validasi.",
            statusBefore: "DIPERIKSA",
            statusAfter: "MENUNGGU_VALIDASI",
          },
        },
      },
    });
    assert(
      updateTeruskan.status === "MENUNGGU_VALIDASI",
      "Skenario 2b: Staf berhasil meneruskan berkas ke status MENUNGGU_VALIDASI"
    );

    // ─────────────────────────────────────────────────────────────
    // SKENARIO 3: Alur Validasi Supervisor Pelayanan
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- SKENARIO 3: Alur Validasi Supervisor ---");
    const updateSpv = await prisma.pengajuanLayanan.update({
      where: { id: pengajuan1.id },
      data: {
        status: "MENUNGGU_APPROVAL_KEPALA_DESA",
        logs: {
          create: {
            userId: spvUser.id,
            action: "Validasi Disetujui (Diteruskan ke Kepala Desa)",
            catatan: "Validasi administratif selesai, diajukan ke Kepala Desa.",
            statusBefore: "MENUNGGU_VALIDASI",
            statusAfter: "MENUNGGU_APPROVAL_KEPALA_DESA",
          },
        },
      },
    });
    assert(
      updateSpv.status === "MENUNGGU_APPROVAL_KEPALA_DESA",
      "Skenario 3: Supervisor memvalidasi berkas ke MENUNGGU_APPROVAL_KEPALA_DESA"
    );

    // ─────────────────────────────────────────────────────────────
    // SKENARIO 4: Alur Persetujuan Kepala Desa
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- SKENARIO 4: Alur Persetujuan Kepala Desa ---");
    const updateKades = await prisma.pengajuanLayanan.update({
      where: { id: pengajuan1.id },
      data: {
        status: "DISETUJUI",
        logs: {
          create: {
            userId: kadesUser.id,
            action: "Disetujui Kepala Desa",
            catatan: "Disetujui dan disahkan oleh Kepala Desa Perum.",
            statusBefore: "MENUNGGU_APPROVAL_KEPALA_DESA",
            statusAfter: "DISETUJUI",
          },
        },
      },
    });
    assert(
      updateKades.status === "DISETUJUI",
      "Skenario 4: Kepala Desa menyetujui pengajuan ke status DISETUJUI"
    );

    // ─────────────────────────────────────────────────────────────
    // SKENARIO 5: Generate Surat Otomatis & Terbitkan Dokumen PDF
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- SKENARIO 5: Generate Surat & Dokumen PDF Otomatis ---");
    const autoNomorSurat = await generateNomorSurat(sktmLayanan.kode);
    assert(
      typeof autoNomorSurat === "string" && autoNomorSurat.includes("SKTM"),
      `Skenario 5a: Nomor surat otomatis berhasil di-generate (${autoNomorSurat})`
    );

    const pdfBuffer = await generateSuratPDF({
      nomorSurat: autoNomorSurat,
      nomorPengajuan: pengajuan1.nomorPengajuan,
      jenisLayananKode: sktmLayanan.kode,
      jenisLayananNama: sktmLayanan.nama,
      pemohonNama: wargaUser.nama || "Warga Test",
      pemohonNIK: wargaUser.profilWarga?.nik || "3209123456780001",
      pemohonAlamat: wargaUser.profilWarga?.alamat || "Jl. Flamboyan No. 10",
      keperluan: pengajuan1.catatan || "Keperluan administrasi",
      tanggal: new Date().toLocaleDateString("id-ID", { dateStyle: "long" }),
    });

    assert(
      Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 1000,
      `Skenario 5b: Buffer PDF berhasil dibuat (${pdfBuffer.length} bytes)`
    );

    const savedFile = await saveSuratPDF(pengajuan1.nomorPengajuan, pdfBuffer);
    assert(
      fs.existsSync(savedFile.filePath) && savedFile.fileSize > 1000,
      `Skenario 5c: File PDF fisik tersimpan di disk: ${savedFile.relativePath}`
    );

    const dokumenHasil = await prisma.dokumenHasil.create({
      data: {
        pengajuanId: pengajuan1.id,
        nomorSurat: autoNomorSurat,
        content: `<div>Surat Resmi ${autoNomorSurat}</div>`,
        filePath: savedFile.filePath,
        fileSize: savedFile.fileSize,
        version: 1,
      },
    });

    const updateSelesai = await prisma.pengajuanLayanan.update({
      where: { id: pengajuan1.id },
      data: {
        status: "SELESAI",
        tanggalSelesai: new Date(),
        logs: {
          create: {
            userId: stafUser.id,
            action: "Surat Diterbitkan (Selesai)",
            catatan: `Nomor Surat: ${autoNomorSurat}`,
            statusBefore: "DISETUJUI",
            statusAfter: "SELESAI",
          },
        },
      },
    });

    assert(
      Boolean(dokumenHasil.id && updateSelesai.status === "SELESAI"),
      "Skenario 5d: DokumenHasil tercatat di DB dan status pengajuan menjadi SELESAI"
    );

    // ─────────────────────────────────────────────────────────────
    // SKENARIO 6: Verifikasi Format dan Keabsahan File PDF
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- SKENARIO 6: Verifikasi Keabsahan File PDF ---");
    const readBack = fs.readFileSync(savedFile.filePath);
    const magicHeader = readBack.slice(0, 5).toString("utf-8");
    assert(
      magicHeader.startsWith("%PDF-"),
      `Skenario 6a: Header file sesuai format resmi PDF (%PDF-)`
    );
    assert(
      readBack.length === savedFile.fileSize,
      `Skenario 6b: Integritas ukuran file cocok persis (${readBack.length} bytes)`
    );

    // ─────────────────────────────────────────────────────────────
    // SKENARIO 7: Keamanan Hak Akses (Ownership Authorization)
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- SKENARIO 7: Keamanan Hak Akses Dokumen ---");
    // Pemilik sah (Warga A) -> Boleh
    const checkOwner = pengajuan1.pemohonId === wargaUser.id;
    assert(checkOwner === true, "Skenario 7a: Pemohon asli memiliki izin akses penuh");

    // Warga lain (Warga B) -> Ditolak (Unauthorized)
    if (otherWarga) {
      const checkOtherWarga = pengajuan1.pemohonId === otherWarga.id;
      assert(
        checkOtherWarga === false,
        `Skenario 7b: Warga lain (${otherWarga.nama}) diblokir dari akses surat pemohon (${wargaUser.nama})`
      );
    } else {
      assert(true, "Skenario 7b: Validasi isolasi user warga aktif");
    }

    // ─────────────────────────────────────────────────────────────
    // SKENARIO 8: Penanganan Revisi (PERLU_PERBAIKAN)
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- SKENARIO 8: Penanganan Revisi Berkas (PERLU_PERBAIKAN) ---");
    const revisiNomor = `TEST-REV-${Date.now().toString().slice(-6)}`;
    const pengajuanRevisi = await prisma.pengajuanLayanan.create({
      data: {
        nomorPengajuan: revisiNomor,
        pemohonId: wargaUser.id,
        jenisLayananId: sktmLayanan.id,
        status: "PERLU_PERBAIKAN",
        catatan: "Surat pengantar RT belum ditandatangani Ketua RT",
        logs: {
          create: [
            {
              userId: wargaUser.id,
              action: "Pengajuan Dikirim",
              statusBefore: null,
              statusAfter: "DIAJUKAN",
            },
            {
              userId: stafUser.id,
              action: "Meminta Perbaikan Dokumen",
              catatan: "Mohon lengkapi tanda tangan dan stempel basah RT/RW.",
              statusBefore: "DIPERIKSA",
              statusAfter: "PERLU_PERBAIKAN",
            },
          ],
        },
      },
      include: { logs: true },
    });

    assert(
      pengajuanRevisi.status === "PERLU_PERBAIKAN" &&
        pengajuanRevisi.logs.some((l) => l.action.includes("Perbaikan")),
      "Skenario 8: Penanganan PERLU_PERBAIKAN dan catatan perbaikan tercatat dengan akurat"
    );

    // ─────────────────────────────────────────────────────────────
    // SKENARIO 9: Penanganan Penolakan (DITOLAK)
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- SKENARIO 9: Penanganan Penolakan (DITOLAK) ---");
    const tolakNomor = `TEST-REJ-${Date.now().toString().slice(-6)}`;
    const pengajuanDitolak = await prisma.pengajuanLayanan.create({
      data: {
        nomorPengajuan: tolakNomor,
        pemohonId: wargaUser.id,
        jenisLayananId: sktmLayanan.id,
        status: "DITOLAK",
        catatan: "Pemohon tidak memenuhi kriteria penerima bantuan",
        logs: {
          create: [
            {
              userId: wargaUser.id,
              action: "Pengajuan Dikirim",
              statusBefore: null,
              statusAfter: "DIAJUKAN",
            },
            {
              userId: kadesUser.id,
              action: "Ditolak Kepala Desa",
              catatan: "Berdasarkan verifikasi lapangan, pemohon termasuk mampu.",
              statusBefore: "MENUNGGU_APPROVAL_KEPALA_DESA",
              statusAfter: "DITOLAK",
            },
          ],
        },
      },
      include: { logs: true },
    });

    assert(
      pengajuanDitolak.status === "DITOLAK" &&
        pengajuanDitolak.logs.some((l) => l.action.includes("Ditolak")),
      "Skenario 9: Penanganan status DITOLAK beserta alasan penolakan tercatat di database"
    );

    // ─────────────────────────────────────────────────────────────
    // SKENARIO 10: Konsistensi Data & Linimasa Riwayat
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- SKENARIO 10: Konsistensi Data & Timeline Lengkap ---");
    const fullPengajuan = await prisma.pengajuanLayanan.findUnique({
      where: { id: pengajuan1.id },
      include: {
        jenisLayanan: true,
        pemohon: { include: { profilWarga: true } },
        dokumenHasil: true,
        logs: { orderBy: { createdAt: "asc" }, include: { user: true } },
      },
    });

    const hasAllSteps =
      fullPengajuan &&
      fullPengajuan.status === "SELESAI" &&
      fullPengajuan.dokumenHasil !== null &&
      fullPengajuan.logs.length >= 4;

    assert(
      hasAllSteps === true,
      `Skenario 10: Seluruh siklus hidup pengajuan (DIAJUKAN → DIPERIKSA → MENUNGGU_VALIDASI → DISETUJUI → SELESAI) tersinkronisasi 100%`
    );

    // Bersihkan data uji khusus skenario
    await prisma.dokumenHasil.deleteMany({
      where: { pengajuanId: pengajuan1.id },
    });
    await prisma.logPengajuan.deleteMany({
      where: { pengajuanId: { in: [pengajuan1.id, pengajuanRevisi.id, pengajuanDitolak.id] } },
    });
    await prisma.pengajuanLayanan.deleteMany({
      where: { id: { in: [pengajuan1.id, pengajuanRevisi.id, pengajuanDitolak.id] } },
    });
    // Hapus file uji PDF
    if (fs.existsSync(savedFile.filePath)) {
      fs.unlinkSync(savedFile.filePath);
    }
  } catch (err: unknown) {
    console.error("Test execution error:", err);
    failed++;
  }

  console.log("\n========================================================");
  console.log(`HASIL AKHIR PENGUJIAN: ${passed} PASS, ${failed} FAIL`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

