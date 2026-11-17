import prisma from "../src/lib/prisma";
import { resolveContextualQuestion } from "../src/lib/chatbot/context-resolver";
import { clearSessionState, getSessionState } from "../src/lib/chatbot/memory";
import { ChatRole } from "../src/lib/chatbot/roles";

async function simulateChatTurn(
  sessionKey: string,
  userQuery: string,
  role: ChatRole,
  userId?: string,
  history: Array<{ role: string; content: string }> = [],
  pageContext?: { pathname?: string; pageTitle?: string }
) {
  const sessionState = getSessionState(sessionKey, history);

  const contextual = await resolveContextualQuestion(
    userQuery,
    sessionState,
    role,
    userId,
    sessionKey,
    pageContext
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

  return {
    response: "Mohon maaf, saya belum menemukan data spesifik terkait pertanyaan.",
    handledBy: "FALLBACK",
    state: getSessionState(sessionKey),
  };
}

async function runPageContextTests() {
  console.log("================================================================================");
  console.log("   UJI VALIDASI PERBAIKAN PEMAHAMAN PERTANYAAN SINGKAT & KONTEKS HALAMAN AKTIF   ");
  console.log("================================================================================\n");

  const [staf, warga, supervisor, kades] = await Promise.all([
    prisma.user.findFirst({ where: { role: "STAF_DESA" } }),
    prisma.user.findFirst({ where: { role: "WARGA" } }),
    prisma.user.findFirst({ where: { role: "SUPERVISOR" } }),
    prisma.user.findFirst({ where: { role: "KEPALA_DESA" } }),
  ]);

  let testsPassed = 0;
  let totalTests = 0;

  function assertTest(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      if (detail) console.log(`   Detail: ${detail.replace(/\n/g, " ").slice(0, 110)}...`);
      testsPassed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   Detail: ${detail.replace(/\n/g, " ").slice(0, 110)}...`);
    }
  }

  const clean = (str: string) => str.replace(/\*\*/g, "").toLowerCase();

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. PENGUJIAN ROLE STAF DESA (DASHBOARD & SUB-HALAMAN)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [BAGIAN 1: STAF DESA — Pertanyaan Singkat & Konteks Halaman] ---");
  const sessionStaf = `test_staf_${Date.now()}`;
  clearSessionState(sessionStaf);
  const histStaf: Array<{ role: string; content: string }> = [];

  // A. Pertanyaan singkat: 'Ada berapa fitur?' (pada dashboard /staf)
  const tStaf_A = await simulateChatTurn(
    sessionStaf,
    "Ada berapa fitur?",
    "STAF_DESA",
    staf?.id,
    histStaf,
    { pathname: "/staf" }
  );
  assertTest(
    tStaf_A.handledBy === "CONTEXT_RESOLVER" &&
      clean(tStaf_A.response).includes("pada dashboard staf desa, terdapat 4 menu utama") &&
      clean(tStaf_A.response).includes("dashboard") &&
      clean(tStaf_A.response).includes("verifikasi pengajuan") &&
      clean(tStaf_A.response).includes("master layanan") &&
      clean(tStaf_A.response).includes("data pengguna"),
    "Staf A: 'Ada berapa fitur?' dijawab dengan ikhtisar 4 menu Dashboard Staf Desa",
    tStaf_A.response
  );

  // B. Pertanyaan: 'Ada fitur apa saja?'
  const tStaf_B = await simulateChatTurn(
    sessionStaf,
    "Ada fitur apa saja?",
    "STAF_DESA",
    staf?.id,
    histStaf,
    { pathname: "/staf" }
  );
  assertTest(
    tStaf_B.handledBy === "CONTEXT_RESOLVER" &&
      clean(tStaf_B.response).includes("terdapat 4 menu utama") &&
      clean(tStaf_B.response).includes("verifikasi pengajuan"),
    "Staf B: 'Ada fitur apa saja?' mempertahankan konteks 4 menu staf desa",
    tStaf_B.response
  );

  // C. Pertanyaan lanjutan: 'Apa fungsi yang pertama?'
  const tStaf_C = await simulateChatTurn(
    sessionStaf,
    "Apa fungsi yang pertama?",
    "STAF_DESA",
    staf?.id,
    histStaf,
    { pathname: "/staf" }
  );
  assertTest(
    tStaf_C.handledBy === "CONTEXT_RESOLVER" &&
      clean(tStaf_C.response).includes("fungsi menu ke-1: dashboard administrasi") &&
      clean(tStaf_C.response).includes("memantau ringkasan operasional"),
    "Staf C: 'Apa fungsi yang pertama?' menjelaskan Dashboard Administrasi",
    tStaf_C.response
  );

  // D. Pertanyaan lanjutan: 'Bagaimana cara menggunakannya?'
  const tStaf_D = await simulateChatTurn(
    sessionStaf,
    "Bagaimana cara menggunakannya?",
    "STAF_DESA",
    staf?.id,
    histStaf,
    { pathname: "/staf" }
  );
  assertTest(
    tStaf_D.handledBy === "CONTEXT_RESOLVER" &&
      clean(tStaf_D.response).includes("panduan penggunaan: dashboard administrasi") &&
      clean(tStaf_D.response).includes("tombol 'proses'"),
    "Staf D: 'Bagaimana cara menggunakannya?' memandu operasional menu ke-1",
    tStaf_D.response
  );

  // Follow-up lanjutan: 'Siapa saja yang bisa mengaksesnya?'
  const tStaf_Access = await simulateChatTurn(
    sessionStaf,
    "Siapa saja yang bisa mengaksesnya?",
    "STAF_DESA",
    staf?.id,
    histStaf,
    { pathname: "/staf" }
  );
  assertTest(
    tStaf_Access.handledBy === "CONTEXT_RESOLVER" &&
      clean(tStaf_Access.response).includes("hak akses fitur") &&
      clean(tStaf_Access.response).includes("staf desa"),
    "Staf Follow-up: 'Siapa saja yang bisa mengaksesnya?' menjelaskan RBAC Staf Desa",
    tStaf_Access.response
  );

  // E. Pertanyaan spesifik halaman: 'Kalau di halaman ini ada menu apa saja?' (di /staf/pengajuan)
  const tStaf_E = await simulateChatTurn(
    sessionStaf,
    "Kalau di halaman ini ada menu apa saja?",
    "STAF_DESA",
    staf?.id,
    histStaf,
    { pathname: "/staf/pengajuan" }
  );
  assertTest(
    tStaf_E.handledBy === "CONTEXT_RESOLVER" &&
      clean(tStaf_E.response).includes("pada halaman verifikasi pengajuan") &&
      clean(tStaf_E.response).includes("halaman aktif saat ini") &&
      clean(tStaf_E.response).includes("memeriksa antrean berkas pengajuan"),
    "Staf E: 'Kalau di halaman ini ada menu apa saja?' mengenali konteks /staf/pengajuan",
    tStaf_E.response
  );

  // Variasi pertanyaan lain: 'Berapa jumlah menu?'
  const tStaf_Count = await simulateChatTurn(
    sessionStaf,
    "Berapa jumlah menu?",
    "STAF_DESA",
    staf?.id,
    histStaf,
    { pathname: "/staf" }
  );
  assertTest(
    tStaf_Count.handledBy === "CONTEXT_RESOLVER" &&
      clean(tStaf_Count.response).includes("terdapat 4 menu utama"),
    "Staf Variasi: 'Berapa jumlah menu?' dijawab 4 menu utama",
    tStaf_Count.response
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. PENGUJIAN ROLE SUPERVISOR
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [BAGIAN 2: SUPERVISOR — Pertanyaan Singkat & Konteks Halaman] ---");
  const sessionSup = `test_sup_${Date.now()}`;
  clearSessionState(sessionSup);
  const histSup: Array<{ role: string; content: string }> = [];

  const tSup_A = await simulateChatTurn(
    sessionSup,
    "Ada berapa fitur?",
    "SUPERVISOR",
    supervisor?.id,
    histSup,
    { pathname: "/supervisor" }
  );
  assertTest(
    tSup_A.handledBy === "CONTEXT_RESOLVER" &&
      clean(tSup_A.response).includes("pada dashboard supervisor, terdapat 5 menu utama") &&
      clean(tSup_A.response).includes("validasi pengajuan") &&
      clean(tSup_A.response).includes("laporan & statistik") &&
      clean(tSup_A.response).includes("database desa") &&
      clean(tSup_A.response).includes("audit logs"),
    "Supervisor A: 'Ada berapa fitur?' menghasilkan 5 menu Dashboard Supervisor",
    tSup_A.response
  );

  const tSup_B = await simulateChatTurn(
    sessionSup,
    "Ada fitur apa saja?",
    "SUPERVISOR",
    supervisor?.id,
    histSup,
    { pathname: "/supervisor" }
  );
  assertTest(
    tSup_B.handledBy === "CONTEXT_RESOLVER" &&
      clean(tSup_B.response).includes("terdapat 5 menu utama"),
    "Supervisor B: 'Ada fitur apa saja?' mempertahankan konteks 5 menu",
    tSup_B.response
  );

  const tSup_C = await simulateChatTurn(
    sessionSup,
    "Apa fungsi yang pertama?",
    "SUPERVISOR",
    supervisor?.id,
    histSup,
    { pathname: "/supervisor" }
  );
  assertTest(
    tSup_C.handledBy === "CONTEXT_RESOLVER" &&
      clean(tSup_C.response).includes("dashboard pengawasan"),
    "Supervisor C: 'Apa fungsi yang pertama?' menjelaskan Dashboard Pengawasan",
    tSup_C.response
  );

  const tSup_D = await simulateChatTurn(
    sessionSup,
    "Bagaimana cara menggunakannya?",
    "SUPERVISOR",
    supervisor?.id,
    histSup,
    { pathname: "/supervisor" }
  );
  assertTest(
    tSup_D.handledBy === "CONTEXT_RESOLVER" &&
      clean(tSup_D.response).includes("panduan penggunaan: dashboard pengawasan"),
    "Supervisor D: 'Bagaimana cara menggunakannya?' memandu dashboard supervisor",
    tSup_D.response
  );

  const tSup_E = await simulateChatTurn(
    sessionSup,
    "Kalau di halaman ini ada menu apa saja?",
    "SUPERVISOR",
    supervisor?.id,
    histSup,
    { pathname: "/supervisor/pengajuan" }
  );
  assertTest(
    tSup_E.handledBy === "CONTEXT_RESOLVER" &&
      clean(tSup_E.response).includes("pada halaman validasi pengajuan") &&
      clean(tSup_E.response).includes("halaman aktif saat ini"),
    "Supervisor E: 'Kalau di halaman ini ada menu apa saja?' mengenali konteks /supervisor/pengajuan",
    tSup_E.response
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. PENGUJIAN ROLE KEPALA DESA
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [BAGIAN 3: KEPALA DESA — Pertanyaan Singkat & Konteks Halaman] ---");
  const sessionKades = `test_kades_${Date.now()}`;
  clearSessionState(sessionKades);
  const histKades: Array<{ role: string; content: string }> = [];

  const tKades_A = await simulateChatTurn(
    sessionKades,
    "Ada berapa fitur?",
    "KEPALA_DESA",
    kades?.id,
    histKades,
    { pathname: "/kades" }
  );
  assertTest(
    tKades_A.handledBy === "CONTEXT_RESOLVER" &&
      clean(tKades_A.response).includes("pada dashboard kepala desa, terdapat 4 menu utama") &&
      clean(tKades_A.response).includes("approval pengajuan") &&
      clean(tKades_A.response).includes("laporan eksekutif") &&
      clean(tKades_A.response).includes("audit trail"),
    "Kades A: 'Ada berapa fitur?' menghasilkan 4 menu Dashboard Kepala Desa",
    tKades_A.response
  );

  const tKades_B = await simulateChatTurn(
    sessionKades,
    "Ada fitur apa saja?",
    "KEPALA_DESA",
    kades?.id,
    histKades,
    { pathname: "/kades" }
  );
  assertTest(
    tKades_B.handledBy === "CONTEXT_RESOLVER" &&
      clean(tKades_B.response).includes("approval pengajuan"),
    "Kades B: 'Ada fitur apa saja?' mempertahankan konteks 4 menu kades",
    tKades_B.response
  );

  const tKades_C = await simulateChatTurn(
    sessionKades,
    "Apa fungsi yang pertama?",
    "KEPALA_DESA",
    kades?.id,
    histKades,
    { pathname: "/kades" }
  );
  assertTest(
    tKades_C.handledBy === "CONTEXT_RESOLVER" &&
      clean(tKades_C.response).includes("dashboard eksekutif"),
    "Kades C: 'Apa fungsi yang pertama?' menjelaskan Dashboard Eksekutif",
    tKades_C.response
  );

  const tKades_D = await simulateChatTurn(
    sessionKades,
    "Bagaimana cara menggunakannya?",
    "KEPALA_DESA",
    kades?.id,
    histKades,
    { pathname: "/kades" }
  );
  assertTest(
    tKades_D.handledBy === "CONTEXT_RESOLVER" &&
      clean(tKades_D.response).includes("panduan penggunaan: dashboard eksekutif"),
    "Kades D: 'Bagaimana cara menggunakannya?' memandu dashboard kades",
    tKades_D.response
  );

  const tKades_E = await simulateChatTurn(
    sessionKades,
    "Kalau di halaman ini ada menu apa saja?",
    "KEPALA_DESA",
    kades?.id,
    histKades,
    { pathname: "/kades/pengajuan" }
  );
  assertTest(
    tKades_E.handledBy === "CONTEXT_RESOLVER" &&
      clean(tKades_E.response).includes("pada halaman approval pengajuan") &&
      clean(tKades_E.response).includes("halaman aktif saat ini"),
    "Kades E: 'Kalau di halaman ini ada menu apa saja?' mengenali konteks /kades/pengajuan",
    tKades_E.response
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. PENGUJIAN ROLE WARGA
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [BAGIAN 4: WARGA — Pertanyaan Singkat & Konteks Halaman] ---");
  const sessionWarga = `test_warga_${Date.now()}`;
  clearSessionState(sessionWarga);
  const histWarga: Array<{ role: string; content: string }> = [];

  const tWarga_A = await simulateChatTurn(
    sessionWarga,
    "Ada berapa fitur?",
    "WARGA",
    warga?.id,
    histWarga,
    { pathname: "/warga" }
  );
  assertTest(
    tWarga_A.handledBy === "CONTEXT_RESOLVER" &&
      clean(tWarga_A.response).includes("pada dashboard pelayanan warga, terdapat 4 menu utama") &&
      clean(tWarga_A.response).includes("ajukan pelayanan") &&
      clean(tWarga_A.response).includes("status pengajuan") &&
      clean(tWarga_A.response).includes("asisten ai"),
    "Warga A: 'Ada berapa fitur?' menghasilkan 4 menu Dashboard Pelayanan Warga",
    tWarga_A.response
  );

  const tWarga_B = await simulateChatTurn(
    sessionWarga,
    "Ada fitur apa saja?",
    "WARGA",
    warga?.id,
    histWarga,
    { pathname: "/warga" }
  );
  assertTest(
    tWarga_B.handledBy === "CONTEXT_RESOLVER" &&
      clean(tWarga_B.response).includes("ajukan pelayanan"),
    "Warga B: 'Ada fitur apa saja?' mempertahankan konteks menu warga",
    tWarga_B.response
  );

  const tWarga_C = await simulateChatTurn(
    sessionWarga,
    "Apa fungsi yang pertama?",
    "WARGA",
    warga?.id,
    histWarga,
    { pathname: "/warga" }
  );
  assertTest(
    tWarga_C.handledBy === "CONTEXT_RESOLVER" &&
      clean(tWarga_C.response).includes("dashboard pelayanan warga"),
    "Warga C: 'Apa fungsi yang pertama?' menjelaskan Dashboard Pelayanan Warga",
    tWarga_C.response
  );

  const tWarga_D = await simulateChatTurn(
    sessionWarga,
    "Bagaimana cara menggunakannya?",
    "WARGA",
    warga?.id,
    histWarga,
    { pathname: "/warga" }
  );
  assertTest(
    tWarga_D.handledBy === "CONTEXT_RESOLVER" &&
      clean(tWarga_D.response).includes("panduan penggunaan: dashboard pelayanan warga"),
    "Warga D: 'Bagaimana cara menggunakannya?' memandu dashboard warga",
    tWarga_D.response
  );

  const tWarga_E = await simulateChatTurn(
    sessionWarga,
    "Kalau di halaman ini ada menu apa saja?",
    "WARGA",
    warga?.id,
    histWarga,
    { pathname: "/warga/layanan" }
  );
  assertTest(
    tWarga_E.handledBy === "CONTEXT_RESOLVER" &&
      clean(tWarga_E.response).includes("pada halaman ajukan pelayanan") &&
      clean(tWarga_E.response).includes("halaman aktif saat ini"),
    "Warga E: 'Kalau di halaman ini ada menu apa saja?' mengenali konteks /warga/layanan",
    tWarga_E.response
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. PENGUJIAN ROLE ADMIN
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [BAGIAN 5: ADMIN — Pertanyaan Singkat & Konteks Halaman] ---");
  const sessionAdmin = `test_admin_${Date.now()}`;
  clearSessionState(sessionAdmin);
  const histAdmin: Array<{ role: string; content: string }> = [];

  const tAdmin_A = await simulateChatTurn(
    sessionAdmin,
    "Ada berapa fitur?",
    "ADMIN",
    undefined,
    histAdmin,
    { pathname: "/staf" }
  );
  assertTest(
    tAdmin_A.handledBy === "CONTEXT_RESOLVER" &&
      clean(tAdmin_A.response).includes("pada dashboard administrator desa, terdapat 4 menu utama"),
    "Admin A: 'Ada berapa fitur?' menghasilkan 4 menu Dashboard Administrator Desa",
    tAdmin_A.response
  );

  const tAdmin_B = await simulateChatTurn(
    sessionAdmin,
    "Ada fitur apa saja?",
    "ADMIN",
    undefined,
    histAdmin,
    { pathname: "/staf" }
  );
  assertTest(
    tAdmin_B.handledBy === "CONTEXT_RESOLVER" &&
      clean(tAdmin_B.response).includes("master layanan"),
    "Admin B: 'Ada fitur apa saja?' menampilkan menu admin",
    tAdmin_B.response
  );

  const tAdmin_C = await simulateChatTurn(
    sessionAdmin,
    "Apa fungsi yang pertama?",
    "ADMIN",
    undefined,
    histAdmin,
    { pathname: "/staf" }
  );
  assertTest(
    tAdmin_C.handledBy === "CONTEXT_RESOLVER" &&
      clean(tAdmin_C.response).includes("dashboard administrasi"),
    "Admin C: 'Apa fungsi yang pertama?' menjelaskan dashboard admin",
    tAdmin_C.response
  );

  const tAdmin_D = await simulateChatTurn(
    sessionAdmin,
    "Bagaimana cara menggunakannya?",
    "ADMIN",
    undefined,
    histAdmin,
    { pathname: "/staf" }
  );
  assertTest(
    tAdmin_D.handledBy === "CONTEXT_RESOLVER" &&
      clean(tAdmin_D.response).includes("panduan penggunaan: dashboard administrasi"),
    "Admin D: 'Bagaimana cara menggunakannya?' memandu operasional admin",
    tAdmin_D.response
  );

  const tAdmin_E = await simulateChatTurn(
    sessionAdmin,
    "Kalau di halaman ini ada menu apa saja?",
    "ADMIN",
    undefined,
    histAdmin,
    { pathname: "/staf" }
  );
  assertTest(
    tAdmin_E.handledBy === "CONTEXT_RESOLVER" &&
      clean(tAdmin_E.response).includes("terdapat 4 menu utama"),
    "Admin E: 'Kalau di halaman ini ada menu apa saja?' menjawab untuk role Admin",
    tAdmin_E.response
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. PENGUJIAN KEAMANAN ROLE & PRIVILEGE ESCALATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- [BAGIAN 6: KEAMANAN: Role WARGA Mengirim Path /staf DITOLAK/DISANITASI] ---");
  const sessionTamper = `test_tamper_${Date.now()}`;
  clearSessionState(sessionTamper);
  const histTamper: Array<{ role: string; content: string }> = [];

  // Warga mencoba spoofing pathname: "/staf/pengajuan"
  const tTamper = await simulateChatTurn(
    sessionTamper,
    "Ada berapa fitur?",
    "WARGA",
    warga?.id,
    histTamper,
    { pathname: "/staf/pengajuan" } // Tampered pathname!
  );
  assertTest(
    tTamper.handledBy === "CONTEXT_RESOLVER" &&
      clean(tTamper.response).includes("pada dashboard pelayanan warga") &&
      !clean(tTamper.response).includes("dashboard staf desa"),
    "Keamanan: Path /staf dari role WARGA disanitasi ke Dashboard Pelayanan Warga",
    tTamper.response
  );

  console.log("\n================================================================================");
  console.log(`HASIL AKHIR: ${testsPassed} / ${totalTests} PENGUJIAN LULUS (${Math.round((testsPassed / totalTests) * 100)}%)`);
  console.log("================================================================================");

  if (testsPassed !== totalTests) {
    process.exit(1);
  }
}

runPageContextTests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

