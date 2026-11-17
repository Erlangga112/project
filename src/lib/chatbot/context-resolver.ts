import { ChatRole } from "./roles";
import { ConversationState, updateSessionState } from "./memory";
import {
  handleWargaFollowUp,
  handlePengajuanFollowUp,
  handleSuratFollowUp,
  handleStafFollowUp,
  handleStatistikFollowUp,
  handleKadesFollowUp,
  handlePenggunaFollowUp,
  handleDetailPengajuanSingle,
} from "./followup-handlers";
import { handleUserProfileAnswer, handleJumlahRoleAnswer } from "./knowledge-answers";
import { extractServiceCode } from "./intents";
import {
  formatDashboardOverview,
  formatAllMenuFunctions,
  getFeatureByOrderOrId,
  getRestrictedFeaturesExplanation,
  getAddUserGuide,
  getVerificationGuide,
  getReportLocationGuide,
  getDataEditGuide,
  getPostApprovalWorkflowGuide,
  APP_FEATURES,
} from "./app-knowledge";
import {
  resolveActivePage,
  formatPageAwareOverview,
  PageContextPayload,
} from "./page-context";
import prisma from "@/lib/prisma";

export interface ContextResolutionResult {
  handled: boolean;
  response?: string;
  updatedState?: Partial<ConversationState>;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[?!.,;:()\[\]"'\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Mendeteksi apakah pertanyaan bermaksud menanyakan ikhtisar, jumlah, atau daftar menu/fitur aplikasi.
 */
function isFeatureOrMenuOverviewQuery(q: string): boolean {
  // 1. Guard ketat: Jangan memproses jika query menanyakan entitas database spesifik atau batasan akses
  if (
    q.includes("warga") ||
    q.includes("penduduk") ||
    q.includes("pengajuan") ||
    q.includes("berkas") ||
    q.includes("surat") ||
    q.includes("sktm") ||
    q.includes("sku") ||
    q.includes("skd") ||
    q.includes("spk") ||
    q.includes("staf desa") ||
    q.includes("petugas") ||
    q.includes("antrean") ||
    q.includes("tidak bisa") ||
    q.includes("tidak boleh") ||
    q.includes("tidak dapat") ||
    q.includes("dibatasi")
  ) {
    return false;
  }

  // 2. Daftar variasi pertanyaan yang memiliki maksud sama
  const exactQueries = [
    "ada berapa fitur",
    "ada fitur apa saja",
    "fitur apa saja",
    "apa saja fiturnya",
    "fiturnya apa saja",
    "fitur apa yang ada",
    "fitur yang ada apa saja",
    "fitur apa saja yang ada",
    "fitur apa saja yang tersedia",
    "berapa fitur",
    "berapa fitur yang ada",
    "berapa jumlah fitur",
    "jumlah fitur",
    "ada berapa menu",
    "ada menu apa saja",
    "menu apa saja",
    "apa saja menunya",
    "menunya apa saja",
    "menu apa yang ada",
    "menu yang ada apa saja",
    "menu apa saja yang ada",
    "berapa menu",
    "berapa menu yang ada",
    "berapa jumlah menu",
    "jumlah menu",
    "apa saja menu yang tersedia",
    "menu yang tersedia",
    "daftar menu",
    "daftar fitur",
    "sebutkan fitur",
    "sebutkan menu",
    "sebutkan fitur dashboard",
    "sebutkan menu dashboard",
    "bisa jelaskan menu yang ada",
    "bisa jelaskan fitur yang ada",
    "jelaskan menu yang ada",
    "jelaskan fitur yang ada",
    "apa saja yang bisa dilakukan di sini",
    "apa yang bisa dilakukan di sini",
    "apa yang bisa saya lakukan di sini",
    "apa saja yang bisa saya lakukan di sini",
    "bisa apa saja di sini",
    "bisa apa saja",
    "fitur apa yang tersedia di halaman ini",
    "fitur apa yang ada di halaman ini",
    "menu apa yang ada di halaman ini",
    "kalau di halaman ini ada menu apa saja",
    "di halaman ini ada menu apa saja",
    "di halaman ini ada fitur apa saja",
    "menu di sini apa saja",
    "fitur di sini apa saja",
    "ada apa saja di sini",
    "ada fasilitas apa saja",
    "fasilitas apa saja yang ada",
    "pada dashboard ada fitur apa saja",
    "ada berapa fitur pada dashboard",
    "ada berapa menu pada dashboard",
    "fitur apa saja pada dashboard",
    "apa saja fitur di dashboard",
    "dashboard punya menu apa",
  ];

  if (exactQueries.includes(q)) return true;

  // 3. Pencocokan heuristik fleksibel kata fitur/menu + kata tanya
  const hasFeatureWord =
    q.includes("fitur") ||
    q.includes("menu") ||
    q.includes("fasilitas") ||
    ((q.includes("yang bisa dilakukan") || q.includes("bisa saya lakukan")) &&
      (q.includes("sini") || q.includes("halaman") || q.includes("dashboard")));

  const hasInquiryWord =
    q.includes("berapa") ||
    q.includes("apa saja") ||
    q.includes("sebutkan") ||
    q.includes("daftar") ||
    q.includes("jelaskan") ||
    q.includes("tersedia") ||
    q.includes("ada apa") ||
    q.includes("bisa apa") ||
    q.includes("punya apa") ||
    q.includes("di sini") ||
    q.includes("halaman ini") ||
    q.includes("di halaman ini") ||
    q.includes("dashboard");

  if (hasFeatureWord && hasInquiryWord) {
    return true;
  }

  return false;
}

/**
 * Menyelesaikan pertanyaan multi-turn kontekstual berdasarkan state percakapan aktif,
 * mencakup knowledge base fitur aplikasi, alur pelayanan, database riil, dan profil pengguna.
 */
export async function resolveContextualQuestion(
  rawQuery: string,
  state: ConversationState,
  role: ChatRole,
  userId?: string,
  sessionKey?: string,
  pageContext?: PageContextPayload
): Promise<ContextResolutionResult> {
  const q = normalize(rawQuery);

  // ──────────────────────────────────────────────────────────────────────────
  // 0. KEAMANAN & PRIVASI ROLE (Role WARGA / GUEST tidak boleh mengakses data warga lain)
  // ──────────────────────────────────────────────────────────────────────────
  const isWargaPrivacyInquiry =
    (q.includes("warga") ||
      q.includes("penduduk") ||
      q.includes("alamat") ||
      q.includes("nik") ||
      q.includes("domisili") ||
      q.includes("kk")) &&
    (q.includes("siapa") ||
      q.includes("daftar") ||
      q.includes("nama") ||
      q.includes("tampilkan") ||
      q.includes("lihat") ||
      q.includes("sebutkan") ||
      q.includes("tabel") ||
      q.includes("izin"));

  if ((role === "WARGA" || role === "GUEST") && isWargaPrivacyInquiry) {
    return {
      handled: true,
      response:
        "🛡️ **Perlindungan Privasi Warga**: Mohon maaf, demi menjaga kerahasiaan data kependudukan dan privasi warga desa, daftar nama dan informasi pribadi warga hanya dapat diakses oleh aparatur atau staf pelayanan desa yang berwenang.",
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 0B. PERTANYAAN IDENTITAS DIRI SENDIRI (SELF-IDENTITY & PROFILE)
  // ──────────────────────────────────────────────────────────────────────────
  const isSelfIdentityQuery =
    q === "siapa saya" ||
    q === "saya siapa" ||
    q === "siapa nama saya" ||
    q === "nama saya siapa" ||
    q === "saya login sebagai apa" ||
    q === "login sebagai apa" ||
    q === "apa jabatan saya" ||
    q === "jabatan saya apa" ||
    q === "apa peran saya" ||
    q === "peran saya apa" ||
    q === "role saya apa" ||
    q === "siapa yang sedang menggunakan sistem" ||
    q === "siapa yang sedang login" ||
    q === "siapa yang login" ||
    q.includes("siapa saya") ||
    q.includes("saya siapa") ||
    q.includes("nama saya") ||
    q.includes("login sebagai apa") ||
    q.includes("jabatan saya") ||
    q.includes("peran saya") ||
    q.includes("role saya") ||
    q.includes("sedang login") ||
    q.includes("menggunakan sistem");

  if (isSelfIdentityQuery) {
    const res = await handleUserProfileAnswer(userId, role);
    return { handled: true, response: res };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 0B2. PERTANYAAN DAFTAR PENGGUNA SISTEM LANGSUNG ("penggunanya siapa saja", "siapa saja penggunanya", dll)
  // ──────────────────────────────────────────────────────────────────────────
  const isDirectPenggunaListQuery =
    (q.includes("pengguna") || q.includes("user") || q.includes("akun")) &&
    (q.includes("siapa") || q.includes("daftar") || q.includes("sebutkan") || q.includes("apa saja") || q.includes("rincian")) &&
    !q.includes("berapa") &&
    !q.includes("jumlah") &&
    !q.includes("total") &&
    !q.includes("staf") &&
    !q.includes("operator") &&
    !q.includes("warga") &&
    !q.includes("kades");

  if (isDirectPenggunaListQuery) {
    const res = await handlePenggunaFollowUp("LIST", role);
    const newState: Partial<ConversationState> = { entity: "PENGGUNA", lastQuery: rawQuery };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 0B3. PERTANYAAN DAFTAR / JUMLAH ROLE SISTEM LANGSUNG ("ada berapa role", "apa saja rolenya", dll)
  // ──────────────────────────────────────────────────────────────────────────
  const isDirectRoleQuery =
    (q.includes("role") || q.includes("peran")) &&
    (q.includes("berapa") || q.includes("jumlah") || q.includes("total") || q.includes("apa saja") || q.includes("sebutkan") || q.includes("daftar") || q.includes("jenis") || q.includes("macam") || q.includes("ada apa") || q === "role" || q === "peran") &&
    !q.includes("saya") &&
    !q.includes("akun saya") &&
    !q.includes("profil");

  if (isDirectRoleQuery) {
    const isAskingSpecificCount =
      q.includes("berapa") || q.includes("jumlah") || q.includes("total");
    const res = await handleJumlahRoleAnswer(role, isAskingSpecificCount ? "COUNT" : "LIST");
    const newState: Partial<ConversationState> = { entity: "PENGGUNA", lastQuery: rawQuery };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 0C. PERTANYAAN IDENTITAS KEPALA DESA LANGSUNG
  // ──────────────────────────────────────────────────────────────────────────
  if (
    (q.includes("kades") || q.includes("kepala desa")) &&
    (q.includes("siapa") || q.includes("nama") || q.includes("identitas") || q.includes("profil")) &&
    !q.includes("berapa") &&
    !q.includes("jumlah") &&
    !q.includes("pengguna") &&
    !q.includes("user")
  ) {
    const res = await handleKadesFollowUp();
    const newState: Partial<ConversationState> = { entity: "KADES", lastQuery: rawQuery };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 0D. PERTANYAAN DAFTAR STAF LANGSUNG
  // ──────────────────────────────────────────────────────────────────────────
  if (
    (q.includes("staf") || q.includes("operator")) &&
    (q.includes("siapa") || q.includes("nama") || q.includes("daftar") || q.includes("sebutkan")) &&
    !q.includes("berapa") &&
    !q.includes("jumlah") &&
    !q.includes("total")
  ) {
    const res = await handleStafFollowUp("LIST", role);
    const newState: Partial<ConversationState> = { entity: "STAF", lastQuery: rawQuery };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 0E. PERTANYAAN DAFTAR WARGA LANGSUNG
  // ──────────────────────────────────────────────────────────────────────────
  if (
    (q.includes("warga") || q.includes("penduduk") || q.includes("masyarakat")) &&
    (q.includes("siapa") || q.includes("daftar") || q.includes("sebutkan")) &&
    !q.includes("berapa") &&
    !q.includes("jumlah") &&
    !q.includes("total")
  ) {
    const res = await handleWargaFollowUp("LIST", role, userId);
    const newState: Partial<ConversationState> = { entity: "WARGA", lastQuery: rawQuery };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 0F. PERTANYAAN DAFTAR PENGAJUAN LANGSUNG
  // ──────────────────────────────────────────────────────────────────────────
  if (
    (q.includes("pengajuan") || q.includes("permohonan") || q.includes("berkas")) &&
    (q.includes("daftar") || q.includes("sebutkan") || q.includes("tampilkan") || q.includes("apa saja")) &&
    !q.includes("berapa") &&
    !q.includes("jumlah") &&
    !q.includes("total") &&
    !q.includes("syarat") &&
    !q.includes("persyaratan") &&
    !q.includes("salah satu") &&
    !q.includes("detail") &&
    !q.includes("rincian") &&
    !q.includes("kades") &&
    !q.includes("kepala desa") &&
    !q.includes("selesai") &&
    !q.includes("diproses")
  ) {
    const res = await handlePengajuanFollowUp("LIST_PEMOHON", role, userId);
    const newState: Partial<ConversationState> = { entity: "PENGAJUAN", lastQuery: rawQuery };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 0G. PERTANYAAN DETAIL SALAH SATU PENGAJUAN LANGSUNG
  // ──────────────────────────────────────────────────────────────────────────
  if (
    (q.includes("detail") || q.includes("rincian") || q.includes("lihat")) &&
    (q.includes("salah satu") || q.includes("salah 1")) &&
    (q.includes("pengajuan") || q.includes("berkas") || q.includes("permohonan"))
  ) {
    const res = await handleDetailPengajuanSingle(role, userId);
    const newState: Partial<ConversationState> = { entity: "PENGAJUAN", lastQuery: rawQuery };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 0H. PERTANYAAN PENGAJUAN MENUNGGU PENGESAHAN KADES LANGSUNG
  // ──────────────────────────────────────────────────────────────────────────
  if (
    (q.includes("pengajuan") || q.includes("permohonan") || q.includes("berkas")) &&
    (q.includes("kades") || q.includes("kepala desa")) &&
    (q.includes("pengesahan") || q.includes("approval") || q.includes("persetujuan") || q.includes("menunggu"))
  ) {
    const isCount = q.includes("berapa") || q.includes("jumlah") || q.includes("total");
    const action = isCount ? "COUNT" : "FILTER_STATUS";
    const res = await handlePengajuanFollowUp(action, role, userId, {
      statusFilter: ["MENUNGGU_APPROVAL_KEPALA_DESA"],
      statusLabel: "menunggu pengesahan Kepala Desa",
    });
    const newState: Partial<ConversationState> = {
      entity: "PENGAJUAN",
      statusFilter: ["MENUNGGU_APPROVAL_KEPALA_DESA"],
      statusLabel: "menunggu pengesahan Kepala Desa",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. KATEGORI A: PERTANYAAN FITUR APLIKASI & DASHBOARD
  // ──────────────────────────────────────────────────────────────────────────

  // 1A. Ikhtisar Fitur Dashboard & Menu Halaman Aktif
  if (isFeatureOrMenuOverviewQuery(q)) {
    // Selesaikan konteks halaman aktif secara aman (diperiksa terhadap role backend)
    const activeContext = resolveActivePage(role, pageContext);
    const isSpecificInquiry =
      q.includes("halaman ini") || q.includes("di sini") || q.includes("modul ini");

    const { text, featureIds } = formatPageAwareOverview(activeContext, {
      isSpecificInquiry,
    });

    const newState: Partial<ConversationState> = {
      entity: "FITUR",
      lastFeatureList: featureIds,
      activeFeatureId: activeContext.isSpecificPage
        ? activeContext.features[
            activeContext.currentOrder ? activeContext.currentOrder - 1 : 0
          ]?.id
        : undefined,
      activeFeatureName: activeContext.isSpecificPage
        ? activeContext.features[
            activeContext.currentOrder ? activeContext.currentOrder - 1 : 0
          ]?.name
        : undefined,
      activeDashboardName: activeContext.dashboardName,
      activePathname: activeContext.pathname,
      lastQuery: rawQuery,
    };

    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: text, updatedState: newState };
  }

  // 1B. Fungsi Masing-Masing Menu: "Apa fungsi masing-masing menu?"
  if (
    (q.includes("fungsi") || q.includes("kegunaan")) &&
    (q.includes("masing masing") ||
      q.includes("semua menu") ||
      q.includes("setiap menu") ||
      q.includes("seluruh menu") ||
      q.includes("tiap menu"))
  ) {
    const text = formatAllMenuFunctions(role);
    const newState: Partial<ConversationState> = {
      entity: "FITUR",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: text, updatedState: newState };
  }

  // 1C. Bagaimana Cara Menambahkan Pengguna: "Bagaimana cara menambahkan pengguna?"
  if (
    (q.includes("tambah") ||
      q.includes("menambah") ||
      q.includes("membuat") ||
      q.includes("mendaftarkan") ||
      q.includes("registrasi")) &&
    (q.includes("pengguna") ||
      q.includes("user") ||
      q.includes("warga") ||
      q.includes("akun")) &&
    !q.includes("berapa") &&
    !q.includes("jumlah")
  ) {
    const text = getAddUserGuide(role);
    const newState: Partial<ConversationState> = {
      entity: "FITUR",
      activeFeatureId: "staf_data_pengguna",
      activeFeatureName: "Data Pengguna",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: text, updatedState: newState };
  }

  // 1D. Bagaimana Cara Memverifikasi Pengajuan: "Bagaimana cara memverifikasi pengajuan?"
  if (
    (q.includes("cara") ||
      q.includes("bagaimana") ||
      q.includes("sop") ||
      q.includes("alur") ||
      q.includes("langkah")) &&
    (q.includes("verifikasi") ||
      q.includes("memverifikasi") ||
      q.includes("periksa berkas") ||
      q.includes("meneliti berkas")) &&
    !q.includes("apa saja") &&
    !q.includes("daftar")
  ) {
    const text = getVerificationGuide(role);
    const newState: Partial<ConversationState> = {
      entity: "FITUR",
      activeFeatureId: "staf_verifikasi",
      activeFeatureName: "Verifikasi Pengajuan",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: text, updatedState: newState };
  }

  // 1E. Di Mana Melihat Laporan: "Di mana saya melihat laporan?"
  if (
    (q.includes("di mana") ||
      q.includes("dimana") ||
      q.includes("lokasi") ||
      q.includes("melihat") ||
      q.includes("akses")) &&
    (q.includes("laporan") || q.includes("statistik pelayanan")) &&
    !q.includes("berapa") &&
    !q.includes("jumlah")
  ) {
    const text = getReportLocationGuide(role);
    const newState: Partial<ConversationState> = {
      entity: "FITUR",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: text, updatedState: newState };
  }

  // 1F. Bagaimana Cara Mengubah Data: "Bagaimana cara mengubah data?"
  if (
    (q.includes("cara") || q.includes("bagaimana")) &&
    (q.includes("mengubah") ||
      q.includes("ubah") ||
      q.includes("edit") ||
      q.includes("mengedit") ||
      q.includes("memperbarui")) &&
    (q.includes("data") || q.includes("profil") || q.includes("warga"))
  ) {
    const text = getDataEditGuide(role);
    const newState: Partial<ConversationState> = {
      entity: "FITUR",
      activeFeatureId: role === "STAF_DESA" ? "staf_data_pengguna" : "warga_dashboard",
      activeFeatureName: "Data Pengguna",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: text, updatedState: newState };
  }

  // 1G. Fitur yang Tidak Bisa Diakses: "Apa saja fitur yang tidak bisa saya akses?"
  if (
    (q.includes("tidak bisa") ||
      q.includes("tidak dapat") ||
      q.includes("tidak boleh") ||
      q.includes("dibatasi")) &&
    (q.includes("akses") ||
      q.includes("fitur") ||
      q.includes("menu") ||
      q.includes("buka"))
  ) {
    const text = getRestrictedFeaturesExplanation(role);
    const newState: Partial<ConversationState> = {
      entity: "FITUR",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: text, updatedState: newState };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. KATEGORI C: ALUR PELAYANAN DESA
  // ──────────────────────────────────────────────────────────────────────────

  // 2A. Alur Pasca-Approval: "Apa yang terjadi setelah pengajuan disetujui?"
  if (
    (q.includes("setelah") || q.includes("kalau") || q.includes("jika")) &&
    (q.includes("disetujui") || q.includes("approval") || q.includes("tanda tangan")) &&
    (q.includes("bagaimana") ||
      q.includes("apa yang") ||
      q.includes("langkah") ||
      q.includes("terjadi") ||
      q.includes("selanjutnya"))
  ) {
    const text = getPostApprovalWorkflowGuide();
    const newState: Partial<ConversationState> = {
      entity: "ALUR_PELAYANAN",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: text, updatedState: newState };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. KATEGORI E: PERTANYAAN LANJUTAN KONTEKSTUAL FITUR
  // ──────────────────────────────────────────────────────────────────────────

  // 3A. Follow-up: "Apa fungsi yang pertama?", "Menu pertama apa fungsinya?", dll.
  const isFirstMenuFollowUp =
    q.includes("pertama") ||
    q.includes("ke 1") ||
    q.includes("ke-1") ||
    q.includes("nomor 1") ||
    q.includes("no 1") ||
    q === "apa fungsi yang pertama" ||
    q === "apa fungsi menu pertama tadi" ||
    q === "fungsi menu pertama";

  if (isFirstMenuFollowUp && (state.entity === "FITUR" || state.lastFeatureList)) {
    const feature = getFeatureByOrderOrId(role, 1, state.lastFeatureList);
    if (feature) {
      const resp =
        `📌 **Fungsi Menu ke-1: ${feature.name} (\`${feature.route}\`)**\n\n` +
        `${feature.functionDetails}\n\n` +
        `• **Hak Akses:** ${feature.allowedRoles.join(", ")}\n` +
        `• **Data yang Digunakan:** ${feature.dataUsed.join(", ")}\n\n` +
        `💡 *Ketik "Bagaimana cara menggunakannya?" atau "Apakah saya bisa mengedit data?" untuk panduan lanjutan.*`;

      const newState: Partial<ConversationState> = {
        entity: "FITUR",
        activeFeatureId: feature.id,
        activeFeatureName: feature.name,
      };
      if (sessionKey) updateSessionState(sessionKey, newState);
      return { handled: true, response: resp, updatedState: newState };
    }
  }

  // 3B. Follow-up: "Apa fungsi yang kedua?", "Menu kedua apa fungsinya?"
  const isSecondMenuFollowUp =
    q.includes("kedua") ||
    q.includes("ke 2") ||
    q.includes("ke-2") ||
    q.includes("nomor 2") ||
    q.includes("no 2");

  if (isSecondMenuFollowUp && (state.entity === "FITUR" || state.lastFeatureList)) {
    const feature = getFeatureByOrderOrId(role, 2, state.lastFeatureList);
    if (feature) {
      const resp =
        `📌 **Fungsi Menu ke-2: ${feature.name} (\`${feature.route}\`)**\n\n` +
        `${feature.functionDetails}\n\n` +
        `• **Hak Akses:** ${feature.allowedRoles.join(", ")}\n` +
        `• **Data yang Digunakan:** ${feature.dataUsed.join(", ")}\n\n` +
        `💡 *Ketik "Bagaimana cara menggunakannya?" atau "Apakah saya bisa mengedit data?" untuk panduan lanjutan.*`;

      const newState: Partial<ConversationState> = {
        entity: "FITUR",
        activeFeatureId: feature.id,
        activeFeatureName: feature.name,
      };
      if (sessionKey) updateSessionState(sessionKey, newState);
      return { handled: true, response: resp, updatedState: newState };
    }
  }

  // 3C. Follow-up: "Apa fungsi yang ketiga?"
  const isThirdMenuFollowUp =
    q.includes("ketiga") ||
    q.includes("ke 3") ||
    q.includes("ke-3") ||
    q.includes("nomor 3") ||
    q.includes("no 3");

  if (isThirdMenuFollowUp && (state.entity === "FITUR" || state.lastFeatureList)) {
    const feature = getFeatureByOrderOrId(role, 3, state.lastFeatureList);
    if (feature) {
      const resp =
        `📌 **Fungsi Menu ke-3: ${feature.name} (\`${feature.route}\`)**\n\n` +
        `${feature.functionDetails}\n\n` +
        `• **Hak Akses:** ${feature.allowedRoles.join(", ")}\n` +
        `• **Data yang Digunakan:** ${feature.dataUsed.join(", ")}\n\n` +
        `💡 *Ketik "Bagaimana cara menggunakannya?" atau "Apakah saya bisa mengedit data?" untuk panduan lanjutan.*`;

      const newState: Partial<ConversationState> = {
        entity: "FITUR",
        activeFeatureId: feature.id,
        activeFeatureName: feature.name,
      };
      if (sessionKey) updateSessionState(sessionKey, newState);
      return { handled: true, response: resp, updatedState: newState };
    }
  }

  // 3D. Follow-up: "Apa fungsi yang keempat?"
  const isFourthMenuFollowUp =
    q.includes("keempat") ||
    q.includes("ke 4") ||
    q.includes("ke-4") ||
    q.includes("nomor 4") ||
    q.includes("no 4");

  if (isFourthMenuFollowUp && (state.entity === "FITUR" || state.lastFeatureList)) {
    const feature = getFeatureByOrderOrId(role, 4, state.lastFeatureList);
    if (feature) {
      const resp =
        `📌 **Fungsi Menu ke-4: ${feature.name} (\`${feature.route}\`)**\n\n` +
        `${feature.functionDetails}\n\n` +
        `• **Hak Akses:** ${feature.allowedRoles.join(", ")}\n` +
        `• **Data yang Digunakan:** ${feature.dataUsed.join(", ")}\n\n` +
        `💡 *Ketik "Bagaimana cara menggunakannya?" atau "Apakah saya bisa mengedit data?" untuk panduan lanjutan.*`;

      const newState: Partial<ConversationState> = {
        entity: "FITUR",
        activeFeatureId: feature.id,
        activeFeatureName: feature.name,
      };
      if (sessionKey) updateSessionState(sessionKey, newState);
      return { handled: true, response: resp, updatedState: newState };
    }
  }

  // 3D.2. Follow-up: "Apa fungsi yang kelima?"
  const isFifthMenuFollowUp =
    q.includes("kelima") ||
    q.includes("ke 5") ||
    q.includes("ke-5") ||
    q.includes("nomor 5") ||
    q.includes("no 5");

  if (isFifthMenuFollowUp && (state.entity === "FITUR" || state.lastFeatureList)) {
    const feature = getFeatureByOrderOrId(role, 5, state.lastFeatureList);
    if (feature) {
      const resp =
        `📌 **Fungsi Menu ke-5: ${feature.name} (\`${feature.route}\`)**\n\n` +
        `${feature.functionDetails}\n\n` +
        `• **Hak Akses:** ${feature.allowedRoles.join(", ")}\n` +
        `• **Data yang Digunakan:** ${feature.dataUsed.join(", ")}\n\n` +
        `💡 *Ketik "Bagaimana cara menggunakannya?" atau "Apakah saya bisa mengedit data?" untuk panduan lanjutan.*`;

      const newState: Partial<ConversationState> = {
        entity: "FITUR",
        activeFeatureId: feature.id,
        activeFeatureName: feature.name,
      };
      if (sessionKey) updateSessionState(sessionKey, newState);
      return { handled: true, response: resp, updatedState: newState };
    }
  }

  // 3E. Follow-up: "Bagaimana cara menggunakannya?" / "Bagaimana cara pakainya?"
  const isUsageFollowUp =
    q === "bagaimana cara menggunakannya" ||
    q === "bagaimana cara pakainya" ||
    q === "cara pakainya gimana" ||
    q === "cara menggunakannya" ||
    q === "langkah penggunaannya apa" ||
    q.includes("cara menggunakannya") ||
    q.includes("cara pakainya");

  if (isUsageFollowUp && (state.entity === "FITUR" || state.activeFeatureId || state.lastFeatureList)) {
    // Cari fitur aktif, atau default ke fitur pertama jika belum dipilih
    const targetFeature = state.activeFeatureId
      ? APP_FEATURES[state.activeFeatureId]
      : getFeatureByOrderOrId(role, 1, state.lastFeatureList);

    if (targetFeature) {
      const resp =
        `📖 **Panduan Penggunaan: ${targetFeature.name} (\`${targetFeature.route}\`)**\n\n` +
        `${targetFeature.usageGuide}\n\n` +
        `• **Peran yang Diizinkan:** ${targetFeature.allowedRoles.join(", ")}\n` +
        `• **Kemampuan Edit:** ${targetFeature.editDetails}`;

      return { handled: true, response: resp };
    }
  }

  // 3F. Follow-up: "Apakah saya bisa mengedit data?" / "Bisa edit data tidak?"
  const isEditPermissionFollowUp =
    q === "apakah saya bisa mengedit data" ||
    q === "apakah bisa mengedit data" ||
    q === "bisa edit data tidak" ||
    q === "bisa edit data" ||
    q === "bisa mengedit data" ||
    q.includes("mengedit data") ||
    q.includes("edit data");

  if (isEditPermissionFollowUp && (state.entity === "FITUR" || state.activeFeatureId || state.lastFeatureList)) {
    const targetFeature = state.activeFeatureId
      ? APP_FEATURES[state.activeFeatureId]
      : getFeatureByOrderOrId(role, 1, state.lastFeatureList);

    if (targetFeature) {
      const canOrNot = targetFeature.canEdit
        ? `✅ **Ya, peran Anda (${role}) dapat melakukan perubahan/tindakan data pada fitur ini.**`
        : `ℹ️ **Pada fitur ini, akses Anda adalah pemantauan/baca (read-only).**`;

      const resp =
        `✏️ **Wewenang Edit pada Fitur ${targetFeature.name}:**\n\n` +
        `${canOrNot}\n\n` +
        `• **Rincian Hak Akses:** ${targetFeature.editDetails}\n` +
        `• **Basis Data yang Terpengaruh:** ${targetFeature.dataUsed.join(", ")}`;

      return { handled: true, response: resp };
    }
    // Jika tidak ada fitur spesifik, berikan panduan edit umum sesuai role
    return { handled: true, response: getDataEditGuide(role) };
  }

  // 3G. Follow-up: "Siapa saja yang bisa mengaksesnya?" / "Siapa yang bisa akses?"
  const isAccessPermissionFollowUp =
    (q.includes("siapa") || q.includes("role apa") || q.includes("siapa saja") || q.includes("pihak mana")) &&
    (q.includes("mengakses") ||
      q.includes("akses") ||
      q.includes("buka") ||
      q.includes("gunakan") ||
      q.includes("menggunakan") ||
      q.includes("izin"));

  if (isAccessPermissionFollowUp && (state.entity === "FITUR" || state.activeFeatureId || state.lastFeatureList)) {
    const targetFeature = state.activeFeatureId
      ? APP_FEATURES[state.activeFeatureId]
      : getFeatureByOrderOrId(role, 1, state.lastFeatureList);

    if (targetFeature) {
      const roleMap: Record<string, string> = {
        STAF_DESA: "Staf Desa / Operator Pelayanan (`STAF_DESA`)",
        WARGA: "Warga Desa (`WARGA`)",
        SUPERVISOR: "Supervisor Pelayanan (`SUPERVISOR`)",
        KEPALA_DESA: "Kepala Desa / Pimpinan (`KEPALA_DESA`)",
        ADMIN: "Administrator Sistem (`ADMIN`)",
      };

      const allowedRolesFormatted = targetFeature.allowedRoles
        .map((r) => roleMap[r] || r)
        .join(", ");

      const resp =
        `🔐 **Hak Akses Fitur: ${targetFeature.name} (\`${targetFeature.route}\`)**\n\n` +
        `Fitur ini memiliki izin akses yang dikonfigurasi untuk peran:\n` +
        `• **${allowedRolesFormatted}**\n\n` +
        `🛡️ **Penjelasan Otorisasi Sistem:**\n` +
        `Sistem Pelayanan Desa Terpadu menerapkan pembatasan hak akses berbasis peran (*Role-Based Access Control* / RBAC) yang diverifikasi langsung di server melalui sesi login autentikasi. Peran lain yang tidak memiliki izin tidak dapat membuka antrean atau memproses tindakan pada modul ini demi menjaga integritas data dan keamanan administrasi desa.\n\n` +
        `💡 *Ketik "Bagaimana cara menggunakannya?" atau "Apakah saya bisa mengedit data?" untuk panduan lanjutan.*`;

      return { handled: true, response: resp };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. KATEGORI B: KUERI DATABASE AKTUAL VIA PRISMA (REAL-TIME DATA)
  // ──────────────────────────────────────────────────────────────────────────

  // 4A. Pertanyaan Langsung: Pengajuan yang Perlu Diverifikasi (Status DIAJUKAN & DIPERIKSA)
  const isVerificationQuery =
    q.includes("perlu diverifikasi") ||
    q.includes("harus diverifikasi") ||
    q.includes("butuh verifikasi") ||
    q.includes("menunggu verifikasi") ||
    q.includes("belum diverifikasi") ||
    q.includes("antrean verifikasi");

  if (
    isVerificationQuery &&
    (q.includes("pengajuan") ||
      q.includes("berkas") ||
      q.includes("apa saja") ||
      q.includes("daftar") ||
      q.includes("mana") ||
      q.includes("berapa") ||
      q.includes("ada apa") ||
      q.startsWith("apa saja") ||
      q === "pengajuan apa saja yang perlu diverifikasi" ||
      q === "pengajuan yang perlu diverifikasi")
  ) {
    const isCountOnly =
      (q.includes("berapa") || q.includes("jumlah") || q.includes("total")) &&
      !q.includes("apa saja") &&
      !q.includes("daftar") &&
      !q.includes("mana");

    const action = isCountOnly ? "COUNT" : "FILTER_STATUS";
    const res = await handlePengajuanFollowUp(action, role, userId, {
      statusFilter: ["DIAJUKAN", "DIPERIKSA"],
      statusLabel: "memerlukan verifikasi",
    });
    const newState: Partial<ConversationState> = {
      entity: "PENGAJUAN",
      statusFilter: ["DIAJUKAN", "DIPERIKSA"],
      statusLabel: "memerlukan verifikasi",
      serviceCode: undefined,
      serviceName: undefined,
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // 4B. Pertanyaan Langsung: "Siapa yang sudah mengajukan SKTM?" / "Siapa pemohon SKTM?"
  const srv = extractServiceCode(q);
  if (
    srv &&
    (q.includes("siapa") || q.includes("daftar") || q.includes("nama") || q.includes("pemohon")) &&
    (q.includes("mengajukan") || q.includes("membuat") || q.includes("ajukan") || q.includes("punya"))
  ) {
    const res = await handleSuratFollowUp("LIST_PEMOHON", srv.code, srv.name, role, userId);
    const newState: Partial<ConversationState> = {
      entity: "SURAT",
      serviceCode: srv.code,
      serviceName: srv.name,
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // 4C. Pertanyaan Langsung: "Berapa pengajuan SKTM?" / "Berapa pengajuan SKU?"
  if (srv && (q.includes("berapa") || q.includes("jumlah") || q.includes("total")) && q.includes("pengajuan")) {
    const res = await handleSuratFollowUp("COUNT", srv.code, srv.name, role, userId);
    const newState: Partial<ConversationState> = {
      entity: "SURAT",
      serviceCode: srv.code,
      serviceName: srv.name,
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // 4D. Pertanyaan Langsung: "Ada berapa warga yang terdaftar?" / "Berapa jumlah warga?"
  if (
    (q.includes("warga") || q.includes("penduduk")) &&
    (q.includes("terdaftar") || q.includes("jumlah") || q.includes("berapa") || q.includes("ada berapa")) &&
    !q.includes("staf") &&
    !q.includes("pengajuan")
  ) {
    if (role === "WARGA" || role === "GUEST") {
      return {
        handled: true,
        response:
          "🛡️ **Akses Terbatas**: Demi menjaga privasi data kependudukan dan keamanan administrasi desa, rekapitulasi data kependudukan hanya dapat diakses oleh petugas pelayanan atau staf desa yang berwenang.",
      };
    }
    const res = await handleWargaFollowUp("COUNT", role, userId);
    const newState: Partial<ConversationState> = {
      entity: "WARGA",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // 4E. Pertanyaan Langsung: "Berapa jumlah staf?" / "Berapa jumlah staf desa?"
  if (
    (q.includes("staf") || q.includes("petugas") || q.includes("operator")) &&
    (q.includes("berapa") || q.includes("jumlah") || q.includes("total"))
  ) {
    const res = await handleStafFollowUp("COUNT", role);
    const newState: Partial<ConversationState> = {
      entity: "STAF",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // 4F. Pertanyaan Langsung: "Berapa pengajuan bulan ini?"
  if (
    (q.includes("pengajuan") || q.includes("berkas")) &&
    (q.includes("bulan ini") || q.includes("periode ini")) &&
    (q.includes("berapa") || q.includes("jumlah") || q.includes("total"))
  ) {
    const res = await handleStatistikFollowUp("BULAN_INI", role);
    const newState: Partial<ConversationState> = {
      entity: "STATISTIK",
      timeFilter: "BULAN_INI",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // 4G. Pertanyaan Langsung: "Ada berapa pengajuan selesai?" / "Berapa yang sudah selesai?"
  if (
    (q.includes("pengajuan") || q.includes("permohonan") || q.includes("berkas")) &&
    (q.includes("selesai") || q.includes("sudah selesai") || q.includes("telah selesai") || q.includes("sudah terbit") || q.includes("sudah diterbitkan"))
  ) {
    const isCount =
      (q.includes("berapa") || q.includes("jumlah") || q.includes("total")) &&
      !q.includes("mana") &&
      !q.includes("apa saja") &&
      !q.includes("daftar") &&
      !q.includes("sebutkan");
    const action = isCount ? "COUNT" : "FILTER_STATUS";
    const res = await handlePengajuanFollowUp(action, role, userId, {
      statusFilter: ["SELESAI"],
      statusLabel: "selesai",
    });
    const newState: Partial<ConversationState> = {
      entity: "PENGAJUAN",
      statusFilter: ["SELESAI"],
      statusLabel: "selesai",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // 4H. Pertanyaan Langsung: "Ada berapa pengajuan ditolak?"
  if (
    (q.includes("pengajuan") || q.includes("permohonan") || q.includes("berkas")) &&
    (q.includes("ditolak") || q.includes("tidak disetujui") || q.includes("penolakan"))
  ) {
    const isCount =
      (q.includes("berapa") || q.includes("jumlah") || q.includes("total")) &&
      !q.includes("mana") &&
      !q.includes("apa saja") &&
      !q.includes("daftar") &&
      !q.includes("sebutkan");
    const action = isCount ? "COUNT" : "FILTER_STATUS";
    const res = await handlePengajuanFollowUp(action, role, userId, {
      statusFilter: ["DITOLAK"],
      statusLabel: "ditolak",
    });
    const newState: Partial<ConversationState> = {
      entity: "PENGAJUAN",
      statusFilter: ["DITOLAK"],
      statusLabel: "ditolak",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // 4I. Pertanyaan Langsung: "Ada berapa pengajuan yang masih diproses?" / "Pengajuan yang aktif?"
  if (
    (q.includes("pengajuan") || q.includes("permohonan") || q.includes("berkas")) &&
    (q.includes("diproses") || q.includes("dalam proses") || q.includes("aktif") ||
     q.includes("belum selesai") || q.includes("tertunda") || q.includes("masih diproses") ||
     q.includes("sedang diproses") || q.includes("berjalan"))
  ) {
    const isCount =
      (q.includes("berapa") || q.includes("jumlah") || q.includes("total")) &&
      !q.includes("mana") &&
      !q.includes("apa saja") &&
      !q.includes("daftar") &&
      !q.includes("sebutkan");
    const action = isCount ? "COUNT" : "FILTER_STATUS";
    const statusDiproses = ["DIAJUKAN", "DIPERIKSA", "PERLU_PERBAIKAN", "MENUNGGU_VALIDASI", "DISETUJUI_SUPERVISOR", "MENUNGGU_APPROVAL_KEPALA_DESA", "DISETUJUI"];
    const res = await handlePengajuanFollowUp(action, role, userId, {
      statusFilter: statusDiproses,
      statusLabel: "sedang diproses",
    });
    const newState: Partial<ConversationState> = {
      entity: "PENGAJUAN",
      statusFilter: statusDiproses,
      statusLabel: "sedang diproses",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // 4J. Pertanyaan Langsung: "Berapa pengajuan menunggu validasi?"
  if (
    (q.includes("pengajuan") || q.includes("permohonan") || q.includes("berkas")) &&
    (q.includes("menunggu validasi") || q.includes("butuh validasi") || q.includes("belum divalidasi") ||
     q.includes("perlu validasi") || q.includes("menunggu verifikasi") || q.includes("belum diverifikasi") ||
     (q.includes("validasi") && (q.includes("berapa") || q.includes("jumlah") || q.includes("total"))))
  ) {
    const isCount =
      (q.includes("berapa") || q.includes("jumlah") || q.includes("total")) &&
      !q.includes("mana") &&
      !q.includes("apa saja") &&
      !q.includes("daftar") &&
      !q.includes("sebutkan");
    const action = isCount ? "COUNT" : "FILTER_STATUS";
    const res = await handlePengajuanFollowUp(action, role, userId, {
      statusFilter: ["MENUNGGU_VALIDASI"],
      statusLabel: "menunggu validasi",
    });
    const newState: Partial<ConversationState> = {
      entity: "PENGAJUAN",
      statusFilter: ["MENUNGGU_VALIDASI"],
      statusLabel: "menunggu validasi",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // 4M. Pertanyaan Langsung: "Berapa pengajuan yang disetujui?" (sinkron dengan widget Dashboard Supervisor)
  // Definisi disetujui = DISETUJUI_SUPERVISOR + MENUNGGU_APPROVAL_KEPALA_DESA + DISETUJUI + SELESAI
  if (
    (q.includes("pengajuan") || q.includes("permohonan") || q.includes("berkas")) &&
    (q.includes("disetujui") || q.includes("sudah disetujui") || q.includes("telah disetujui") || q.includes("yang disetujui")) &&
    !q.includes("tidak disetujui") &&
    !q.includes("belum disetujui")
  ) {
    const isCount =
      (q.includes("berapa") || q.includes("jumlah") || q.includes("total") || q.includes("ada berapa")) &&
      !q.includes("mana") &&
      !q.includes("apa saja") &&
      !q.includes("daftar") &&
      !q.includes("sebutkan");
    const action = isCount ? "COUNT" : "FILTER_STATUS";
    const statusDisetujui = ["DISETUJUI_SUPERVISOR", "MENUNGGU_APPROVAL_KEPALA_DESA", "DISETUJUI", "SELESAI"];
    const res = await handlePengajuanFollowUp(action, role, userId, {
      statusFilter: statusDisetujui,
      statusLabel: "disetujui",
    });
    const newState: Partial<ConversationState> = {
      entity: "PENGAJUAN",
      statusFilter: statusDisetujui,
      statusLabel: "disetujui",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // 4K. Pertanyaan Langsung: "Ada berapa pengajuan?" (total semua, tanpa filter status spesifik)
  if (
    (q.includes("pengajuan") || q.includes("permohonan")) &&
    (q.includes("berapa") || q.includes("jumlah") || q.includes("total") || q.includes("ada berapa")) &&
    !q.includes("selesai") && !q.includes("ditolak") && !q.includes("diproses") &&
    !q.includes("validasi") && !q.includes("verifikasi") && !q.includes("bulan") &&
    !q.includes("aktif") && !q.includes("tertunda") && !q.includes("berjalan")
  ) {
    const totalPengajuan = await prisma.pengajuanLayanan.count();
    const statusGroup = await prisma.pengajuanLayanan.groupBy({ by: ["status"], _count: { id: true } });
    const sm: Record<string, number> = {};
    for (const s of statusGroup) sm[s.status] = s._count.id;

    let res = `📊 **Total Pengajuan Pelayanan:** **${totalPengajuan} permohonan**\n\n`;
    res += `Rincian berdasarkan status:\n`;
    if (sm["DIAJUKAN"])                     res += `• Baru Masuk (Menunggu Pemeriksaan): **${sm["DIAJUKAN"]}**\n`;
    if (sm["DIPERIKSA"])                    res += `• Sedang Diperiksa Operator: **${sm["DIPERIKSA"]}**\n`;
    if (sm["PERLU_PERBAIKAN"])              res += `• Perlu Perbaikan oleh Warga: **${sm["PERLU_PERBAIKAN"]}**\n`;
    if (sm["MENUNGGU_VALIDASI"])            res += `• Menunggu Validasi Supervisor: **${sm["MENUNGGU_VALIDASI"]}**\n`;
    if (sm["DISETUJUI_SUPERVISOR"])         res += `• Disetujui Supervisor: **${sm["DISETUJUI_SUPERVISOR"]}**\n`;
    if (sm["MENUNGGU_APPROVAL_KEPALA_DESA"]) res += `• Menunggu Pengesahan Kepala Desa: **${sm["MENUNGGU_APPROVAL_KEPALA_DESA"]}**\n`;
    if (sm["DISETUJUI"])                    res += `• Disetujui Kepala Desa: **${sm["DISETUJUI"]}**\n`;
    if (sm["SELESAI"])                      res += `• Selesai / Surat Diterbitkan: **${sm["SELESAI"]}**\n`;
    if (sm["DITOLAK"])                      res += `• Ditolak: **${sm["DITOLAK"]}**\n`;

    const newState: Partial<ConversationState> = {
      entity: "PENGAJUAN",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. PERTANYAAN LANJUTAN MULTI-TURN DATA (WARGA, PENGAJUAN, SURAT, STAF, STATISTIK)
  // ──────────────────────────────────────────────────────────────────────────

  // Sub-filter spesifik layanan dalam konteks pengajuan aktif: misal "Mana yang SKTM?", "Kalau yang SKTM?"
  const srvFollowUp = extractServiceCode(q);
  if (
    state.entity === "PENGAJUAN" &&
    srvFollowUp &&
    (q.includes("mana") ||
      q.includes("kalau") ||
      q.includes("yang") ||
      q.includes("daftar") ||
      q.includes("lihat") ||
      q.includes("apa saja") ||
      q === "mana yang sktm" ||
      q === "yang sktm mana" ||
      q === "yang sktm")
  ) {
    const res = await handlePengajuanFollowUp("FILTER_STATUS", role, userId, {
      statusFilter: state.statusFilter,
      statusLabel: state.statusLabel || "memerlukan verifikasi",
      serviceCode: srvFollowUp.code,
      serviceName: srvFollowUp.name,
    });
    const newState: Partial<ConversationState> = {
      serviceCode: srvFollowUp.code,
      serviceName: srvFollowUp.name,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // Follow-up nama pemohon: "Siapa nama pemohonnya?", "Siapa pemohonnya?"
  const isApplicantNameFollowUp =
    q === "siapa nama pemohonnya" ||
    q === "siapa pemohonnya" ||
    q === "siapa saja pemohonnya" ||
    q === "siapa yang mengajukan" ||
    q === "siapa saja yang mengajukan" ||
    q.includes("nama pemohon") ||
    q.includes("siapa pemohon") ||
    q.includes("siapa yang mengajukan");

  // Follow-up status disetujui: "Mana yang sudah disetujui?", "Berapa yang sudah disetujui?"
  const isApprovedFollowUp =
    q.includes("sudah disetujui") ||
    q.includes("yang disetujui") ||
    q.includes("telah disetujui") ||
    q === "mana yang sudah disetujui" ||
    q === "pengajuan mana yang sudah disetujui" ||
    q === "yang sudah disetujui" ||
    q === "yang disetujui" ||
    q === "kalau yang sudah disetujui" ||
    q === "berapa yang sudah disetujui";

  // Follow-up status menunggu verifikasi: "Mana yang masih menunggu verifikasi?", "Siapa yang belum diverifikasi?"
  const isPendingFilterFollowUp =
    q === "mana yang masih menunggu verifikasi" ||
    q === "siapa yang belum diverifikasi" ||
    q === "mana yang belum diverifikasi" ||
    q === "yang belum diverifikasi" ||
    q === "yang masih menunggu verifikasi" ||
    q.includes("menunggu verifikasi") ||
    q.includes("belum diverifikasi");

  // Follow-up selesai: "Mana yang sudah selesai?"
  const isCompletedFilterFollowUp =
    q === "mana yang sudah selesai" ||
    q === "yang sudah selesai" ||
    q === "pengajuan yang sudah selesai" ||
    q === "pengajuan mana saja yang sudah selesai" ||
    q === "yang sudah selesai apa saja" ||
    q === "apa saja yang sudah selesai" ||
    q === "apa saja yang selesai" ||
    q === "pengajuan mana yang sudah selesai" ||
    q.includes("sudah selesai") ||
    (q.includes("selesai") && (q.includes("mana") || q.includes("apa saja") || q.includes("daftar") || q.includes("yang")));

  // Follow-up pengesahan Kepala Desa
  const isKadesApprovalFilterFollowUp =
    (q.includes("kades") || q.includes("kepala desa")) &&
    (q.includes("pengesahan") || q.includes("approval") || q.includes("persetujuan") || q.includes("ttd") || q.includes("tanda tangan") || q.includes("menunggu"));

  // Follow-up detail salah satu pengajuan
  const isDetailSingleFollowUp =
    q.includes("salah satu") ||
    q.includes("salah 1") ||
    q === "tampilkan detail salah satu pengajuan" ||
    q === "detail salah satu pengajuan" ||
    q === "lihat detail salah satu pengajuan" ||
    q === "tampilkan salah satu pengajuan" ||
    q === "detail salah satu berkas" ||
    q.includes("detail salah satu") ||
    q.includes("rincian salah satu");

  // Follow-up daftar / siapa saja / apa saja
  const isListFollowUp =
    q === "siapa" ||
    q === "siapa saja" ||
    q === "siapa aja" ||
    q === "apa saja" ||
    q === "apa aja" ||
    q === "apa saja yang masuk" ||
    q === "apa saja pengajuannya" ||
    q === "pengajuan apa saja yang masuk" ||
    q === "pengajuan apa saja" ||
    q === "siapa saja yang terdaftar" ||
    q === "siapa saja namanya" ||
    q === "siapa namanya" ||
    q === "namanya siapa" ||
    q === "siapa warganya" ||
    q === "siapa saja warganya" ||
    q === "siapa stafnya" ||
    q === "siapa saja stafnya" ||
    q === "siapa mereka" ||
    q === "siapa saja mereka" ||
    q === "bisa disebutkan" ||
    q === "tolong sebutkan" ||
    q === "sebutkan" ||
    q === "sebutkan namanya" ||
    q === "sebutkan nama mereka" ||
    q === "sebutkan warganya" ||
    q === "sebutkan stafnya" ||
    q === "sebutkan pengajuannya" ||
    q === "sebutkan semua pengajuan" ||
    q === "sebutkan daftarnya" ||
    q === "sebutkan daftar pengajuannya" ||
    q === "tampilkan daftarnya" ||
    q === "tampilkan daftar" ||
    q === "tampilkan daftar pengajuan" ||
    q === "daftar pengajuannya" ||
    q === "daftar pengajuan" ||
    q === "bisa lihat rinciannya" ||
    q === "lihat rinciannya" ||
    q === "yang mana saja" ||
    q === "mana saja" ||
    q === "daftarnya apa saja" ||
    q === "daftarnya siapa saja" ||
    q.includes("apa saja") ||
    q.includes("apa aja") ||
    q.includes("siapa saja") ||
    q.includes("siapa aja") ||
    q.includes("namanya siapa") ||
    q.includes("siapa namanya") ||
    q.includes("daftar nama") ||
    q.includes("sebutkan nama") ||
    q.includes("bisa disebutkan") ||
    q.includes("sebutkan daftarnya") ||
    q.includes("tampilkan daftarnya") ||
    q.includes("tampilkan daftar") ||
    q.includes("sebutkan warga") ||
    q.includes("sebutkan staf") ||
    q.includes("sebutkan pengajuan") ||
    q.includes("sebutkan semua pengajuan") ||
    q.includes("lihat rincian") ||
    q.includes("yang mana saja") ||
    q.includes("daftar pengajuan");

  // Follow-up detail data / alamat
  const isDetailFollowUp =
    q === "tampilkan datanya" ||
    q === "tampilkan data" ||
    q === "tampilkan detailnya" ||
    q === "tampilkan rinciannya" ||
    q === "tampilkan alamatnya" ||
    q === "tampilkan alamatnya jika saya memiliki izin" ||
    q.includes("tampilkan datanya") ||
    q.includes("tampilkan alamatnya") ||
    q.includes("tampilkan data") ||
    q.includes("tampilkan nama dan tanggalnya") ||
    q.includes("lihat datanya") ||
    q.includes("rincian datanya");

  // Follow-up status berkas
  const isStatusFollowUp =
    q === "bagaimana statusnya" ||
    q === "statusnya bagaimana" ||
    q === "sudah selesai belum" ||
    q === "gimana statusnya" ||
    q === "cek statusnya" ||
    q.includes("bagaimana statusnya") ||
    q.includes("status pengajuannya");

  // Follow-up tugas staf
  const isTaskFollowUp =
    q === "apa tugas mereka" ||
    q === "apa tugasnya" ||
    q === "tugasnya apa" ||
    q === "siapa yang bertugas memverifikasi" ||
    q === "apa saja tugas mereka" ||
    q.includes("tugas mereka") ||
    q.includes("tugas staf") ||
    q.includes("bertugas memverifikasi");

  // Follow-up bulan lalu
  const isLastMonthFollowUp =
    q === "bagaimana kalau bulan lalu" ||
    q === "kalau bulan lalu" ||
    q === "bagaimana bulan lalu" ||
    q === "bulan lalu bagaimana" ||
    q === "berapa bulan lalu" ||
    q.includes("bulan lalu") ||
    q.includes("bulan kemarin");

  // Follow-up tren
  const isTrendFollowUp =
    q === "apakah jumlahnya meningkat atau menurun" ||
    q === "meningkat atau menurun" ||
    q === "tren pengajuan" ||
    q.includes("meningkat atau menurun") ||
    q.includes("naik atau turun");

  // 5A. KONTEKS: DATA WARGA
  if (state.entity === "WARGA") {
    if (isListFollowUp || isApplicantNameFollowUp) {
      const res = await handleWargaFollowUp("LIST", role, userId);
      return { handled: true, response: res };
    }
    if (isDetailFollowUp) {
      const res = await handleWargaFollowUp("DETAIL", role, userId);
      return { handled: true, response: res };
    }
    // Guard: jika query mengandung kata kunci pengajuan, JANGAN tangkap sebagai WARGA
    if (
      (q.includes("berapa") || q.includes("jumlah") || q.includes("total")) &&
      !q.includes("pengajuan") &&
      !q.includes("permohonan") &&
      !q.includes("berkas")
    ) {
      const res = await handleWargaFollowUp("COUNT", role, userId);
      return { handled: true, response: res };
    }
  }

  // 5B. KONTEKS: DATA SURAT SPESIFIK (SKTM, SKU, SKD, SPK)
  if (state.entity === "SURAT" && state.serviceCode) {
    const sName = state.serviceName || state.serviceCode;

    if (isApplicantNameFollowUp || isListFollowUp) {
      const res = await handleSuratFollowUp("LIST_PEMOHON", state.serviceCode, sName, role, userId);
      return { handled: true, response: res };
    }
    if (isApprovedFollowUp) {
      const res = await handleSuratFollowUp("DISETUJUI", state.serviceCode, sName, role, userId);
      return { handled: true, response: res };
    }
    if (isCompletedFilterFollowUp) {
      const res = await handleSuratFollowUp("SELESAI", state.serviceCode, sName, role, userId);
      return { handled: true, response: res };
    }
    if (isStatusFollowUp) {
      const res = await handleSuratFollowUp("STATUS_BREAKDOWN", state.serviceCode, sName, role, userId);
      return { handled: true, response: res };
    }
    if (q.includes("berapa") || q.includes("jumlah")) {
      const res = await handleSuratFollowUp("COUNT", state.serviceCode, sName, role, userId);
      return { handled: true, response: res };
    }
  }

  // 5C. KONTEKS: DATA PENGAJUAN
  if (state.entity === "PENGAJUAN") {
    // Detail salah satu pengajuan
    if (isDetailSingleFollowUp) {
      const res = await handleDetailPengajuanSingle(role, userId);
      return { handled: true, response: res };
    }

    // Nama pemohon
    if (isApplicantNameFollowUp) {
      const res = await handlePengajuanFollowUp("NAMES_ONLY", role, userId, {
        statusFilter: state.statusFilter,
        statusLabel: state.statusLabel || "yang tercatat di sistem",
        serviceCode: state.serviceCode,
        serviceName: state.serviceName,
      });
      return { handled: true, response: res };
    }

    // Pengajuan menunggu pengesahan Kepala Desa
    if (isKadesApprovalFilterFollowUp) {
      const isCount = q.includes("berapa") || q.includes("jumlah") || q.includes("total");
      const action = isCount ? "COUNT" : "FILTER_STATUS";
      const newStatus = ["MENUNGGU_APPROVAL_KEPALA_DESA"];
      const label = "menunggu pengesahan Kepala Desa";
      const res = await handlePengajuanFollowUp(action, role, userId, {
        statusFilter: newStatus,
        statusLabel: label,
      });
      const newState: Partial<ConversationState> = {
        statusFilter: newStatus,
        statusLabel: label,
        serviceCode: undefined,
        serviceName: undefined,
      };
      if (sessionKey) updateSessionState(sessionKey, newState);
      return { handled: true, response: res, updatedState: newState };
    }

    if (isApprovedFollowUp) {
      const isCount = q.includes("berapa") || q.includes("jumlah") || q.includes("total");
      const action = isCount ? "COUNT" : "FILTER_STATUS";
      // Definisi "disetujui" identik dengan widget Dashboard Supervisor:
      // DISETUJUI_SUPERVISOR + MENUNGGU_APPROVAL_KEPALA_DESA + DISETUJUI + SELESAI
      const newStatus = ["DISETUJUI_SUPERVISOR", "MENUNGGU_APPROVAL_KEPALA_DESA", "DISETUJUI", "SELESAI"];
      const label = "disetujui";
      const res = await handlePengajuanFollowUp(action, role, userId, {
        statusFilter: newStatus,
        statusLabel: label,
      });
      const newState: Partial<ConversationState> = {
        statusFilter: newStatus,
        statusLabel: label,
        serviceCode: undefined,
        serviceName: undefined,
      };
      if (sessionKey) updateSessionState(sessionKey, newState);
      return { handled: true, response: res, updatedState: newState };
    }

    if (isPendingFilterFollowUp) {
      const isCount = q.includes("berapa") || q.includes("jumlah") || q.includes("total");
      const action = isCount ? "COUNT" : "FILTER_STATUS";
      const newStatus = ["DIAJUKAN", "DIPERIKSA"];
      const label = "memerlukan verifikasi";
      const res = await handlePengajuanFollowUp(action, role, userId, {
        statusFilter: newStatus,
        statusLabel: label,
      });
      const newState: Partial<ConversationState> = {
        statusFilter: newStatus,
        statusLabel: label,
        serviceCode: undefined,
        serviceName: undefined,
      };
      if (sessionKey) updateSessionState(sessionKey, newState);
      return { handled: true, response: res, updatedState: newState };
    }

    if (isCompletedFilterFollowUp) {
      const isCount = q.includes("berapa") || q.includes("jumlah") || q.includes("total");
      const action = isCount ? "COUNT" : "FILTER_STATUS";
      const newStatus = ["SELESAI"];
      const label = "selesai";
      const res = await handlePengajuanFollowUp(action, role, userId, {
        statusFilter: newStatus,
        statusLabel: label,
      });
      const newState: Partial<ConversationState> = {
        statusFilter: newStatus,
        statusLabel: label,
        serviceCode: undefined,
        serviceName: undefined,
      };
      if (sessionKey) updateSessionState(sessionKey, newState);
      return { handled: true, response: res, updatedState: newState };
    }

    // Follow-up: "Kalau yang ditolak?" / "Yang ditolak berapa?"
    const isRejectedFilterFollowUp =
      q.includes("ditolak") ||
      q.includes("tidak disetujui") ||
      q === "yang ditolak" ||
      q === "kalau yang ditolak" ||
      q === "berapa yang ditolak";

    if (isRejectedFilterFollowUp) {
      const isCount = q.includes("berapa") || q.includes("jumlah") || q.includes("total");
      const action = isCount ? "COUNT" : "FILTER_STATUS";
      const newStatus = ["DITOLAK"];
      const label = "ditolak";
      const res = await handlePengajuanFollowUp(action, role, userId, {
        statusFilter: newStatus,
        statusLabel: label,
      });
      const newState: Partial<ConversationState> = {
        statusFilter: newStatus,
        statusLabel: label,
        serviceCode: undefined,
        serviceName: undefined,
      };
      if (sessionKey) updateSessionState(sessionKey, newState);
      return { handled: true, response: res, updatedState: newState };
    }

    // Follow-up: "Yang masih diproses?" / "Kalau yang masih berjalan?"
    const isInProgressFilterFollowUp =
      q.includes("masih diproses") ||
      q.includes("sedang diproses") ||
      q.includes("dalam proses") ||
      q.includes("aktif") ||
      q.includes("berjalan") ||
      q === "yang masih diproses" ||
      q === "kalau yang masih diproses" ||
      q === "yang sedang diproses";

    if (isInProgressFilterFollowUp) {
      const isCount = q.includes("berapa") || q.includes("jumlah") || q.includes("total");
      const action = isCount ? "COUNT" : "FILTER_STATUS";
      const statusDiproses = ["DIAJUKAN", "DIPERIKSA", "PERLU_PERBAIKAN", "MENUNGGU_VALIDASI", "DISETUJUI_SUPERVISOR", "MENUNGGU_APPROVAL_KEPALA_DESA", "DISETUJUI"];
      const label = "sedang diproses";
      const res = await handlePengajuanFollowUp(action, role, userId, {
        statusFilter: statusDiproses,
        statusLabel: label,
      });
      const newState: Partial<ConversationState> = {
        statusFilter: statusDiproses,
        statusLabel: label,
        serviceCode: undefined,
        serviceName: undefined,
      };
      if (sessionKey) updateSessionState(sessionKey, newState);
      return { handled: true, response: res, updatedState: newState };
    }

    // Follow-up: "Yang menunggu validasi?"
    const isValidasiFilterFollowUp =
      q.includes("menunggu validasi") ||
      q.includes("butuh validasi") ||
      q.includes("belum divalidasi") ||
      q.includes("perlu validasi") ||
      q.includes("menunggu verifikasi") ||
      q.includes("belum diverifikasi") ||
      q === "yang menunggu validasi" ||
      q === "kalau yang belum divalidasi";

    if (isValidasiFilterFollowUp) {
      const isCount = q.includes("berapa") || q.includes("jumlah") || q.includes("total");
      const action = isCount ? "COUNT" : "FILTER_STATUS";
      const newStatus = ["MENUNGGU_VALIDASI"];
      const label = "menunggu validasi";
      const res = await handlePengajuanFollowUp(action, role, userId, {
        statusFilter: newStatus,
        statusLabel: label,
      });
      const newState: Partial<ConversationState> = {
        statusFilter: newStatus,
        statusLabel: label,
        serviceCode: undefined,
        serviceName: undefined,
      };
      if (sessionKey) updateSessionState(sessionKey, newState);
      return { handled: true, response: res, updatedState: newState };
    }

    if (isDetailFollowUp) {
      const res = await handlePengajuanFollowUp("FILTER_STATUS", role, userId, {
        statusFilter: state.statusFilter,
        statusLabel: state.statusLabel,
        serviceCode: state.serviceCode,
        serviceName: state.serviceName,
      });
      return { handled: true, response: res };
    }

    // Permintaan daftar pengajuan umum (Apa saja? / Sebutkan pengajuannya / dsb)
    if (isListFollowUp) {
      const res = await handlePengajuanFollowUp("LIST_PEMOHON", role, userId, {
        statusFilter: state.statusFilter,
        statusLabel: state.statusLabel,
        serviceCode: state.serviceCode,
        serviceName: state.serviceName,
      });
      return { handled: true, response: res };
    }
  }

  // 5D. KONTEKS: DATA STAF / OPERATOR
  if (state.entity === "STAF") {
    if (isListFollowUp || isApplicantNameFollowUp) {
      const res = await handleStafFollowUp("LIST", role);
      return { handled: true, response: res };
    }
    if (isTaskFollowUp) {
      const res = await handleStafFollowUp("DUTIES", role);
      return { handled: true, response: res };
    }
  }

  // 5F. KONTEKS: DATA KEPALA DESA / PIMPINAN
  if (state.entity === "KADES") {
    if (isListFollowUp || isApplicantNameFollowUp || q === "siapa" || q.includes("siapa") || q.includes("nama")) {
      const res = await handleKadesFollowUp();
      return { handled: true, response: res };
    }
  }

  // 5G. KONTEKS: DATA SELURUH PENGGUNA SISTEM / USER
  if (state.entity === "PENGGUNA") {
    if (
      q.includes("role") ||
      q.includes("peran") ||
      q.includes("apa saja rolenya") ||
      q.includes("apa saja peran")
    ) {
      const isAskingSpecificCount =
        q.includes("berapa") || q.includes("jumlah") || q.includes("total");
      const res = await handleJumlahRoleAnswer(role, isAskingSpecificCount ? "COUNT" : "LIST");
      return { handled: true, response: res };
    }
    if (isListFollowUp || isApplicantNameFollowUp || q === "siapa" || q === "siapa saja" || q.includes("siapa") || q.includes("daftar")) {
      const res = await handlePenggunaFollowUp("LIST", role);
      return { handled: true, response: res };
    }
    if (isDetailFollowUp) {
      const res = await handlePenggunaFollowUp("DETAIL", role);
      return { handled: true, response: res };
    }
  }

  // 5E. KONTEKS: STATISTIK BULANAN & TREN
  if (state.entity === "STATISTIK") {
    if (isLastMonthFollowUp) {
      const res = await handleStatistikFollowUp("BULAN_LALU", role);
      const newState: Partial<ConversationState> = {
        timeFilter: "BULAN_LALU",
      };
      if (sessionKey) updateSessionState(sessionKey, newState);
      return { handled: true, response: res, updatedState: newState };
    }
    if (isTrendFollowUp) {
      const res = await handleStatistikFollowUp("TREND", role);
      return { handled: true, response: res };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. PERTANYAAN STANDALONE TANPA MENUNGGU ENTITAS
  // ──────────────────────────────────────────────────────────────────────────
  if (isApprovedFollowUp) {
    const isCount = q.includes("berapa") || q.includes("jumlah") || q.includes("total");
    const action = isCount ? "COUNT" : "FILTER_STATUS";
    const res = await handlePengajuanFollowUp(action, role, userId, {
      statusFilter: ["DISETUJUI", "DISETUJUI_SUPERVISOR"],
      statusLabel: "sudah disetujui",
    });
    const newState: Partial<ConversationState> = {
      entity: "PENGAJUAN",
      statusFilter: ["DISETUJUI", "DISETUJUI_SUPERVISOR"],
      statusLabel: "sudah disetujui",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  if (isPendingFilterFollowUp) {
    const isCount = q.includes("berapa") || q.includes("jumlah") || q.includes("total");
    const action = isCount ? "COUNT" : "FILTER_STATUS";
    const res = await handlePengajuanFollowUp(action, role, userId, {
      statusFilter: ["DIAJUKAN", "DIPERIKSA"],
      statusLabel: "memerlukan verifikasi",
    });
    const newState: Partial<ConversationState> = {
      entity: "PENGAJUAN",
      statusFilter: ["DIAJUKAN", "DIPERIKSA"],
      statusLabel: "memerlukan verifikasi",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  if (isTaskFollowUp) {
    const res = await handleStafFollowUp("DUTIES", role);
    const newState: Partial<ConversationState> = {
      entity: "STAF",
      lastQuery: rawQuery,
    };
    if (sessionKey) updateSessionState(sessionKey, newState);
    return { handled: true, response: res, updatedState: newState };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. KLARIFIKASI JIKA PERTANYAAN SINGKAT AMBIGU TANPA KONTEKS SEBELUMNYA
  // ──────────────────────────────────────────────────────────────────────────
  if (
    (isListFollowUp || isDetailFollowUp || isApplicantNameFollowUp || q === "siapa") &&
    (!state.entity || state.entity === "NONE")
  ) {
    return {
      handled: true,
      response:
        "Mohon maaf, Anda ingin melihat daftar siapa? Anda dapat melihat:\n\n" +
        "1. 👥 **Daftar Warga Terdaftar** (ketik: *Siapa saja warganya?*)\n" +
        "2. 👔 **Daftar Staf Pelayanan** (ketik: *Siapa saja stafnya?*)\n" +
        "3. 🏛️ **Informasi Kepala Desa** (ketik: *Siapa Kepala Desa?*)\n" +
        "4. 📋 **Daftar Pengajuan Surat** (ketik: *Sebutkan daftar pengajuannya*)\n" +
        "5. 👤 **Identitas Akun Anda** (ketik: *Siapa saya?*)",
    };
  }

  return { handled: false };
}
