import "dotenv/config";
import prisma from "../src/lib/prisma";
import { resolveContextualQuestion } from "../src/lib/chatbot/context-resolver";
import { getSessionState, updateSessionState, clearSessionState } from "../src/lib/chatbot/memory";
import { checkStatisticPermission } from "../src/lib/chatbot/permissions";
import { detectQuestionIntent } from "../src/lib/chatbot/intents";
import { formatStatisticAnswer } from "../src/lib/chatbot/answers";
import { getActualUserStats, getActualPelayananStats } from "../src/lib/chatbot/stats";

// Helper function to simulate a user sending a message through the chatbot pipeline
async function simulateChatTurn(
  sessionKey: string,
  userQuery: string,
  role: "WARGA" | "STAF_DESA" | "SUPERVISOR" | "KEPALA_DESA" | "GUEST",
  userId?: string,
  history: Array<{ role: string; content: string }> = []
) {
  const sessionState = getSessionState(sessionKey, history);

  // 1. Contextual follow-up resolver
  const contextual = await resolveContextualQuestion(
    userQuery,
    sessionState,
    role,
    userId,
    sessionKey
  );

  if (contextual.handled && contextual.response) {
    history.push({ role: "user", content: userQuery });
    history.push({ role: "assistant", content: contextual.response });
    return {
      response: contextual.response,
      handledBy: "CONTEXT_RESOLVER",
      state: getSessionState(sessionKey),
    };
  }

  // 2. Intent detection
  const intentResult = detectQuestionIntent(userQuery);
  if (intentResult.intent !== "UNKNOWN") {
    const perm = checkStatisticPermission(role, intentResult.intent);
    if (!perm.allowed) {
      const resp = perm.refusalMessage || "Akses ditolak";
      history.push({ role: "user", content: userQuery });
      history.push({ role: "assistant", content: resp });
      return { response: resp, handledBy: "PERMISSION_BLOCKED", state: getSessionState(sessionKey) };
    }

    const [uStats, pStats] = await Promise.all([
      getActualUserStats(),
      getActualPelayananStats(),
    ]);
    const resp = formatStatisticAnswer(intentResult.intent, uStats, pStats);

    if (["JUMLAH_WARGA", "WARGA_AKTIF", "WARGA_PINDAH"].includes(intentResult.intent)) {
      updateSessionState(sessionKey, { entity: "WARGA", lastIntent: intentResult.intent, lastQuery: userQuery });
    } else if (intentResult.intent === "JUMLAH_STAF") {
      updateSessionState(sessionKey, { entity: "STAF", lastIntent: "JUMLAH_STAF", lastQuery: userQuery });
    } else if (intentResult.intent === "PENGAJUAN_BELUM_SELESAI") {
      updateSessionState(sessionKey, { entity: "PENGAJUAN", statusFilter: ["DIAJUKAN", "DIPERIKSA"], statusLabel: "memerlukan verifikasi", lastIntent: intentResult.intent, lastQuery: userQuery });
    }

    history.push({ role: "user", content: userQuery });
    history.push({ role: "assistant", content: resp });
    return { response: resp, handledBy: "INTENT_HANDLER", state: getSessionState(sessionKey) };
  }

  return { response: "FALLBACK_OR_AI", handledBy: "AI", state: getSessionState(sessionKey) };
}

