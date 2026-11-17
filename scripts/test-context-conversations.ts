/**
 * Test script: verifikasi 10 alur percakapan wajib context-aware chatbot
 * Jalankan: npx.cmd tsx scripts/test-context-conversations.ts
 */

import prisma from "../src/lib/prisma";
import { resolveContextualQuestion } from "../src/lib/chatbot/context-resolver";
import { detectQuestionIntent } from "../src/lib/chatbot/intents";
import { formatStatisticAnswer } from "../src/lib/chatbot/answers";
import { getActualUserStats, getActualPelayananStats } from "../src/lib/chatbot/stats";
import { getSessionState, updateSessionState, clearSessionState, ConversationState } from "../src/lib/chatbot/memory";

async function runConversations() {
  console.log("====================================================");
  console.log("   TEST CONTEXT-AWARE CHATBOT — 10 Pertanyaan Wajib");
  console.log("====================================================\n");

  // Cari user supervisor aktual di DB untuk simulasi login
  const supervisorUser = await prisma.user.findFirst({
    where: { role: "SUPERVISOR" },
    select: { id: true, nama: true, email: true, role: true },
  });

  if (!supervisorUser) {
    throw new Error("User SUPERVISOR tidak ditemukan di database!");
  }

  const userId = supervisorUser.id;
  const role = "SUPERVISOR";
  const sessionKey = `test-supervisor:${userId}`;
  clearSessionState(sessionKey);

  let passedCount = 0;
  const totalTests = 10;

  // Pipeline helper yang mensimulasikan alur POST di route.ts
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

      // Session state update (sesuai route.ts)
      if (["JUMLAH_WARGA", "WARGA_AKTIF", "WARGA_PINDAH"].includes(intentResult.intent)) {
        updateSessionState(sessionKey, { entity: "WARGA", lastIntent: intentResult.intent, lastQuery: query });
      } else if (intentResult.intent === "JUMLAH_STAF") {
        updateSessionState(sessionKey, { entity: "STAF", lastIntent: "JUMLAH_STAF", lastQuery: query });
      } else if (intentResult.intent === "JUMLAH_KADES") {
        updateSessionState(sessionKey, { entity: "KADES", lastIntent: "JUMLAH_KADES", lastQuery: query });
      } else if (
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

  const conversationHistory: Array<{ role: string; content: string }> = [];

  // UJI 1: "Ada berapa jumlah warga?"
  console.log("--- Uji 1: 'Ada berapa jumlah warga?' ---");
  const turn1 = await simulateChatTurn("Ada berapa jumlah warga?", conversationHistory);
  conversationHistory.push({ role: "user", content: "Ada berapa jumlah warga?" });
  conversationHistory.push({ role: "assistant", content: turn1.response });
  const test1Ok = turn1.response.includes("7") && turn1.state.entity === "WARGA";
  console.log(`State Entity: ${turn1.state.entity}`);
  console.log(`Jawaban Snippet: ${turn1.response.split("\n")[0]}`);
  console.log(`Hasil: ${test1Ok ? "✅ LULUS" : "❌ GAGAL"}\n`);
  if (test1Ok) passedCount++;

  // UJI 2: "Siapa saja?" (pertanyaan lanjutan dari jumlah warga)
  console.log("--- Uji 2: 'Siapa saja?' (Follow-up Warga) ---");
  const turn2 = await simulateChatTurn("Siapa saja?", conversationHistory);
  conversationHistory.push({ role: "user", content: "Siapa saja?" });
  conversationHistory.push({ role: "assistant", content: turn2.response });
  const test2Ok =
    turn2.response.toLowerCase().includes("daftar") &&
    turn2.response.toLowerCase().includes("warga");
  console.log(`State Entity: ${turn2.state.entity}`);
  console.log(`Jawaban Snippet: ${turn2.response.split("\n")[0]}`);
  console.log(`Hasil: ${test2Ok ? "✅ LULUS" : "❌ GAGAL"}\n`);
  if (test2Ok) passedCount++;

  // UJI 3: "Sebutkan nama mereka." (pertanyaan lanjutan kedua warga)
  console.log("--- Uji 3: 'Sebutkan nama mereka.' (Follow-up Warga 2) ---");
  const turn3 = await simulateChatTurn("Sebutkan nama mereka.", conversationHistory);
  conversationHistory.push({ role: "user", content: "Sebutkan nama mereka." });
  conversationHistory.push({ role: "assistant", content: turn3.response });
  const test3Ok =
    turn3.response.toLowerCase().includes("daftar") &&
    turn3.response.toLowerCase().includes("warga");
  console.log(`Jawaban Snippet: ${turn3.response.split("\n")[0]}`);
  console.log(`Hasil: ${test3Ok ? "✅ LULUS" : "❌ GAGAL"}\n`);
  if (test3Ok) passedCount++;

  // UJI 4: "Siapa saya?"
  console.log("--- Uji 4: 'Siapa saya?' (Identitas Pengguna Login) ---");
  const turn4 = await simulateChatTurn("Siapa saya?", conversationHistory);
  conversationHistory.push({ role: "user", content: "Siapa saya?" });
  conversationHistory.push({ role: "assistant", content: turn4.response });
  const test4Ok =
    (turn4.response.includes(supervisorUser.nama || "") || turn4.response.includes(supervisorUser.email || "")) &&
    turn4.response.includes("SUPERVISOR");
  console.log(`Jawaban Snippet: ${turn4.response.split("\n")[0]}`);
  console.log(`Hasil: ${test4Ok ? "✅ LULUS" : "❌ GAGAL"}\n`);
  if (test4Ok) passedCount++;

  // UJI 5: "Saya login sebagai apa?"
  console.log("--- Uji 5: 'Saya login sebagai apa?' ---");
  const turn5 = await simulateChatTurn("Saya login sebagai apa?", conversationHistory);
  conversationHistory.push({ role: "user", content: "Saya login sebagai apa?" });
  conversationHistory.push({ role: "assistant", content: turn5.response });
  const test5Ok = turn5.response.includes("SUPERVISOR") || turn5.response.includes("Supervisor");
  console.log(`Jawaban Snippet: ${turn5.response.split("\n")[0]}`);
  console.log(`Hasil: ${test5Ok ? "✅ LULUS" : "❌ GAGAL"}\n`);
  if (test5Ok) passedCount++;

  // UJI 6: "Ada berapa staf?"
  console.log("--- Uji 6: 'Ada berapa staf?' ---");
  const turn6 = await simulateChatTurn("Ada berapa staf?", conversationHistory);
  conversationHistory.push({ role: "user", content: "Ada berapa staf?" });
  conversationHistory.push({ role: "assistant", content: turn6.response });
  const test6Ok = turn6.response.includes("2") && turn6.state.entity === "STAF";
  console.log(`State Entity: ${turn6.state.entity}`);
  console.log(`Jawaban Snippet: ${turn6.response.split("\n")[0]}`);
  console.log(`Hasil: ${test6Ok ? "✅ LULUS" : "❌ GAGAL"}\n`);
  if (test6Ok) passedCount++;

  // UJI 7: "Siapa saja stafnya?"
  console.log("--- Uji 7: 'Siapa saja stafnya?' (Follow-up Staf) ---");
  const turn7 = await simulateChatTurn("Siapa saja stafnya?", conversationHistory);
  conversationHistory.push({ role: "user", content: "Siapa saja stafnya?" });
  conversationHistory.push({ role: "assistant", content: turn7.response });
  const test7Ok = turn7.response.includes("Staf") && turn7.response.includes("Daftar");
  console.log(`State Entity: ${turn7.state.entity}`);
  console.log(`Jawaban Snippet: ${turn7.response.split("\n")[0]}`);
  console.log(`Hasil: ${test7Ok ? "✅ LULUS" : "❌ GAGAL"}\n`);
  if (test7Ok) passedCount++;

  // UJI 8: "Siapa Kepala Desa?"
  console.log("--- Uji 8: 'Siapa Kepala Desa?' ---");
  const turn8 = await simulateChatTurn("Siapa Kepala Desa?", conversationHistory);
  conversationHistory.push({ role: "user", content: "Siapa Kepala Desa?" });
  conversationHistory.push({ role: "assistant", content: turn8.response });
  const test8Ok = turn8.response.includes("Kepala Desa");
  console.log(`State Entity: ${turn8.state.entity}`);
  console.log(`Jawaban Snippet: ${turn8.response.split("\n")[0]}`);
  console.log(`Hasil: ${test8Ok ? "✅ LULUS" : "❌ GAGAL"}\n`);
  if (test8Ok) passedCount++;

  // UJI 9: "Ada berapa pengajuan?"
  console.log("--- Uji 9: 'Ada berapa pengajuan?' ---");
  const turn9 = await simulateChatTurn("Ada berapa pengajuan?", conversationHistory);
  conversationHistory.push({ role: "user", content: "Ada berapa pengajuan?" });
  conversationHistory.push({ role: "assistant", content: turn9.response });
  const test9Ok = turn9.response.includes("12") && turn9.state.entity === "PENGAJUAN";
  console.log(`State Entity: ${turn9.state.entity}`);
  console.log(`Jawaban Snippet: ${turn9.response.split("\n")[0]}`);
  console.log(`Hasil: ${test9Ok ? "✅ LULUS" : "❌ GAGAL"}\n`);
  if (test9Ok) passedCount++;

  // UJI 10: "Sebutkan daftar pengajuannya." (Follow-up Pengajuan)
  console.log("--- Uji 10: 'Sebutkan daftar pengajuannya.' (Follow-up Pengajuan) ---");
  const turn10 = await simulateChatTurn("Sebutkan daftar pengajuannya.", conversationHistory);
  conversationHistory.push({ role: "user", content: "Sebutkan daftar pengajuannya." });
  conversationHistory.push({ role: "assistant", content: turn10.response });
  const test10Ok = turn10.response.includes("pengajuan") && turn10.response.includes("No. Registrasi");
  console.log(`State Entity: ${turn10.state.entity}`);
  console.log(`Jawaban Snippet: ${turn10.response.split("\n")[0]}`);
  console.log(`Hasil: ${test10Ok ? "✅ LULUS" : "❌ GAGAL"}\n`);
  if (test10Ok) passedCount++;

  console.log("====================================================");
  console.log(`HASIL AKHIR: ${passedCount}/${totalTests} UJIAN LULUS`);
  console.log("====================================================");

  if (passedCount === totalTests) {
    console.log("🎉 SEMUA 10 SKENARIO PERCAKAPAN LULUS SEMPURNA!");
  } else {
    console.log("⚠️ ADA SKENARIO YANG GAGAL. SILAKAN PERIKSA KEMBALI.");
  }

  // UJI VARIASI KHUSUS KATA PENDEK (Permintaan Pengguna)
  console.log("\n====================================================");
  console.log("   UJI VARIASI PERTANYAAN PENDEK (Follow-up Warga)");
  console.log("====================================================");
  const variasiPendek = [
    "Siapa?",
    "Namanya siapa?",
    "Bisa disebutkan?",
    "Sebutkan namanya.",
    "Yang mana saja?",
    "Tampilkan daftarnya.",
  ];

  for (const v of variasiPendek) {
    // Set entity ke WARGA
    updateSessionState(sessionKey, { entity: "WARGA" });
    const res = await simulateChatTurn(v, []);
    const ok = res.response.toLowerCase().includes("warga") || res.response.toLowerCase().includes("daftar");
    console.log(`Variasi: "${v.padEnd(25)}" -> ${ok ? "✅ LULUS" : "❌ GAGAL"}`);
  }

  await prisma.$disconnect();
}

runConversations().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
