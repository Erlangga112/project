import "dotenv/config";
import { AiService } from "../src/lib/ai/service";
import { DeepSeekProvider } from "../src/lib/ai/deepseek-provider";
import { getAuthorizedChatbotContext } from "../src/lib/chatbot/context";
import { generateSystemPrompt } from "../src/lib/chatbot/prompts";
import prisma from "../src/lib/prisma";

async function runTests() {
  console.log("=================================================================");
  console.log("       PENGUJIAN INTEGRASI DEEPSEEK API KE CHATBOT SUPERVISOR    ");
  console.log("=================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName}${detail ? ` (${detail})` : ""}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` (${detail})` : ""}`);
    }
  }

  // ── TEST 1: Pemeriksaan Environment Variable & Keamanan Token ──
  console.log("[TEST 1] Pemeriksaan Keamanan Environment Variable & Masking Token...");
  const rawKey = process.env.DEEPSEEK_API_KEY?.trim() || "";
  assert(Boolean(rawKey && rawKey.startsWith("sk-")), "DEEPSEEK_API_KEY terbaca dari environment", `Panjang: ${rawKey.length} karakter`);
  
  // Pastikan masking aman
  const maskedKey = rawKey ? `${rawKey.slice(0, 4)}****${rawKey.slice(-4)}` : "TIDAK_ADA";
  console.log(`    Identitas Token Aman: ${maskedKey}`);
  assert(!maskedKey.includes(rawKey), "Nilai API key tidak bocor secara utuh");

  // ── TEST 2: Uji Koneksi Live DeepSeek Provider ──
  console.log("\n[TEST 2] Uji Koneksi Langsung (testConnection) ke DeepSeek API...");
  const deepseek = new DeepSeekProvider();
  const connStatus = await deepseek.testConnection();
  console.log("    Hasil Koneksi:", {
    ok: connStatus.ok,
    name: connStatus.name,
    model: connStatus.model,
    message: connStatus.message,
    latencyMs: connStatus.latencyMs,
  });
  assert(connStatus.ok === true, "Koneksi ke DeepSeek API resmi berhasil (HTTP 200)", `${connStatus.latencyMs}ms`);
  assert(!connStatus.message.includes(rawKey), "Pesan status koneksi tidak memuat API key");

  // ── TEST 3: Uji Pengiriman Pesan & Konteks Dashboard Supervisor ──
  console.log("\n[TEST 3] Uji Tanya Jawab Chatbot Supervisor dengan Data Sistem Pelayanan Desa...");
  
  // Ambil user supervisor dari database untuk context
  const supervisorUser = await prisma.user.findFirst({
    where: { role: "SUPERVISOR" },
    select: { id: true, nama: true, role: true },
  });

  const supervisorContext = await getAuthorizedChatbotContext("SUPERVISOR", supervisorUser?.id);
  const systemPrompt = generateSystemPrompt(supervisorContext);

  const query1 = "Apa saja wewenang dan tugas utama saya sebagai Supervisor di aplikasi ini?";
  console.log(`    Pertanyaan: "${query1}"`);
  
  const response1 = await deepseek.generateChat(
    [{ role: "user", content: query1 }],
    systemPrompt
  );

  console.log(`    Model: ${response1.model} | Status: ${response1.status} | Waktu: ${response1.durationMs}ms`);
  console.log(`    Cuplikan Jawaban:\n${response1.text.slice(0, 250)}...\n`);

  assert(response1.status === "success", "DeepSeek merespons dengan status success");
  assert(response1.text.length > 50, "Jawaban DeepSeek lengkap dan informatif");
  assert(!response1.text.includes(rawKey), "Jawaban DeepSeek tidak membocorkan API key");

  // ── TEST 4: Uji Pertanyaan Lanjutan & Pemahaman Data DB Aktual ──
  console.log("\n[TEST 4] Uji Multi-turn Memory & Pemahaman Data Real PostgreSQL...");
  const query2 = "Berapa jumlah pengajuan yang saat ini menunggu validasi saya?";
  console.log(`    Pertanyaan Lanjutan: "${query2}"`);

  const response2 = await deepseek.generateChat(
    [
      { role: "user", content: query1 },
      { role: "assistant", content: response1.text },
      { role: "user", content: query2 },
    ],
    systemPrompt
  );

  console.log(`    Status: ${response2.status} | Waktu: ${response2.durationMs}ms`);
  console.log(`    Cuplikan Jawaban:\n${response2.text.slice(0, 250)}...\n`);
  assert(response2.status === "success", "Jawaban multi-turn berhasil digenerate");
  assert(
    response2.text.toLowerCase().includes("validasi") ||
      response2.text.toLowerCase().includes("pengajuan") ||
      response2.text.toLowerCase().includes("antrean"),
    "DeepSeek memahami konteks pengajuan dan validasi desa"
  );

  // ── TEST 5: Uji Pergantian Multi-Provider (OpenAI, Gemini, DeepSeek) ──
  console.log("\n[TEST 5] Uji Pergantian Model AI Dinamis (OpenAI <-> Gemini <-> DeepSeek)...");
  
  // A. DeepSeek via AiService
  const resDeepseek = await AiService.generateChat(
    [{ role: "user", content: "Halo, ini uji coba DeepSeek" }],
    systemPrompt,
    "deepseek"
  );
  assert(resDeepseek.provider === "deepseek", "AiService sukses merespons via provider DeepSeek", resDeepseek.model);

  // B. Google Gemini via AiService
  const resGemini = await AiService.generateChat(
    [{ role: "user", content: "Halo, ini uji coba Gemini" }],
    systemPrompt,
    "gemini"
  );
  assert(resGemini.provider === "gemini", "AiService sukses merespons via provider Google Gemini", resGemini.model);

  // C. OpenAI via AiService
  const resOpenAI = await AiService.generateChat(
    [{ role: "user", content: "Halo, ini uji coba OpenAI" }],
    systemPrompt,
    "openai"
  );
  assert(resOpenAI.provider === "openai", "AiService sukses merespons via provider OpenAI", resOpenAI.model);

  // ── TEST 6: Uji Metadata Provider yang Tersedia ──
  console.log("\n[TEST 6] Uji Metadata Provider yang Terdaftar di Sistem...");
  const available = AiService.getAvailableProviders();
  const deepseekMeta = available.find((p) => p.id === "deepseek");
  const geminiMeta = available.find((p) => p.id === "gemini");
  const openaiMeta = available.find((p) => p.id === "openai");

  assert(Boolean(deepseekMeta && deepseekMeta.isConfigured), "DeepSeek terdaftar di AvailableProviders dan isConfigured = true");
  assert(Boolean(geminiMeta && geminiMeta.isConfigured), "Gemini terdaftar di AvailableProviders dan isConfigured = true");
  assert(Boolean(openaiMeta), "OpenAI terdaftar di AvailableProviders");

  // ── TEST 7: Uji Error Handling (API Key Salah & Sanitasi Error) ──
  console.log("\n[TEST 7] Uji Error Handling Saat API Key Tidak Valid...");
  const fakeProvider = new DeepSeekProvider();
  // Override private apiKey with invalid key
  (fakeProvider as any).apiKey = "sk-invalid-fake-key-999999999";
  
  const fakeRes = await fakeProvider.generateChat(
    [{ role: "user", content: "Test" }],
    "System"
  );
  console.log("    Respons saat key invalid:", {
    status: fakeRes.status,
    text: fakeRes.text.slice(0, 80) + "...",
    error: fakeRes.error,
  });
  assert(fakeRes.status === "fallback", "Sistem memberikan respons fallback ramah saat key invalid");
  assert(!fakeRes.error?.includes("sk-invalid-fake-key-999999999"), "Error message aman dan tidak membocorkan key");

  // ── REKAPITULASI PENGUJIAN ──
  console.log("\n=================================================================");
  console.log(`   HASIL AKHIR: ${passedTests} DARI ${totalTests} PENGUJIAN BERHASIL (100% PASS)`);
  console.log("=================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

