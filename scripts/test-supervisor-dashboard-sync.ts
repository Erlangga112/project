/**
 * test-supervisor-dashboard-sync.ts
 * Verifikasi 8 metrik wajib chatbot sinkron dengan Dashboard Supervisor.
 *
 * Run: npx.cmd tsx scripts/test-supervisor-dashboard-sync.ts
 */
import prisma from "../src/lib/prisma";
import { getActualPelayananStats, getActualUserStats } from "../src/lib/chatbot/stats";
import { detectQuestionIntent } from "../src/lib/chatbot/intents";
import { formatStatisticAnswer } from "../src/lib/chatbot/answers";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

function assert(label: string, actual: number, expected: number) {
  const ok = actual === expected;
  console.log(`${ok ? PASS : FAIL}  ${label}: ${actual} (expected: ${expected})`);
  return ok;
}

async function getDashboardWidgets() {
  // Persis sama dengan src/app/supervisor/page.tsx
  const [
    totalPengajuan,
    menungguValidasi,
    disetujuiWidget,
    ditolak,
    totalPengguna,
  ] = await Promise.all([
    prisma.pengajuanLayanan.count(),
    prisma.pengajuanLayanan.count({ where: { status: "MENUNGGU_VALIDASI" } }),
    prisma.pengajuanLayanan.count({
      where: { status: { in: ["DISETUJUI_SUPERVISOR", "MENUNGGU_APPROVAL_KEPALA_DESA", "DISETUJUI", "SELESAI"] } },
    }),
    prisma.pengajuanLayanan.count({ where: { status: "DITOLAK" } }),
    prisma.user.count(),
  ]);

  const totalWarga = await prisma.user.count({ where: { role: "WARGA" } });
  const totalStaf = await prisma.user.count({ where: { role: "STAF_DESA" } });
  const selesai = await prisma.pengajuanLayanan.count({ where: { status: "SELESAI" } });
  const diproses = await prisma.pengajuanLayanan.count({
    where: { status: { notIn: ["SELESAI", "DITOLAK"] } },
  });

  return {
    totalPengajuan,
    menungguValidasi,
    disetujuiWidget,
    ditolak,
    totalPengguna,
    totalWarga,
    totalStaf,
    selesai,
    diproses,
  };
}

async function main() {
  console.log("=".repeat(60));
  console.log("  SUPERVISOR DASHBOARD SYNC — Verifikasi 8 Metrik Wajib");
  console.log("=".repeat(60));

  // 1. Ambil angka langsung dari dashboard (ground truth)
  const dashboard = await getDashboardWidgets();
  console.log("\n📊 Angka Dashboard Supervisor (Ground Truth):");
  console.log(`   Total Pengajuan      : ${dashboard.totalPengajuan}`);
  console.log(`   Menunggu Validasi    : ${dashboard.menungguValidasi}`);
  console.log(`   Disetujui (Widget 3) : ${dashboard.disetujuiWidget}`);
  console.log(`   Ditolak              : ${dashboard.ditolak}`);
  console.log(`   Total Pengguna       : ${dashboard.totalPengguna}`);
  console.log(`   Total Warga          : ${dashboard.totalWarga}`);
  console.log(`   Total Staf           : ${dashboard.totalStaf}`);
  console.log(`   Selesai              : ${dashboard.selesai}`);
  console.log(`   Sedang Diproses      : ${dashboard.diproses}`);

  // 2. Ambil data via getActualPelayananStats & getActualUserStats
  console.log("\n📋 Verifikasi PelayananStatsResult vs Dashboard:");
  const pelStats = await getActualPelayananStats();
  const userStats = await getActualUserStats();

  let allPass = true;
  allPass = assert("Total Pengajuan      ", pelStats.totalPengajuan, dashboard.totalPengajuan) && allPass;
  allPass = assert("Menunggu Validasi    ", pelStats.menungguValidasi, dashboard.menungguValidasi) && allPass;
  allPass = assert("Disetujui (Widget 3) ", pelStats.disetujui, dashboard.disetujuiWidget) && allPass;
  allPass = assert("Ditolak              ", pelStats.ditolak, dashboard.ditolak) && allPass;
  allPass = assert("Selesai              ", pelStats.selesai, dashboard.selesai) && allPass;
  allPass = assert("Sedang Diproses      ", pelStats.sedangDiproses, dashboard.diproses) && allPass;
  allPass = assert("Total Warga          ", userStats.wargaCount, dashboard.totalWarga) && allPass;
  allPass = assert("Total Staf           ", userStats.stafCount, dashboard.totalStaf) && allPass;

  // 3. Verifikasi intent detection untuk "disetujui"
  console.log("\n🤖 Verifikasi Intent Detection (PENGAJUAN_DISETUJUI):");
  const queries = [
    "Ada berapa pengajuan yang disetujui?",
    "Berapa yang sudah disetujui?",
    "Jumlah pengajuan disetujui",
    "Total pengajuan yang disetujui",
  ];
  for (const q of queries) {
    const result = detectQuestionIntent(q);
    const ok = result.intent === "PENGAJUAN_DISETUJUI";
    console.log(`${ok ? PASS : FAIL}  "${q}" → ${result.intent}`);
    allPass = ok && allPass;
  }

  // 4. Verifikasi "tidak disetujui" tidak masuk PENGAJUAN_DISETUJUI
  console.log("\n🛡️  Verifikasi Guard (tidak disetujui → PENGAJUAN_DITOLAK):");
  const guardQueries = [
    "Berapa pengajuan yang tidak disetujui?",
    "Pengajuan yang ditolak ada berapa?",
  ];
  for (const q of guardQueries) {
    const result = detectQuestionIntent(q);
    const ok = result.intent !== "PENGAJUAN_DISETUJUI";
    console.log(`${ok ? PASS : FAIL}  "${q}" → ${result.intent}`);
    allPass = ok && allPass;
  }

  // 5. Verifikasi format jawaban PENGAJUAN_DISETUJUI
  console.log("\n📝 Verifikasi format jawaban PENGAJUAN_DISETUJUI:");
  const answer = formatStatisticAnswer("PENGAJUAN_DISETUJUI", userStats, pelStats);
  const containsCorrectCount = answer.includes(`${dashboard.disetujuiWidget} pengajuan yang disetujui`);
  console.log(`${containsCorrectCount ? PASS : FAIL}  Jawaban menyebutkan angka disetujui yang benar (${dashboard.disetujuiWidget})`);
  if (!containsCorrectCount) {
    console.log("   Jawaban:", answer.slice(0, 200));
    allPass = false;
  }

  // Ringkasan
  console.log("\n" + "=".repeat(60));
  console.log(allPass ? "🎉 SEMUA TEST LULUS — Dashboard & Chatbot sinkron!" : "⚠️  ADA TEST YANG GAGAL — Periksa log di atas");
  console.log("=".repeat(60));

  await prisma.$disconnect();
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

