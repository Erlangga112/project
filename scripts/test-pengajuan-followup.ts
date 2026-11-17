/**
 * Test script: verifikasi 7 alur percakapan wajib pengajuan follow-up
 * Jalankan: npx.cmd tsx scripts/test-pengajuan-followup.ts
 */

import prisma from "../src/lib/prisma";
import { resolveContextualQuestion } from "../src/lib/chatbot/context-resolver";
import { detectQuestionIntent } from "../src/lib/chatbot/intents";
import { formatStatisticAnswer } from "../src/lib/chatbot/answers";
import { getActualUserStats, getActualPelayananStats } from "../src/lib/chatbot/stats";
import { getSessionState, updateSessionState, clearSessionState } from "../src/lib/chatbot/memory";

async function runPengajuanConversations() {
  console.log("================================================================");
  console.log("   TEST CONTEXT FOLLOW-UP PENGAJUAN — 7 Pertanyaan Wajib");
  console.log("================================================================\n");

  const supervisorUser = await prisma.user.findFirst({
    where: { role: "SUPERVISOR" },
    select: { id: true, nama: true, email: true, role: true },
  });

  if (!supervisorUser) {
    throw new Error("User SUPERVISOR tidak ditemukan di database!");
  }

  const userId = supervisorUser.id;
  const role = "SUPERVISOR";
  const sessionKey = `test-supervisor-pengajuan:${userId}`;
  clearSessionState(sessionKey);

  let passedCount = 0;
  const totalTests = 7;

  async function simulateChatTurn(query: string, history: Array<{ role: string; content: string }>) {
    const sessionState = getSessionState(sessionKey, history);

    // 1. Context resolver
    const contextualResult = await resolveContextualQuestion(
      query,
      sessionState,
      role,
      userId,
      sessionKey
    );

    if (contextualResult.handled && contextualResult.response) {
      if (contextualResult.updatedState) {
        updateSessionState(sessionKey, contextualResult.updatedState);
      }
      return { source: "context-resolver", response: contextualResult.response, state: getSessionState(sessionKey) };
    }

    // 2. Intent detection
    const intentResult = detectQuestionIntent(query);
    if (intentResult.intent !== "UNKNOWN") {
      const [userStats, pelayananStats] = await Promise.all([
        getActualUserStats(),
        getActualPelayananStats(),
      ]);
      const answer = formatStatisticAnswer(intentResult.intent, userStats, pelayananStats);

      if (
        [
          "PENGAJUAN_TOTAL",
          "PENGAJUAN_SELESAI",
          "PENGAJUAN_DITOLAK",
          "PENGAJUAN_DIPROSES",
          "PENGAJUAN_MENUNGGU_VALIDASI",
          "PENGAJUAN_BELUM_SELESAI",
          "STATISTIK_PENGAJUAN",
        ].includes(intentResult.intent)
      ) {
        updateSessionState(sessionKey, { entity: "PENGAJUAN", lastIntent: intentResult.intent, lastQuery: query });
      }

      return { source: "statistic-intent", response: answer, state: getSessionState(sessionKey) };
    }

    return { source: "fallback-ai", response: "Jawaban AI umum", state: getSessionState(sessionKey) };
  }

  const history: Array<{ role: string; content: string }> = [];

  // UJI 1: "Berapa total pengajuan?"
  console.log("--- Uji 1: 'Berapa total pengajuan?' ---");
  const turn1 = await simulateChatTurn("Berapa total pengajuan?", history);
  history.push({ role: "user", content: "Berapa total pengajuan?" });
  history.push({ role: "assistant", content: turn1.response });
  const test1Ok = turn1.response.includes("12") && turn1.state.entity === "PENGAJUAN";
  console.log(`Source: ${turn1.source}`);
  console.log(`State Entity: ${turn1.state.entity}`);
  console.log(`Snippet:\n${turn1.response.split("\n").slice(0, 3).join("\n")}`);
  console.log(`Hasil: ${test1Ok ? "✅ LULUS" : "❌ GAGAL"}\n`);
  if (test1Ok) passedCount++;

  // UJI 2: "Apa saja?" (Follow-up dari total pengajuan)
  console.log("--- Uji 2: 'Apa saja?' (Follow-up Pengajuan) ---");
  const turn2 = await simulateChatTurn("Apa saja?", history);
  history.push({ role: "user", content: "Apa saja?" });
  history.push({ role: "assistant", content: turn2.response });
  const test2Ok =
    turn2.response.toLowerCase().includes("daftar") &&
    turn2.response.toLowerCase().includes("nama pemohon") &&
    turn2.response.toLowerCase().includes("jenis pengajuan");
  console.log(`Source: ${turn2.source}`);
  console.log(`State Entity: ${turn2.state.entity}`);
  console.log(`Snippet:\n${turn2.response.split("\n").slice(0, 6).join("\n")}`);
  console.log(`Hasil: ${test2Ok ? "✅ LULUS" : "❌ GAGAL"}\n`);
  if (test2Ok) passedCount++;

  // UJI 3: "Siapa saja yang mengajukan?"
  console.log("--- Uji 3: 'Siapa saja yang mengajukan?' ---");
  const turn3 = await simulateChatTurn("Siapa saja yang mengajukan?", history);
  history.push({ role: "user", content: "Siapa saja yang mengajukan?" });
  history.push({ role: "assistant", content: turn3.response });
  const test3Ok =
    turn3.response.toLowerCase().includes("nama pemohon") ||
    turn3.response.toLowerCase().includes("pemohon");
  console.log(`Source: ${turn3.source}`);
  console.log(`Snippet:\n${turn3.response.split("\n").slice(0, 4).join("\n")}`);
  console.log(`Hasil: ${test3Ok ? "✅ LULUS" : "❌ GAGAL"}\n`);
  if (test3Ok) passedCount++;

  // UJI 4: "Pengajuan mana saja yang sudah selesai?"
  console.log("--- Uji 4: 'Pengajuan mana saja yang sudah selesai?' ---");
  const turn4 = await simulateChatTurn("Pengajuan mana saja yang sudah selesai?", history);
  history.push({ role: "user", content: "Pengajuan mana saja yang sudah selesai?" });
  history.push({ role: "assistant", content: turn4.response });
  const test4Ok =
    turn4.response.toLowerCase().includes("selesai") &&
    (turn4.response.includes("3") || turn4.response.includes("SELESAI"));
  console.log(`Source: ${turn4.source}`);
  console.log(`Snippet:\n${turn4.response.split("\n").slice(0, 5).join("\n")}`);
  console.log(`Hasil: ${test4Ok ? "✅ LULUS" : "❌ GAGAL"}\n`);
  if (test4Ok) passedCount++;

  // UJI 5: "Apa saja yang masih diproses?"
  console.log("--- Uji 5: 'Apa saja yang masih diproses?' ---");
  const turn5 = await simulateChatTurn("Apa saja yang masih diproses?", history);
  history.push({ role: "user", content: "Apa saja yang masih diproses?" });
  history.push({ role: "assistant", content: turn5.response });
  const test5Ok =
    turn5.response.toLowerCase().includes("diproses") ||
    turn5.response.toLowerCase().includes("sedang diproses");
  console.log(`Source: ${turn5.source}`);
  console.log(`Snippet:\n${turn5.response.split("\n").slice(0, 5).join("\n")}`);
  console.log(`Hasil: ${test5Ok ? "✅ LULUS" : "❌ GAGAL"}\n`);
  if (test5Ok) passedCount++;

  // UJI 6: "Sebutkan pengajuan yang menunggu pengesahan Kepala Desa."
  console.log("--- Uji 6: 'Sebutkan pengajuan yang menunggu pengesahan Kepala Desa.' ---");
  const turn6 = await simulateChatTurn("Sebutkan pengajuan yang menunggu pengesahan Kepala Desa.", history);
  history.push({ role: "user", content: "Sebutkan pengajuan yang menunggu pengesahan Kepala Desa." });
  history.push({ role: "assistant", content: turn6.response });
  const test6Ok =
    turn6.response.toLowerCase().includes("pengesahan") ||
    turn6.response.toLowerCase().includes("kepala desa") ||
    turn6.response.includes("MENUNGGU_APPROVAL_KEPALA_DESA");
  console.log(`Source: ${turn6.source}`);
  console.log(`Snippet:\n${turn6.response.split("\n").slice(0, 5).join("\n")}`);
  console.log(`Hasil: ${test6Ok ? "✅ LULUS" : "❌ GAGAL"}\n`);
  if (test6Ok) passedCount++;

  // UJI 7: "Tampilkan detail salah satu pengajuan."
  console.log("--- Uji 7: 'Tampilkan detail salah satu pengajuan.' ---");
  const turn7 = await simulateChatTurn("Tampilkan detail salah satu pengajuan.", history);
  history.push({ role: "user", content: "Tampilkan detail salah satu pengajuan." });
  history.push({ role: "assistant", content: turn7.response });
  const test7Ok =
    turn7.response.toLowerCase().includes("rincian detail pengajuan") &&
    turn7.response.includes("No. Registrasi") &&
    turn7.response.includes("NIK Pemohon");
  console.log(`Source: ${turn7.source}`);
  console.log(`Snippet:\n${turn7.response.split("\n").slice(0, 7).join("\n")}`);
  console.log(`Hasil: ${test7Ok ? "✅ LULUS" : "❌ GAGAL"}\n`);
  if (test7Ok) passedCount++;

  console.log("================================================================");
  console.log(`HASIL AKHIR: ${passedCount}/${totalTests} UJIAN LULUS`);
  console.log("================================================================\n");

  if (passedCount === totalTests) {
    console.log("🎉 SEMUA 7 SKENARIO PENGAJUAN FOLLOW-UP LULUS SEMPURNA!");
  } else {
    console.log("⚠️ ADA SKENARIO YANG GAGAL. SILAKAN PERIKSA KEMBALI.");
  }

  await prisma.$disconnect();
}

runPengajuanConversations().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});