async function runAllTests() {
  console.log("================================================================================");
  console.log("     UJI VALIDASI KEMAMPUAN MEMORI KONTEKS PERCAKAPAN CHATBOT ASISTEN DESA      ");
  console.log("================================================================================\n");

  const staf = await prisma.user.findFirst({ where: { role: "STAF_DESA" } });
  const warga = await prisma.user.findFirst({ where: { role: "WARGA" } });

  let testsPassed = 0;
  let totalTests = 0;

  function assertTest(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      if (detail) console.log(`   Detail: ${detail.replace(/\n/g, " ").slice(0, 100)}...`);
      testsPassed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   Detail: ${detail.replace(/\n/g, " ").slice(0, 100)}...`);
    }
  }

  const clean = (str: string) => str.replace(/\*\*/g, "").toLowerCase();

  // ─────────────────────────────────────────────────────────────────────────
  // TES WAJIB A & FOLLOW-UPS: Pengajuan Apa Saja yang Perlu Diverifikasi
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TES A & FOLLOW-UPS: 'Pengajuan apa saja yang perlu diverifikasi?'] ---");
  const sessionA = `test_flow_A_${Date.now()}`;
  clearSessionState(sessionA);
  const historyA: Array<{ role: string; content: string }> = [];

  const turnA_1 = await simulateChatTurn(sessionA, "Pengajuan apa saja yang perlu diverifikasi?", "STAF_DESA", staf?.id, historyA);
  assertTest(
    turnA_1.handledBy === "CONTEXT_RESOLVER" &&
    turnA_1.response.includes("Berikut terdapat **4 pengajuan** yang memerlukan verifikasi") &&
    turnA_1.response.includes("| No | No. Registrasi | Pemohon | Jenis Layanan | Tanggal | Status |") &&
    turnA_1.response.includes("ryvn") &&
    turnA_1.response.includes("ramli") &&
    turnA_1.response.includes("Budi Santoso") &&
    turnA_1.response.includes("Siti Aminah"),
    "Tes A: 'Pengajuan apa saja yang perlu diverifikasi?' menghasilkan jumlah aktual (4) dan tabel daftar pengajuan",
    turnA_1.response.slice(0, 110) + "..."
  );

  const turnA_2 = await simulateChatTurn(sessionA, "Siapa nama pemohonnya?", "STAF_DESA", staf?.id, historyA);
  assertTest(
    turnA_2.handledBy === "CONTEXT_RESOLVER" &&
    turnA_2.response.includes("ryvn") &&
    turnA_2.response.includes("ramli") &&
    turnA_2.response.includes("Budi Santoso") &&
    turnA_2.response.includes("Siti Aminah") &&
    turnA_2.response.includes("Surat Keterangan"),
    "Follow-up A.1: 'Siapa nama pemohonnya?' menampilkan nama pemohon dari 4 pengajuan verifikasi tersebut",
    turnA_2.response.slice(0, 110) + "..."
  );

  const turnA_3 = await simulateChatTurn(sessionA, "Mana yang SKTM?", "STAF_DESA", staf?.id, historyA);
  assertTest(
    turnA_3.handledBy === "CONTEXT_RESOLVER" &&
    turnA_3.response.includes("2 pengajuan Surat Keterangan Tidak Mampu (SKTM)") &&
    turnA_3.response.includes("ryvn") &&
    turnA_3.response.includes("ramli") &&
    !turnA_3.response.includes("Budi Santoso"),
    "Follow-up A.2: 'Mana yang SKTM?' memfilter daftar antrean verifikasi sebelumnya menjadi khusus SKTM (2 berkas)",
    turnA_3.response.slice(0, 110) + "..."
  );

  const turnA_4 = await simulateChatTurn(sessionA, "Berapa yang sudah disetujui?", "STAF_DESA", staf?.id, historyA);
  assertTest(
    turnA_4.handledBy === "CONTEXT_RESOLVER" &&
    clean(turnA_4.response).includes("1 pengajuan") &&
    clean(turnA_4.response).includes("sudah disetujui"),
    "Follow-up A.3: 'Berapa yang sudah disetujui?' mengambil jumlah pengajuan disetujui dari database (1 pengajuan)",
    turnA_4.response
  );

  // ─────────────────────────────────────────────────────────────────────────
  // TES WAJIB B & C: Data Warga Terdaftar & Siapa Saja
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TES B & C: 'Ada berapa warga yang terdaftar?' -> 'Siapa saja?'] ---");
  const sessionBC = `test_flow_BC_${Date.now()}`;
  clearSessionState(sessionBC);
  const historyBC: Array<{ role: string; content: string }> = [];

  const turnB = await simulateChatTurn(sessionBC, "Ada berapa warga yang terdaftar?", "STAF_DESA", staf?.id, historyBC);
  assertTest(
    turnB.handledBy === "CONTEXT_RESOLVER" &&
    turnB.response.includes("6 warga yang terdaftar"),
    "Tes B: 'Ada berapa warga yang terdaftar?' dijawab dengan angka riil dari tabel User role WARGA (6 warga)",
    turnB.response.slice(0, 90) + "..."
  );

  const turnC = await simulateChatTurn(sessionBC, "Siapa saja?", "STAF_DESA", staf?.id, historyBC);
  assertTest(
    turnC.handledBy === "CONTEXT_RESOLVER" &&
    turnC.response.includes("Budi Santoso") &&
    turnC.response.includes("Khairul") &&
    turnC.response.includes("michitaka") &&
    turnC.response.includes("ramli") &&
    turnC.response.includes("ryvn") &&
    turnC.response.includes("Siti Aminah"),
    "Tes C: 'Siapa saja?' menampilkan 6 nama warga dari database sesuai konteks pertanyaan B",
    turnC.response.slice(0, 110) + "..."
  );

  const turnC_detail = await simulateChatTurn(sessionBC, "Tampilkan alamatnya jika saya memiliki izin.", "STAF_DESA", staf?.id, historyBC);
  assertTest(
    turnC_detail.handledBy === "CONTEXT_RESOLVER" &&
    turnC_detail.response.includes("| Nama Warga | NIK | Alamat Domisili |") &&
    turnC_detail.response.includes("3201010101900001"),
    "Lanjutan C: 'Tampilkan alamatnya jika saya memiliki izin' menyajikan tabel NIK dan alamat warga untuk staf yang berwenang",
    turnC_detail.response.slice(0, 110) + "..."
  );

  // ─────────────────────────────────────────────────────────────────────────
  // TES WAJIB D, E, & F: Surat SKTM, Mana yang Disetujui, dan Nama Pemohon
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TES D, E, & F: Surat SKTM -> Mana yang Disetujui -> Siapa Pemohonnya] ---");
  const sessionDEF = `test_flow_DEF_${Date.now()}`;
  clearSessionState(sessionDEF);
  const historyDEF: Array<{ role: string; content: string }> = [];

  const turnD = await simulateChatTurn(sessionDEF, "Berapa pengajuan SKTM?", "STAF_DESA", staf?.id, historyDEF);
  assertTest(
    turnD.handledBy === "CONTEXT_RESOLVER" &&
    turnD.response.includes("7 pengajuan Surat Keterangan Tidak Mampu (SKTM)"),
    "Tes D: 'Berapa pengajuan SKTM?' menghitung total riil SKTM di sistem (7 pengajuan)",
    turnD.response.slice(0, 95) + "..."
  );

  const turnE = await simulateChatTurn(sessionDEF, "Mana yang sudah disetujui?", "STAF_DESA", staf?.id, historyDEF);
  assertTest(
    turnE.handledBy === "CONTEXT_RESOLVER" &&
    turnE.response.includes("REQ-261022-5765") &&
    turnE.response.includes("michitaka"),
    "Tes E: 'Mana yang sudah disetujui?' menampilkan daftar pengajuan SKTM yang disetujui (michitaka)",
    turnE.response.slice(0, 110) + "..."
  );

  const turnF = await simulateChatTurn(sessionDEF, "Siapa saja pemohonnya?", "STAF_DESA", staf?.id, historyDEF);
  assertTest(
    turnF.handledBy === "CONTEXT_RESOLVER" &&
    turnF.response.includes("Daftar Pemohon Surat Keterangan Tidak Mampu") &&
    turnF.response.includes("Khairul") &&
    turnF.response.includes("ryvn") &&
    turnF.response.includes("ramli"),
    "Tes F: 'Siapa saja pemohonnya?' menampilkan seluruh pemohon pengajuan SKTM dari database",
    turnF.response.slice(0, 110) + "..."
  );

  // ─────────────────────────────────────────────────────────────────────────
  // TES PETUGAS / STAF & TUGAS
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TES DATA STAF: 'Berapa jumlah staf desa?' -> 'Siapa saja?' -> 'Siapa yang bertugas memverifikasi?'] ---");
  const sessionStaf = `test_staf_${Date.now()}`;
  clearSessionState(sessionStaf);
  const historyStaf: Array<{ role: string; content: string }> = [];

  const turnS1 = await simulateChatTurn(sessionStaf, "Berapa jumlah staf desa?", "STAF_DESA", staf?.id, historyStaf);
  assertTest(
    turnS1.handledBy === "CONTEXT_RESOLVER" &&
    turnS1.response.includes("2 staf desa / operator pelayanan"),
    "Staf Q1: 'Berapa jumlah staf desa?' menghitung total akun STAF_DESA di database (2 staf)",
    turnS1.response.slice(0, 90) + "..."
  );

  const turnS2 = await simulateChatTurn(sessionStaf, "Siapa saja stafnya?", "STAF_DESA", staf?.id, historyStaf);
  assertTest(
    turnS2.handledBy === "CONTEXT_RESOLVER" &&
    turnS2.response.includes("Michitaka") &&
    turnS2.response.includes("Erlangga"),
    "Staf Q2: Follow-up 'Siapa saja stafnya?' menampilkan daftar nama staf riil",
    turnS2.response.slice(0, 95) + "..."
  );

  const turnS3 = await simulateChatTurn(sessionStaf, "Siapa yang bertugas memverifikasi?", "STAF_DESA", staf?.id, historyStaf);
  assertTest(
    turnS3.handledBy === "CONTEXT_RESOLVER" &&
    turnS3.response.includes("Tugas & Wewenang Staf Desa") &&
    turnS3.response.includes("Pemeriksaan Berkas Masuk") &&
    turnS3.response.includes("Proses Verifikasi"),
    "Staf Q3: Follow-up 'Siapa yang bertugas memverifikasi?' menjelaskan SOP verifikasi staf desa",
    turnS3.response.slice(0, 100) + "..."
  );

  // ─────────────────────────────────────────────────────────────────────────
  // TES STATISTIK BULANAN & TREN
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TES STATISTIK: 'Berapa pengajuan bulan ini?' -> 'Bagaimana kalau bulan lalu?' -> 'Apakah jumlahnya meningkat atau menurun?'] ---");
  const sessionStat = `test_stat_${Date.now()}`;
  clearSessionState(sessionStat);
  const historyStat: Array<{ role: string; content: string }> = [];

  const turnStat1 = await simulateChatTurn(sessionStat, "Berapa pengajuan bulan ini?", "STAF_DESA", staf?.id, historyStat);
  assertTest(
    turnStat1.handledBy === "CONTEXT_RESOLVER" &&
    clean(turnStat1.response).includes("pengajuan masuk") &&
    clean(turnStat1.response).includes("november 2026"),
    "Stat Q1: 'Berapa pengajuan bulan ini?' mengambil pengajuan aktual bulan berjalan",
    turnStat1.response
  );

  const turnStat2 = await simulateChatTurn(sessionStat, "Bagaimana kalau bulan lalu?", "STAF_DESA", staf?.id, historyStat);
  assertTest(
    turnStat2.handledBy === "CONTEXT_RESOLVER" &&
    clean(turnStat2.response).includes("bulan lalu") &&
    clean(turnStat2.response).includes("oktober 2026"),
    "Stat Q2: Follow-up 'Bagaimana kalau bulan lalu?' mengambil data pengajuan bulan lalu",
    turnStat2.response
  );

  const turnStat3 = await simulateChatTurn(sessionStat, "Apakah jumlahnya meningkat atau menurun?", "STAF_DESA", staf?.id, historyStat);
  assertTest(
    turnStat3.handledBy === "CONTEXT_RESOLVER" &&
    turnStat3.response.includes("Perbandingan Statistik Pengajuan"),
    "Stat Q3: Follow-up 'Apakah jumlahnya meningkat atau menurun?' membandingkan tren antar bulan",
    turnStat3.response.slice(0, 95) + "..."
  );

  // ─────────────────────────────────────────────────────────────────────────
  // TES ROLE SECURITY & ACCESS CONTROL
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- [TES KEAMANAN ROLE & PRIVASI DATA] ---");

  const sessionWarga = `test_warga_${Date.now()}`;
  clearSessionState(sessionWarga);

  // Warga mencoba bertanya siapa saja warga terdaftar
  const turnW1 = await simulateChatTurn(sessionWarga, "Ada berapa warga yang terdaftar?", "WARGA", warga?.id);
  assertTest(
    turnW1.response.includes("Akses Terbatas") || turnW1.response.includes("Perlindungan Privasi"),
    "Role Warga DITOLAK saat meminta rekap kependudukan warga lain",
    turnW1.response.slice(0, 90) + "..."
  );

  const turnW2 = await simulateChatTurn(sessionWarga, "Siapa saja warganya?", "WARGA", warga?.id);
  assertTest(
    turnW2.response.includes("Perlindungan Privasi") || turnW2.response.includes("Akses Terbatas"),
    "Role Warga DITOLAK saat meminta daftar nama warga lain",
    turnW2.response.slice(0, 90) + "..."
  );

  const turnW3 = await simulateChatTurn(sessionWarga, "Tampilkan alamatnya jika saya memiliki izin", "WARGA", warga?.id);
  assertTest(
    turnW3.response.includes("Perlindungan Privasi") || turnW3.response.includes("Akses Terbatas"),
    "Role Warga DITOLAK saat meminta tabel alamat warga",
    turnW3.response.slice(0, 90) + "..."
  );

  console.log("\n================================================================================");
  console.log(`HASIL AKHIR: ${testsPassed} / ${totalTests} PENGUJIAN LULUS (${Math.round((testsPassed / totalTests) * 100)}%)`);
  console.log("================================================================================\n");
}

runAllTests().catch(console.error).finally(() => process.exit(0));
