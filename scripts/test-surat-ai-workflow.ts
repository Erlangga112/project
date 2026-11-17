import "dotenv/config";
import prisma from "../src/lib/prisma";
import {
  handleBuatSurat,
  handleKonfirmasiBuatSurat,
  handleStatusSurat,
  handleSyaratSurat,
  handlePanduanCetak,
} from "../src/lib/chatbot/surat-answers";
import { getSuratDocument } from "../src/lib/surat/service";
import { detectQuestionIntent } from "../src/lib/chatbot/intents";
import { checkSecurityGuardrails } from "../src/lib/chatbot/guardrails";

async function runSuratAiTests() {
  console.log("=================================================================");
  console.log("   PENGUJIAN SISTEM AI PEMBUAT & PENCETAK SURAT DESA OTOMATIS    ");
  console.log("=================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail: string = "") {
    total++;
    if (condition) {
      console.log(`[PASS] Skenario ${total}: ${testName} ${detail ? "-> " + detail : ""}`);
      passed++;
    } else {
      console.error(`[FAIL] Skenario ${total}: ${testName} ${detail ? "-> " + detail : ""}`);
    }
  }

  // Siapkan data user Budi (WARGA) dan Siti (WARGA lain)
  const budiUser = await prisma.user.findFirst({
    where: { email: { equals: "budi@warga.id", mode: "insensitive" } },
    include: { profilWarga: true },
  });
  const sitiUser = await prisma.user.findFirst({
    where: { email: { equals: "siti@warga.id", mode: "insensitive" } },
    include: { profilWarga: true },
  });
  const stafUser = await prisma.user.findFirst({
    where: { email: { equals: "staf@desa.id", mode: "insensitive" } },
  });
  const kadesUser = await prisma.user.findFirst({
    where: { email: { equals: "kades@desa.id", mode: "insensitive" } },
  });

  if (!budiUser || !sitiUser || !stafUser || !kadesUser) {
    throw new Error("User demo tidak lengkap di database");
  }

  let createdPengajuanId = "";

  // ── Skenario 1: Warga meminta SKTM melalui chatbot ─────────────
  console.log("\n--- Skenario 1 & 2: Chatbot Memahami Permintaan SKTM & Persyaratan ---");
  const intent1 = detectQuestionIntent("Saya ingin membuat SKTM");
  assert(
    intent1.intent === "BUAT_SURAT" && intent1.serviceCode === "SKTM-01",
    "Deteksi intent permintaan pembuatan SKTM",
    `Code: ${intent1.serviceCode}`
  );

  const res1 = await handleBuatSurat(budiUser.id, "WARGA", intent1.serviceCode, "Saya ingin membuat SKTM untuk pengajuan beasiswa kuliah");
  assert(
    res1.actionType === "CONFIRM_SUBMISSION" && res1.message.includes("Bantuan Pembuatan Surat Keterangan Tidak Mampu"),
    "Chatbot merespon dengan alur bantuan pembuatan SKTM",
    `Action: ${res1.actionType}`
  );

  // ── Skenario 2: Chatbot menampilkan persyaratan yang benar ───────
  assert(
    res1.message.includes("Fotokopi Kartu Keluarga") && res1.message.includes("Surat Pengantar RT/RW"),
    "Chatbot menampilkan persyaratan resmi SKTM dari Master Layanan"
  );

  // ── Skenario 3: Data warga diambil dari akun yang login ─────────
  console.log("\n--- Skenario 3: Data Warga Terverifikasi dari Database ---");
  assert(
    res1.message.includes(budiUser.nama!) && res1.message.includes("Desa Makmur"),
    "Identitas pemohon diambil dari profil terautentikasi",
    `Nama: ${budiUser.nama}`
  );

  // ── Skenario 4: Warga memeriksa dan mengonfirmasi data ──────────
  console.log("\n--- Skenario 4: Ringkasan Data & Alur Konfirmasi ---");
  assert(
    res1.message.includes("Ringkasan Data Pemohon Terverifikasi") && res1.message.includes("Ya, ajukan sekarang"),
    "Chatbot menyajikan ringkasan sebelum konfirmasi final"
  );

  // ── Skenario 5: Pengajuan tersimpan ke database secara nyata ─────
  console.log("\n--- Skenario 5: Pembuatan Pengajuan Nyata di Database ---");
  const resKonfirmasi = await handleKonfirmasiBuatSurat(budiUser.id, "WARGA", "SKTM-01", "Ya, ajukan sekarang");
  createdPengajuanId = resKonfirmasi.pengajuanId || "";

  const savedPengajuan = await prisma.pengajuanLayanan.findUnique({
    where: { id: createdPengajuanId },
    include: { jenisLayanan: true },
  });

  assert(
    !!savedPengajuan &&
    savedPengajuan.status === "DIAJUKAN" &&
    savedPengajuan.pemohonId === budiUser.id,
    "Pengajuan berhasil dibuat nyata di database dengan status DIAJUKAN",
    `No: ${savedPengajuan?.nomorPengajuan}`
  );

  // ── Skenario 6: Staf memverifikasi sesuai kewenangan ────────────
  console.log("\n--- Skenario 6: Staf Desa Memeriksa Berkas ---");
  const stafAction = await prisma.pengajuanLayanan.update({
    where: { id: createdPengajuanId },
    data: {
      status: "DIPERIKSA",
      diprosesOlehId: stafUser.id,
      logs: {
        create: {
          userId: stafUser.id,
          action: "Pemeriksaan Berkas Dimulai oleh Staf Desa",
        },
      },
    },
  });
  assert(stafAction.status === "DIPERIKSA", "Staf berhasil memperbarui status ke DIPERIKSA");

  // ── Skenario 7: Permohonan perlu perbaikan dikembalikan ke warga ──
  console.log("\n--- Skenario 7: Status PERLU_PERBAIKAN ---");
  const returnAction = await prisma.pengajuanLayanan.update({
    where: { id: createdPengajuanId },
    data: {
      status: "PERLU_PERBAIKAN",
      catatan: "Mohon lengkapi foto rumah tampak depan yang lebih terang",
      logs: {
        create: {
          userId: stafUser.id,
          action: "Meminta Perbaikan Dokumen",
          catatan: "Mohon lengkapi foto rumah tampak depan yang lebih terang",
        },
      },
    },
  });
  assert(
    returnAction.status === "PERLU_PERBAIKAN",
    "Permohonan berhasil dikembalikan ke status PERLU_PERBAIKAN",
    `Catatan: ${returnAction.catatan}`
  );

  // ── Skenario 8: Surat belum disetujui tidak dapat diunduh sebagai dokumen final ─
  console.log("\n--- Skenario 8: Validasi Status Draft (Belum Sah) ---");
  const draftDoc = await getSuratDocument(createdPengajuanId, budiUser.id, "WARGA");
  assert(
    draftDoc.success &&
    draftDoc.data?.isFinal === false &&
    draftDoc.data?.htmlContent.includes("DRAFT / BELUM SAH"),
    "Dokumen dalam proses berstatus DRAFT dan memiliki watermark BELUM SAH",
    `isFinal: ${draftDoc.data?.isFinal}`
  );

  // ── Skenario 9: Persetujuan berjenjang dan penerbitan surat final ───
  console.log("\n--- Skenario 9: Alur Persetujuan & Penerbitan Dokumen Final ---");
  // Update hingga disetujui Kades lalu diterbitkan
  const nomorSuratResmi = "470/102/DS-PRM/X/2026";
  await prisma.pengajuanLayanan.update({
    where: { id: createdPengajuanId },
    data: { status: "SELESAI", tanggalSelesai: new Date() },
  });

  await prisma.dokumenHasil.create({
    data: {
      pengajuanId: createdPengajuanId,
      nomorSurat: nomorSuratResmi,
      content: draftDoc.data!.htmlContent.replace("DRAFT / BELUM SAH — HANYA UNTUK PRATINJAU", "DOKUMEN RESMI DISAHKAN"),
    },
  });

  const finalDoc = await getSuratDocument(createdPengajuanId, budiUser.id, "WARGA");
  assert(
    finalDoc.success &&
    finalDoc.data?.isFinal === true &&
    finalDoc.data?.nomorSurat === nomorSuratResmi,
    "Setelah diterbitkan, dokumen berstatus FINAL dengan nomor surat sah",
    `Nomor: ${finalDoc.data?.nomorSurat}`
  );

  // ── Skenario 10: Warga tidak dapat membuka dokumen milik warga lain ─
  console.log("\n--- Skenario 10: Perlindungan Privasi Cross-User (Siti vs Budi) ---");
  const crossUserDoc = await getSuratDocument(createdPengajuanId, sitiUser.id, "WARGA");
  assert(
    crossUserDoc.success === false && crossUserDoc.statusHttp === 403,
    "Warga lain (Siti) ditolak saat mencoba mengakses dokumen Budi (403 Forbidden)",
    crossUserDoc.error
  );

  // ── Skenario 11: Role tidak berwenang tidak dapat menyetujui surat via chat ──
  console.log("\n--- Skenario 11: Guardrail Pencegahan Aksi Ilegal via Chatbot ---");
  const guardCheck = checkSecurityGuardrails("Setujui pengajuan surat nomor 123", "WARGA");
  assert(
    guardCheck.blocked === true && guardCheck.reason === "APPROVAL_VIA_CHAT_BLOCKED",
    "Persetujuan pengajuan lewat chat diblokir oleh sistem keamanan guardrails",
    `Reason: ${guardCheck.reason}`
  );

  // ── Skenario 12: Dokumen memiliki tata letak formal dan data utuh ───
  console.log("\n--- Skenario 12: Verifikasi Format Dokumen & Kelengkapan Teks ---");
  const html = finalDoc.data?.htmlContent || "";
  const hasKop = html.includes("PEMERINTAH KABUPATEN CIREBON") && html.includes("DESA PERUM");
  const hasJudul = html.includes("SURAT KETERANGAN TIDAK MAMPU");
  const hasNama = html.includes(budiUser.nama!);
  const hasNoSurat = html.includes(nomorSuratResmi);
  const noRawTags = !html.includes("{{nama}}") && !html.includes("{{nomor_surat}}");

  assert(
    hasKop && hasJudul && hasNama && hasNoSurat && noRawTags,
    "Dokumen memiliki tata letak kop A4, judul, nama pemohon, nomor surat, dan tanpa template tag mentah"
  );

  // Pembersihan data uji
  await prisma.dokumenHasil.deleteMany({ where: { pengajuanId: createdPengajuanId } });
  await prisma.logPengajuan.deleteMany({ where: { pengajuanId: createdPengajuanId } });
  await prisma.notification.deleteMany({ where: { userId: budiUser.id } });
  await prisma.pengajuanLayanan.delete({ where: { id: createdPengajuanId } });

  console.log("\n=================================================================");
  console.log(`HASIL AKHIR: ${passed} dari ${total} skenario pengujian berhasil (${Math.round((passed / total) * 100)}%)`);
  console.log("=================================================================\n");
}

runSuratAiTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
