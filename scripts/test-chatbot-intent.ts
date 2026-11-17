/**
 * Test script: verifikasi 7 pertanyaan wajib chatbot Supervisor
 * Jalankan: npx.cmd tsx scripts/test-chatbot-intent.ts
 */

import prisma from "../src/lib/prisma";
import { detectQuestionIntent } from "../src/lib/chatbot/intents";

const SUPERVISOR_ROLE = "SUPERVISOR";
const SUPERVISOR_ID = "test-supervisor";

const TESTS = [
  "Ada berapa warga?",
  "Ada berapa pengajuan?",
  "Ada berapa pengajuan selesai?",
  "Ada berapa pengajuan ditolak?",
  "Ada berapa pengajuan yang masih diproses?",
  "Berapa pengajuan yang menunggu validasi?",
  "Berapa jumlah staf desa?",
];

async function getGroundTruth() {
  const totalWarga = await prisma.user.count({ where: { role: "WARGA" } });
  const totalPengajuan = await prisma.pengajuanLayanan.count();
  const selesai = await prisma.pengajuanLayanan.count({ where: { status: "SELESAI" } });
  const ditolak = await prisma.pengajuanLayanan.count({ where: { status: "DITOLAK" } });
  const diproses = await prisma.pengajuanLayanan.count({
    where: { status: { notIn: ["SELESAI", "DITOLAK"] } },
  });
  const menungguValidasi = await prisma.pengajuanLayanan.count({
    where: { status: "MENUNGGU_VALIDASI" },
  });
  const staf = await prisma.user.count({ where: { role: "STAF_DESA" } });

  return {
    "Ada berapa warga?": { entity: "WARGA", count: totalWarga, intent: "JUMLAH_WARGA" },
    "Ada berapa pengajuan?": { entity: "PENGAJUAN", count: totalPengajuan, intent: "PENGAJUAN_TOTAL" },
    "Ada berapa pengajuan selesai?": { entity: "PENGAJUAN/SELESAI", count: selesai, intent: "PENGAJUAN_SELESAI" },
    "Ada berapa pengajuan ditolak?": { entity: "PENGAJUAN/DITOLAK", count: ditolak, intent: "PENGAJUAN_DITOLAK" },
    "Ada berapa pengajuan yang masih diproses?": { entity: "PENGAJUAN/DIPROSES", count: diproses, intent: "PENGAJUAN_DIPROSES" },
    "Berapa pengajuan yang menunggu validasi?": { entity: "PENGAJUAN/MENUNGGU_VALIDASI", count: menungguValidasi, intent: "PENGAJUAN_MENUNGGU_VALIDASI" },
    "Berapa jumlah staf desa?": { entity: "STAF", count: staf, intent: "JUMLAH_STAF" },
  };
}

async function main() {
  console.log("====================================================");
  console.log("   TEST CHATBOT INTENT — 7 Pertanyaan Wajib");
  console.log("====================================================\n");

  // Ground truth dari DB
  const gt = await getGroundTruth();

  console.log("📦 DATA AKTUAL DATABASE:");
  for (const [q, v] of Object.entries(gt)) {
    console.log(`  [${v.entity}] ${q.padEnd(50)} → ${v.count}`);
  }
  console.log();

  // Test setiap pertanyaan
  let passed = 0;
  let failed = 0;

  console.log("🧪 HASIL UJI INTENT DETECTION:");
  console.log("----------------------------------------------------");

  for (const question of TESTS) {
    const expected = gt[question as keyof typeof gt];
    const result = detectQuestionIntent(question);
    const intentMatch = result?.intent === expected.intent;

    if (intentMatch) {
      console.log(`  ✅ PASS | "${question}"`);
      console.log(`         Intent: ${result?.intent} (expected: ${expected.intent}), confidence: ${result?.confidence}`);
      passed++;
    } else {
      console.log(`  ❌ FAIL | "${question}"`);
      console.log(`         Got intent: ${result?.intent ?? "null"}, Expected: ${expected.intent}`);
      console.log(`         Confidence: ${result?.confidence ?? 0}`);
      failed++;
    }
  }

  console.log("\n----------------------------------------------------");
  console.log(`HASIL: ${passed}/${TESTS.length} LULUS — ${failed} GAGAL`);

  if (failed === 0) {
    console.log("\n🎉 Semua pengujian intent LULUS!\n");
  } else {
    console.log("\n⚠️  Ada pengujian yang gagal. Periksa kembali deteksi pattern.\n");
  }

  // Test bug utama: "Ada berapa pengajuan?" TIDAK boleh dideteksi sebagai WARGA
  console.log("🐛 TEST BUG UTAMA (Anti-regression):");
  const bugTest = detectQuestionIntent("Ada berapa pengajuan?");
  const bugPassed = bugTest?.intent !== "JUMLAH_WARGA" && bugTest?.intent === "PENGAJUAN_TOTAL";
  if (bugPassed) {
    console.log(`  ✅ BUG FIX VERIFIED: "Ada berapa pengajuan?" → ${bugTest?.intent} (bukan JUMLAH_WARGA)`);
  } else {
    console.log(`  ❌ BUG STILL PRESENT: "Ada berapa pengajuan?" → ${bugTest?.intent ?? "null"}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});

