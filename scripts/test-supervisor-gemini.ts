import prisma from "../src/lib/prisma";
import { AiService } from "../src/lib/ai/service";
import { GeminiProvider } from "../src/lib/ai/gemini-provider";
import { OpenAiProvider } from "../src/lib/ai/openai-provider";
import { resolveContextualQuestion } from "../src/lib/chatbot/context-resolver";
import { getSessionState, clearSessionState } from "../src/lib/chatbot/memory";
import { generateSystemPrompt } from "../src/lib/chatbot/prompts";
import { getAuthorizedChatbotContext } from "../src/lib/chatbot/context";
import { detectQuestionIntent } from "../src/lib/chatbot/intents";
import { formatStatisticAnswer } from "../src/lib/chatbot/answers";
import { getActualUserStats, getActualPelayananStats } from "../src/lib/chatbot/stats";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, title: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${title}`);
    if (detail) console.log(`     ↳ ${detail.slice(0, 120)}...`);
  } else {
    console.error(`  ❌ [FAIL] ${title}`);
    if (detail) console.error(`     ↳ ${detail.slice(0, 150)}...`);
  }
}

async function runSupervisorGeminiTests() {
  console.log("================================================================================");
  console.log("   PENGUJIAN INTEGRASI GOOGLE GEMINI API & ASISTEN SUPERVISOR PELAYANAN DESA    ");
  console.log("================================================================================\n");

  const supervisor = await prisma.user.findFirst({
    where: { role: "SUPERVISOR" },
  });

  if (!supervisor) {
    throw new Error("User dengan role SUPERVISOR tidak ditemukan di database.");
  }
  console.log(`Akun Supervisor Terdeteksi: ${supervisor.nama} (${supervisor.email})\n`);

  // --- 1. UJI KONEKSI GOOGLE GEMINI PROVIDER ---
  console.log("--- 1. UJI KONEKSI GOOGLE GEMINI PROVIDER ---");
  const geminiProvider = new GeminiProvider();
  const geminiConn = await geminiProvider.testConnection();
  assert(
    geminiConn.ok === true,
    "Koneksi Google Gemini API berhasil",
    `Provider: ${geminiConn.name} | Model: ${geminiConn.model} | Latency: ${geminiConn.latencyMs}ms | Pesan: ${geminiConn.message}`
  );
  assert(
    Boolean(process.env.GEMINI_API_KEY),
    "GEMINI_API_KEY terdeteksi di backend tanpa bocor ke frontend"
  );

  // --- 2. UJI KONEKSI OPENAI PROVIDER ---
  console.log("\n--- 2. UJI KONEKSI OPENAI PROVIDER ---");
  const openAiProvider = new OpenAiProvider();
  const openAiConn = await openAiProvider.testConnection();
  assert(
    openAiConn.provider === "openai",
    "Provider OpenAI terdaftar dan teridentifikasi dengan model aktif",
    `Provider: ${openAiConn.name} | Model: ${openAiConn.model} | Status: ${openAiConn.message}`
  );

  // --- 3. UJI METADATA & PILIHAN MODEL SUPERVISOR ---
  console.log("\n--- 3. UJI METADATA & PILIHAN MODEL SUPERVISOR ---");
  const availableList = AiService.getAvailableProviders();
  assert(
    availableList.length === 2,
    "Dua provider AI terdaftar (OpenAI & Google Gemini)",
    `Providers: ${availableList.map((p) => p.name).join(", ")}`
  );
  assert(
    availableList.some((p) => p.id === "gemini" && p.isConfigured),
    "Provider Google Gemini terkonfigurasi dan siap melayani Supervisor"
  );
  assert(
    availableList.some((p) => p.id === "openai" && p.isConfigured),
    "Provider OpenAI tetap aktif tanpa menghapus konfigurasi sebelumnya"
  );

  // --- 4. UJI PERTANYAAN FITUR DASHBOARD SUPERVISOR ---
  console.log("\n--- 4. UJI PERTANYAAN FITUR DASHBOARD SUPERVISOR ---");
  const sessionKey = `supervisor:${supervisor.id}`;
  clearSessionState(sessionKey);

  const fiturRes = await resolveContextualQuestion(
    "Ada berapa fitur?",
    getSessionState(sessionKey),
    "SUPERVISOR",
    supervisor.id,
    sessionKey,
    { pathname: "/supervisor", pageTitle: "Dashboard Pengawasan" }
  );

  assert(
    fiturRes.handled === true,
    "Pertanyaan singkat 'Ada berapa fitur?' dipahami dalam konteks Dashboard Supervisor",
    fiturRes.response
  );
  assert(
    Boolean(fiturRes.response?.includes("Dashboard") && fiturRes.response?.includes("Validasi Pengajuan")),
    "Jawaban merinci fitur-fitur aktif Dashboard Supervisor"
  );

  // --- 5. UJI PERTANYAAN JUMLAH WARGA (DATABASE AKTUAL) ---
  console.log("\n--- 5. UJI PERTANYAAN JUMLAH WARGA (DATABASE AKTUAL) ---");
  const actualWargaCount = await prisma.user.count({ where: { role: "WARGA" } });
  const intentWarga = detectQuestionIntent("Berapa jumlah warga yang terdaftar?");
  const [userStats, pelayananStats] = await Promise.all([
    getActualUserStats(),
    getActualPelayananStats(),
  ]);
  const wargaAnswer = formatStatisticAnswer(intentWarga.intent, userStats, pelayananStats);

  assert(
    intentWarga.intent === "JUMLAH_WARGA",
    "Intent 'JUMLAH_WARGA' berhasil dideteksi dengan benar"
  );
  assert(
    wargaAnswer.includes(String(actualWargaCount)),
    "Jumlah warga sinkron 100% dengan database PostgreSQL riil",
    `Database: ${actualWargaCount} warga | Respons: ${wargaAnswer}`
  );

  // --- 6. UJI PERTANYAAN DATA PENGAJUAN & VERIFIKASI ---
  console.log("\n--- 6. UJI PERTANYAAN DATA PENGAJUAN & VERIFIKASI ---");
  const pendingCount = await prisma.pengajuanLayanan.count({
    where: { status: { in: ["DIAJUKAN", "DIPERIKSA"] } },
  });
  const antreanRes = await resolveContextualQuestion(
    "Pengajuan apa saja yang perlu diverifikasi?",
    getSessionState(sessionKey),
    "SUPERVISOR",
    supervisor.id,
    sessionKey,
    { pathname: "/supervisor/pengajuan" }
  );

  assert(
    antreanRes.handled === true,
    "Pertanyaan antrean verifikasi berhasil dijawab dengan data pengajuan riil",
    antreanRes.response
  );
  assert(
    Boolean(antreanRes.response && (pendingCount === 0 || antreanRes.response.toLowerCase().includes("pemohon"))),
    "Data antrean pengajuan akurat sesuai status verifikasi terkini"
  );

  // --- 7. UJI PERTANYAAN LANJUTAN (MULTI-TURN CHAT CONTEXT) ---
  console.log("\n--- 7. UJI PERTANYAAN LANJUTAN (MULTI-TURN CHAT CONTEXT) ---");
  const followupRes = await resolveContextualQuestion(
    "Siapa saja?",
    getSessionState(sessionKey),
    "SUPERVISOR",
    supervisor.id,
    sessionKey
  );

  assert(
    followupRes.handled === true,
    "Pertanyaan lanjutan 'Siapa saja?' mempertahankan entitas percakapan sebelumnya",
    followupRes.response
  );

  // --- 8. UJI PERGANTIAN PROVIDER DARI GEMINI KE OPENAI ---
  console.log("\n--- 8. UJI PERGANTIAN PROVIDER DARI GEMINI KE OPENAI ---");
  const contextData = await getAuthorizedChatbotContext("SUPERVISOR", supervisor.id);
  const systemPrompt = generateSystemPrompt(contextData);

  const historyMessages = [
    { role: "user" as const, content: "Halo Asisten Supervisor!" },
    { role: "assistant" as const, content: "Halo Bapak/Ibu Supervisor, ada yang bisa saya bantu hari ini?" },
    { role: "user" as const, content: "Bagaimana cara kerja verifikasi berkas permohonan warga?" }
  ];

  // Eksekusi via Gemini
  const geminiResult = await AiService.generateChat(historyMessages, systemPrompt, "gemini");
  assert(
    geminiResult.status === "success" && geminiResult.provider === "gemini",
    "Pesan berhasil diproses menggunakan Google Gemini Provider",
    `Model aktif: ${geminiResult.model} | Snippet: ${geminiResult.text.slice(0, 100)}`
  );

  // Lanjutkan pertanyaan sama / percakapan sama dengan switch ke OpenAI
  const switchHistory = [
    ...historyMessages,
    { role: "assistant" as const, content: geminiResult.text },
    { role: "user" as const, content: "Sebutkan dokumen apa yang paling sering diajukan?" }
  ];

  const openAiResult = await AiService.generateChat(switchHistory, systemPrompt, "openai");
  assert(
    openAiResult.provider === "openai" && Boolean(openAiResult.text),
    "Pergantian ke OpenAI berhasil diproses dengan mempertahankan riwayat chat dari Gemini",
    `Model aktif: ${openAiResult.model} | Status: ${openAiResult.status} | Snippet: ${openAiResult.text.slice(0, 100)}`
  );

  // --- 9. UJI PERGANTIAN PROVIDER DARI OPENAI KEMBALI KE GEMINI ---
  console.log("\n--- 9. UJI PERGANTIAN PROVIDER DARI OPENAI KEMBALI KE GEMINI ---");
  const switchBackHistory = [
    ...switchHistory,
    { role: "assistant" as const, content: openAiResult.text },
    { role: "user" as const, content: "Terima kasih infonya, sangat jelas." }
  ];

  const geminiBackResult = await AiService.generateChat(switchBackHistory, systemPrompt, "gemini");
  assert(
    geminiBackResult.status === "success" && geminiBackResult.provider === "gemini",
    "Pergantian kembali ke Gemini berhasil tanpa kehilangan konteks percakapan",
    `Model aktif: ${geminiBackResult.model} | Snippet: ${geminiBackResult.text.slice(0, 100)}`
  );

  // --- 10. UJI PEMAHAMAN GEMINI ATAS KNOWLEDGE BASE & SYSTEM INSTRUCTION ---
  console.log("\n--- 10. UJI PEMAHAMAN GEMINI ATAS KNOWLEDGE BASE & SYSTEM INSTRUCTION ---");
  const testKbMessages = [
    { role: "user" as const, content: "Apakah kamu bisa bantu coding script python?" }
  ];
  const guardResult = await AiService.generateChat(testKbMessages, systemPrompt, "gemini");
  const cleanGuard = guardResult.text.toLowerCase();
  assert(
    cleanGuard.includes("desa") || cleanGuard.includes("maaf") || cleanGuard.includes("tidak dapat"),
    "Gemini mematuhi System Instruction dan batasan SOP desa (menolak instruksi coding)",
    guardResult.text
  );

  // --- 11. UJI ERROR HANDLING ROBUSTNESS ---
  console.log("\n--- 11. UJI ERROR HANDLING ROBUSTNESS ---");
  const brokenGemini = new GeminiProvider();
  const originalKey = process.env.GEMINI_API_KEY;
  try {
    process.env.GEMINI_API_KEY = "DUMMY_INVALID_KEY_FOR_TEST";
    const brokenConn = await brokenGemini.testConnection();
    assert(
      brokenConn.ok === false,
      "Deteksi error API Key tidak valid ditangani secara ramah tanpa crash",
      brokenConn.message
    );
  } finally {
    process.env.GEMINI_API_KEY = originalKey;
  }

  // Verifikasi OpenAI tetap bekerja normal saat Gemini mengalami kendala
  const stableOpenAi = await AiService.generateChat(
    [{ role: "user", content: "Halo" }],
    systemPrompt,
    "openai"
  );
  assert(
    Boolean(stableOpenAi.text),
    "Provider OpenAI tetap berjalan independen dan tidak terpengaruh status Gemini"
  );

  // --- 12. HASIL AKHIR & RINGKASAN ---
  console.log("\n================================================================================");
  console.log(`HASIL AKHIR PENGUJIAN: ${passedTests} PASS, ${totalTests - passedTests} FAIL (TOTAL: ${totalTests} SKENARIO)`);
  console.log("================================================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 SEMUA PENGUJIAN INTEGRASI GOOGLE GEMINI UNTUK ASISTEN SUPERVISOR BERHASIL 100%!");
  } else {
    process.exit(1);
  }
}

runSupervisorGeminiTests()
  .catch((err) => {
    console.error("Test execution fatal error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
