import "dotenv/config";
import prisma from "../src/lib/prisma";
import { resolveContextualQuestion } from "../src/lib/chatbot/context-resolver";
import { getSessionState, clearSessionState } from "../src/lib/chatbot/memory";
import { ChatRole } from "../src/lib/chatbot/roles";

async function simulateChatTurn(
  sessionKey: string,
  userQuery: string,
  role: ChatRole,
  userId?: string,
  history: Array<{ role: string; content: string }> = []
) {
  const sessionState = getSessionState(sessionKey, history);

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

  return {
    response: "Mohon maaf, saya belum menemukan data spesifik terkait pertanyaan.",
    handledBy: "FALLBACK",
    state: getSessionState(sessionKey),
  };
}

async function runFeatureTests() {
  console.log("================================================================================");
  console.log("   UJI VALIDASI KECERDASAN CHATBOT: PEMAHAMAN FITUR APLIKASI & MULTI-TURN ROLE   ");
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
      if (detail) console.log(`   Detail: ${detail.replace(/\n/g, " ").slice(0, 105)}...`);
      testsPassed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   Detail: ${detail.replace(/\n/g, " ").slice(0, 105)}...`);
    }
  }

  const clean = (str: string) => str.replace(/\*\*/g, "").toLowerCase();

  // ─────────────────────────────────────────────────────────────────────────
  // BAGIAN 1: PENGUJIAN ROLE STAF DESA (OPERATOR PELAYANAN)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- [BAGIAN 1: STAF DESA — Fitur Dashboard & Multi-Turn Follow-Up] ---");
  const sessionStaf = `test_staf_feat_${Date.now()}`;
  clearSessionState(sessionStaf);
  const histStaf: Array<{ role: string; content: string }> = [];

  // Q1: Pada dashboard ada fitur apa saja?
  const tStaf_1 = await simulateChatTurn(sessionStaf, "Pada dashboard ada fitur apa saja?", "STAF_DESA", staf?.id, histStaf);
  assertTest(
    tStaf_1.handledBy === "CONTEXT_RESOLVER" &&
    clean(tStaf_1.response).includes("dashboard administrasi") &&
    clean(tStaf_1.response).includes("verifikasi pengajuan") &&
    clean(tStaf_1.response).includes("master layanan") &&
    clean(tStaf_1.response).includes("data pengguna"),
    "Staf 1: 'Pada dashboard ada fitur apa saja?' menjelaskan 4 menu utama staf desa",
    tStaf_1.response
  );

  // Q8: Apa fungsi menu pertama tadi? (Follow-up)
  const tStaf_2 = await simulateChatTurn(sessionStaf, "Apa fungsi menu pertama tadi?", "STAF_DESA", staf?.id, histStaf);
  assertTest(
    tStaf_2.handledBy === "CONTEXT_RESOLVER" &&
    clean(tStaf_2.response).includes("fungsi menu ke-1: dashboard administrasi"),
    "Staf 2: Follow-up 'Apa fungsi menu pertama tadi?' menjelaskan Dashboard Administrasi",
    tStaf_2.response
  );

  // Q9: Bagaimana cara menggunakannya? (Follow-up)
  const tStaf_3 = await simulateChatTurn(sessionStaf, "Bagaimana cara menggunakannya?", "STAF_DESA", staf?.id, histStaf);
  assertTest(
    tStaf_3.handledBy === "CONTEXT_RESOLVER" &&
    clean(tStaf_3.response).includes("panduan penggunaan") &&
    clean(tStaf_3.response).includes("tombol 'proses'"),
    "Staf 3: Follow-up 'Bagaimana cara menggunakannya?' memberikan langkah pakai Dashboard",
    tStaf_3.response
  );

  // Follow-up: Apakah saya bisa mengedit data?
  const tStaf_4 = await simulateChatTurn(sessionStaf, "Apakah saya bisa mengedit data?", "STAF_DESA", staf?.id, histStaf);
  assertTest(
    tStaf_4.handledBy === "CONTEXT_RESOLVER" &&
    clean(tStaf_4.response).includes("wewenang edit") &&
    clean(tStaf_4.response).includes("dapat melakukan perubahan"),
    "Staf 4: Follow-up 'Apakah saya bisa mengedit data?' menjelaskan wewenang edit staf",
    tStaf_4.response
  );

  // Q2: Apa fungsi masing-masing menu?
  const tStaf_5 = await simulateChatTurn(sessionStaf, "Apa fungsi masing-masing menu?", "STAF_DESA", staf?.id, histStaf);
  assertTest(
    tStaf_5.handledBy === "CONTEXT_RESOLVER" &&
    clean(tStaf_5.response).includes("fungsi lengkap masing-masing menu") &&
    clean(tStaf_5.response).includes("verifikasi pengajuan") &&
    clean(tStaf_5.response).includes("master layanan"),
    "Staf 5: 'Apa fungsi masing-masing menu?' menjelaskan seluruh fungsi menu staf",
    tStaf_5.response
  );

  // Q3: Bagaimana cara menambahkan pengguna?
  const tStaf_6 = await simulateChatTurn(sessionStaf, "Bagaimana cara menambahkan pengguna?", "STAF_DESA", staf?.id, histStaf);
  assertTest(
    tStaf_6.handledBy === "CONTEXT_RESOLVER" &&
    clean(tStaf_6.response).includes("/staf/pengguna") &&
    clean(tStaf_6.response).includes("tambah pengguna") &&
    clean(tStaf_6.response).includes("nik"),
    "Staf 6: 'Bagaimana cara menambahkan pengguna?' memandu tambah warga di /staf/pengguna",
    tStaf_6.response
  );

  // Q4: Bagaimana cara memverifikasi pengajuan?
  const tStaf_7 = await simulateChatTurn(sessionStaf, "Bagaimana cara memverifikasi pengajuan?", "STAF_DESA", staf?.id, histStaf);
  assertTest(
    tStaf_7.handledBy === "CONTEXT_RESOLVER" &&
    clean(tStaf_7.response).includes("mulai pemeriksaan") &&
    clean(tStaf_7.response).includes("minta perbaikan") &&
    clean(tStaf_7.response).includes("teruskan ke supervisor"),
    "Staf 7: 'Bagaimana cara memverifikasi pengajuan?' menjelaskan SOP verifikasi staf",
    tStaf_7.response
  );

  // Q5: Di mana saya melihat laporan?
  const tStaf_8 = await simulateChatTurn(sessionStaf, "Di mana saya melihat laporan?", "STAF_DESA", staf?.id, histStaf);
  assertTest(
    tStaf_8.handledBy === "CONTEXT_RESOLVER" &&
    clean(tStaf_8.response).includes("dashboard administrasi") &&
    clean(tStaf_8.response).includes("supervisor") &&
    clean(tStaf_8.response).includes("kepala desa"),
    "Staf 8: 'Di mana saya melihat laporan?' menerangkan lokasi laporan staf vs supervisor",
    tStaf_8.response
  );

  // Q6: Bagaimana cara mengubah data?
  const tStaf_9 = await simulateChatTurn(sessionStaf, "Bagaimana cara mengubah data?", "STAF_DESA", staf?.id, histStaf);
  assertTest(
    tStaf_9.handledBy === "CONTEXT_RESOLVER" &&
    clean(tStaf_9.response).includes("mengubah data warga") &&
    clean(tStaf_9.response).includes("edit pengguna"),
    "Staf 9: 'Bagaimana cara mengubah data?' menerangkan edit warga dan master layanan",
    tStaf_9.response
  );

  // Q7: Apa yang terjadi setelah pengajuan disetujui?
  const tStaf_10 = await simulateChatTurn(sessionStaf, "Apa yang terjadi setelah pengajuan disetujui?", "STAF_DESA", staf?.id, histStaf);
  assertTest(
    tStaf_10.handledBy === "CONTEXT_RESOLVER" &&
    clean(tStaf_10.response).includes("penerbitan surat sah oleh staf desa") &&
    clean(tStaf_10.response).includes("terbitkan surat") &&
    clean(tStaf_10.response).includes("selesai"),
    "Staf 10: 'Apa yang terjadi setelah pengajuan disetujui?' menjelaskan alur penerbitan surat sah",
    tStaf_10.response
  );

  // Q10: Apa saja fitur yang tidak bisa saya akses?
  const tStaf_11 = await simulateChatTurn(sessionStaf, "Apa saja fitur yang tidak bisa saya akses?", "STAF_DESA", staf?.id, histStaf);
  assertTest(
    tStaf_11.handledBy === "CONTEXT_RESOLVER" &&
    clean(tStaf_11.response).includes("fitur yang dibatasi untuk akun staf desa") &&
    clean(tStaf_11.response).includes("validasi tingkat supervisor") &&
    clean(tStaf_11.response).includes("tte kades"),
    "Staf 11: 'Apa saja fitur yang tidak bisa saya akses?' memaparkan batasan wewenang staf",
    tStaf_11.response
  );

  // ─────────────────────────────────────────────────────────────────────────
  // BAGIAN 2: PENGUJIAN ROLE WARGA (MASYARAKAT)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- [BAGIAN 2: WARGA — Fitur Pelayanan Warga & Pembatasan Role] ---");
  const sessionWarga = `test_warga_feat_${Date.now()}`;
  clearSessionState(sessionWarga);
  const histWarga: Array<{ role: string; content: string }> = [];

  // Q1: Pada dashboard ada fitur apa saja?
  const tWarga_1 = await simulateChatTurn(sessionWarga, "Pada dashboard ada fitur apa saja?", "WARGA", warga?.id, histWarga);
  assertTest(
    tWarga_1.handledBy === "CONTEXT_RESOLVER" &&
    clean(tWarga_1.response).includes("dashboard pelayanan warga") &&
    clean(tWarga_1.response).includes("ajukan pelayanan") &&
    clean(tWarga_1.response).includes("status pengajuan") &&
    !clean(tWarga_1.response).includes("master layanan"), // Warga TIDAK boleh melihat Master Layanan
    "Warga 1: 'Pada dashboard ada fitur apa saja?' menampilkan menu warga (Dashboard, Ajukan, Status, Asisten AI)",
    tWarga_1.response
  );

  // Q3: Bagaimana cara menambahkan pengguna? (Warga Ditolak)
  const tWarga_2 = await simulateChatTurn(sessionWarga, "Bagaimana cara menambahkan pengguna?", "WARGA", warga?.id, histWarga);
  assertTest(
    tWarga_2.handledBy === "CONTEXT_RESOLVER" &&
    clean(tWarga_2.response).includes("akses ditolak") &&
    clean(tWarga_2.response).includes("staf desa"),
    "Warga 2: 'Bagaimana cara menambahkan pengguna?' DITOLAK karena Warga tidak berhak menambah user",
    tWarga_2.response
  );

  // Q4: Bagaimana cara memverifikasi pengajuan? (Warga Dijelaskan Wewenang Staf)
  const tWarga_3 = await simulateChatTurn(sessionWarga, "Bagaimana cara memverifikasi pengajuan?", "WARGA", warga?.id, histWarga);
  assertTest(
    tWarga_3.handledBy === "CONTEXT_RESOLVER" &&
    clean(tWarga_3.response).includes("staf desa") &&
    clean(tWarga_3.response).includes("status pengajuan"),
    "Warga 3: 'Bagaimana cara memverifikasi pengajuan?' mengarahkan warga ke menu Status Pengajuan",
    tWarga_3.response
  );

  // Q6: Bagaimana cara mengubah data?
  const tWarga_4 = await simulateChatTurn(sessionWarga, "Bagaimana cara mengubah data?", "WARGA", warga?.id, histWarga);
  assertTest(
    tWarga_4.handledBy === "CONTEXT_RESOLVER" &&
    clean(tWarga_4.response).includes("edit profil") &&
    clean(tWarga_4.response).includes("nik") &&
    clean(tWarga_4.response).includes("alamat domisili"),
    "Warga 4: 'Bagaimana cara mengubah data?' memandu edit profil mandiri di navbar",
    tWarga_4.response
  );

  // Q10: Apa saja fitur yang tidak bisa saya akses?
  const tWarga_5 = await simulateChatTurn(sessionWarga, "Apa saja fitur yang tidak bisa saya akses?", "WARGA", warga?.id, histWarga);
  assertTest(
    tWarga_5.handledBy === "CONTEXT_RESOLVER" &&
    clean(tWarga_5.response).includes("fitur yang dibatasi untuk akun warga") &&
    clean(tWarga_5.response).includes("verifikasi pengajuan") &&
    clean(tWarga_5.response).includes("master layanan"),
    "Warga 5: 'Apa saja fitur yang tidak bisa saya akses?' menjelaskan pembatasan akses warga",
    tWarga_5.response
  );

  // ─────────────────────────────────────────────────────────────────────────
  // BAGIAN 3: PENGUJIAN ROLE SUPERVISOR
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- [BAGIAN 3: SUPERVISOR — Fitur Validasi, Laporan, & Database] ---");
  const sessionSpv = `test_spv_feat_${Date.now()}`;
  clearSessionState(sessionSpv);

  const tSpv_1 = await simulateChatTurn(sessionSpv, "Pada dashboard ada fitur apa saja?", "SUPERVISOR", supervisor?.id);
  assertTest(
    tSpv_1.handledBy === "CONTEXT_RESOLVER" &&
    clean(tSpv_1.response).includes("validasi pengajuan") &&
    clean(tSpv_1.response).includes("laporan & statistik") &&
    clean(tSpv_1.response).includes("database desa") &&
    clean(tSpv_1.response).includes("audit logs"),
    "Supervisor 1: 'Pada dashboard ada fitur apa saja?' menampilkan menu pengawasan, validasi, laporan, dan audit",
    tSpv_1.response
  );

  const tSpv_2 = await simulateChatTurn(sessionSpv, "Di mana saya melihat laporan?", "SUPERVISOR", supervisor?.id);
  assertTest(
    tSpv_2.handledBy === "CONTEXT_RESOLVER" &&
    clean(tSpv_2.response).includes("/supervisor/laporan") &&
    clean(tSpv_2.response).includes("grafik tren"),
    "Supervisor 2: 'Di mana saya melihat laporan?' mengarahkan ke /supervisor/laporan",
    tSpv_2.response
  );

  // ─────────────────────────────────────────────────────────────────────────
  // BAGIAN 4: PENGUJIAN ROLE KEPALA DESA
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- [BAGIAN 4: KEPALA DESA — Approval Pengajuan & Laporan Eksekutif] ---");
  const sessionKades = `test_kades_feat_${Date.now()}`;
  clearSessionState(sessionKades);

  const tKades_1 = await simulateChatTurn(sessionKades, "Pada dashboard ada fitur apa saja?", "KEPALA_DESA", kades?.id);
  assertTest(
    tKades_1.handledBy === "CONTEXT_RESOLVER" &&
    clean(tKades_1.response).includes("approval pengajuan") &&
    clean(tKades_1.response).includes("laporan eksekutif") &&
    clean(tKades_1.response).includes("audit trail"),
    "Kades 1: 'Pada dashboard ada fitur apa saja?' menampilkan menu pimpinan (Approval, Laporan Eksekutif, Audit Trail)",
    tKades_1.response
  );

  const tKades_2 = await simulateChatTurn(sessionKades, "Di mana saya melihat laporan?", "KEPALA_DESA", kades?.id);
  assertTest(
    tKades_2.handledBy === "CONTEXT_RESOLVER" &&
    clean(tKades_2.response).includes("/kades/laporan") &&
    clean(tKades_2.response).includes("laporan eksekutif"),
    "Kades 2: 'Di mana saya melihat laporan?' mengarahkan ke /kades/laporan",
    tKades_2.response
  );

  console.log("\n================================================================================");
  console.log(`HASIL AKHIR: ${testsPassed} / ${totalTests} PENGUJIAN LULUS (${Math.round((testsPassed / totalTests) * 100)}%)`);
  console.log("================================================================================\n");
}

runFeatureTests().catch(console.error).finally(() => process.exit(0));
