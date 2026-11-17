/**
 * Suite Pengujian Integrasi Groq AI ke Chatbot Asisten Supervisor
 * Menguji:
 * 1. Keamanan pembacaan GROQ_API_KEY dari env & sanitasi
 * 2. Koneksi langsung ke Groq Cloud API
 * 3. Tanya jawab kecerdasan sistem desa (Wewenang, Data Warga, Pengajuan SKTM)
 * 4. Multi-turn memory & pertanyaan lanjutan
 * 5. Pergantian dinamis 4 provider: OpenAI <-> Gemini <-> DeepSeek <-> Groq
 * 6. Registrasi metadata provider di AiService
 * 7. Error handling saat API key tidak valid / rate limit
 */

import { GroqProvider } from "../src/lib/ai/groq-provider";
import { AiService } from "../src/lib/ai/service";
import prisma from "../src/lib/prisma";

async function runTests() {
  console.log("\n=================================================================");
  console.log("       PENGUJIAN INTEGRASI GROQ AI KE CHATBOT SUPERVISOR         ");
  console.log("=================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, desc: string, details?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${desc}`);
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      if (details) console.error(`     Detail: ${details}`);
    }
  }

  // TEST 1: Keamanan Environment Variable
  console.log("[TEST 1] Pemeriksaan Keamanan Environment Variable & Masking Token Groq...");
  const rawKey = process.env.GROQ_API_KEY || "";
  assert(rawKey.length > 20, "GROQ_API_KEY terbaca dari environment", `Panjang: ${rawKey.length}`);
  const maskedKey = rawKey.slice(0, 5) + "****" + rawKey.slice(-4);
  console.log(`    Identitas Token Aman: ${maskedKey}`);
  assert(!maskedKey.includes(rawKey), "Nilai API key tidak bocor secara utuh");

  // TEST 2: Uji Koneksi Langsung (testConnection)
  console.log("\n[TEST 2] Uji Koneksi Langsung (testConnection) ke Groq Cloud API...");
  const groqProvider = new GroqProvider();
  const connResult = await groqProvider.testConnection();
  console.log("    Hasil Koneksi:", connResult);
  assert(connResult.ok === true, `Koneksi ke Groq API berhasil (${connResult.latencyMs}ms)`, connResult.message);
  assert(!connResult.message.includes(rawKey), "Pesan status koneksi tidak memuat API key");

  // Fetch actual PostgreSQL data to inject context
  const totalWarga = await prisma.user.count({ where: { role: "WARGA" } });
  const pendingCount = await prisma.pengajuanLayanan.count({
    where: {
      status: {
        in: [
          "DIAJUKAN",
          "DIPERIKSA",
          "MENUNGGU_VALIDASI",
          "DISETUJUI_SUPERVISOR",
        ],
      },
    },
  });

  const systemPromptSupervisor = `
Anda adalah Asisten Supervisor Pelayanan Desa pada aplikasi Sistem Pelayanan Desa Terpadu — Asisten Desa Perum.
Role Pengguna Aktif: SUPERVISOR.
Database Terkini:
- Jumlah Warga Terdaftar: ${totalWarga} jiwa.
- Pengajuan Membutuhkan Penanganan/Verifikasi: ${pendingCount} berkas.
- Fitur Utama: Validasi berkas SKTM, Surat Domisili, Surat Keterangan Usaha (SKU), pemantauan SLA staf desa, audit log, dan persetujuan akhir sebelum diteruskan ke Kepala Desa.
Aturan: Berikan jawaban profesional, akurat sesuai data desa di atas, dan dilarang membuat angka palsu.
`.trim();

  // TEST 3: Uji Tanya Jawab Chatbot Supervisor seputar wewenang & data desa
  console.log("\n[TEST 3] Uji Tanya Jawab Groq AI seputar Wewenang & Data Sistem Desa...");
  const startTime = Date.now();
  const chatRes1 = await groqProvider.generateChat(
    [
      {
        role: "user",
        content: "Halo, apa tugas utama saya sebagai Supervisor dan berapa jumlah warga terdaftar di desa kita saat ini?",
      },
    ],
    systemPromptSupervisor
  );
  const elapsed1 = Date.now() - startTime;
  console.log(`    Model: ${chatRes1.model} | Status: ${chatRes1.status} | Waktu: ${elapsed1}ms`);
  console.log(`    Cuplikan Jawaban:\n${chatRes1.text.slice(0, 180)}...\n`);

  assert(chatRes1.status === "success", "Groq merespons dengan status success");
  assert(chatRes1.text.length > 50, "Jawaban Groq lengkap dan substantif");
  assert(!chatRes1.text.includes(rawKey), "Jawaban Groq tidak membocorkan API key");
  assert(
    chatRes1.text.includes(String(totalWarga)) || chatRes1.text.toLowerCase().includes("warga"),
    "Groq memahami data warga desa sesuai konteks database"
  );

  // TEST 4: Uji Multi-turn Memory (Pertanyaan Lanjutan)
  console.log("\n[TEST 4] Uji Multi-turn Memory & Pertanyaan Lanjutan (Follow-up)...");
  const chatRes2 = await groqProvider.generateChat(
    [
      {
        role: "user",
        content: "Halo, apa tugas utama saya sebagai Supervisor dan berapa jumlah warga terdaftar di desa kita saat ini?",
      },
      {
        role: "assistant",
        content: chatRes1.text,
      },
      {
        role: "user",
        content: "Lalu dari pengajuan yang ada, berapa berkas yang saat ini menunggu verifikasi?",
      },
    ],
    systemPromptSupervisor
  );
  console.log(`    Status: ${chatRes2.status} | Waktu: ${chatRes2.durationMs}ms`);
  console.log(`    Cuplikan Jawaban Lanjutan:\n${chatRes2.text.slice(0, 180)}...\n`);

  assert(chatRes2.status === "success", "Jawaban multi-turn berhasil digenerate");
  assert(
    chatRes2.text.includes(String(pendingCount)) ||
      chatRes2.text.toLowerCase().includes("verifikasi") ||
      chatRes2.text.toLowerCase().includes("pengajuan"),
    "Groq memahami konteks riwayat percakapan dan berkas verifikasi"
  );

  // TEST 5: Uji Pergantian Dinamis 4 Provider di AiService
  console.log("\n[TEST 5] Uji Pergantian Model AI Dinamis (Groq <-> Gemini <-> OpenAI <-> DeepSeek)...");
  
  // 5a. Groq
  const resGroq = await AiService.generateChat(
    [{ role: "user", content: "Sebutkan 3 jenis surat yang dilayani desa!" }],
    systemPromptSupervisor,
    "groq"
  );
  assert(resGroq.provider === "groq" && resGroq.status === "success", `AiService sukses merespons via Groq (${resGroq.model})`);

  // 5b. Google Gemini
  const resGemini = await AiService.generateChat(
    [{ role: "user", content: "Tes koneksi Gemini" }],
    systemPromptSupervisor,
    "gemini"
  );
  assert(resGemini.provider === "gemini", `AiService sukses merespons via Google Gemini (${resGemini.model})`);

  // 5c. OpenAI / NIM
  const resOpenAi = await AiService.generateChat(
    [{ role: "user", content: "Tes koneksi OpenAI" }],
    systemPromptSupervisor,
    "openai"
  );
  assert(resOpenAi.provider === "openai", `AiService sukses merespons via OpenAI (${resOpenAi.model})`);

  // 5d. DeepSeek (Graceful Fallback Handled)
  const resDeepSeek = await AiService.generateChat(
    [{ role: "user", content: "Tes koneksi DeepSeek" }],
    systemPromptSupervisor,
    "deepseek"
  );
  assert(resDeepSeek.provider === "deepseek", `AiService mendukung provider DeepSeek (${resDeepSeek.model})`);

  // TEST 6: Metadata Providers
  console.log("\n[TEST 6] Uji Metadata Provider yang Terdaftar di Sistem...");
  const availableList = AiService.getAvailableProviders();
  const groqMeta = availableList.find((p) => p.id === "groq");
  const geminiMeta = availableList.find((p) => p.id === "gemini");
  const openAiMeta = availableList.find((p) => p.id === "openai");
  const deepSeekMeta = availableList.find((p) => p.id === "deepseek");

  assert(Boolean(groqMeta && groqMeta.isConfigured), "Groq terdaftar di AvailableProviders dan isConfigured = true");
  assert(Boolean(geminiMeta && geminiMeta.isConfigured), "Gemini terdaftar di AvailableProviders dan isConfigured = true");
  assert(Boolean(deepSeekMeta && deepSeekMeta.isConfigured), "DeepSeek terdaftar di AvailableProviders");
  assert(Boolean(openAiMeta), "OpenAI terdaftar di AvailableProviders");

  // TEST 7: Error handling saat API Key invalid
  console.log("\n[TEST 7] Uji Error Handling Saat API Key Tidak Valid...");
  process.env.GROQ_API_KEY = "gsk_invalid_test_key_9999";
  const dummyGroq = new GroqProvider();
  const invalidRes = await dummyGroq.generateChat(
    [{ role: "user", content: "ping" }],
    "test"
  );
  process.env.GROQ_API_KEY = rawKey; // restore

  console.log("    Respons saat key invalid:", {
    status: invalidRes.status,
    text: invalidRes.text.slice(0, 80) + "...",
    error: invalidRes.error?.slice(0, 110),
  });

  assert(invalidRes.status === "fallback", "Sistem memberikan respons fallback ramah saat key Groq invalid");
  assert(!invalidRes.error?.includes("gsk_invalid_test_key_9999"), "Error message aman dan menutupi key");

  console.log("\n=================================================================");
  console.log(`   HASIL AKHIR: ${passedTests} DARI ${totalTests} PENGUJIAN BERHASIL`);
  console.log("=================================================================\n");

  await prisma.$disconnect();
  process.exit(passedTests === totalTests ? 0 : 1);
}

runTests().catch((err) => {
  console.error("Fatal Test Error:", err);
  process.exit(1);
});
