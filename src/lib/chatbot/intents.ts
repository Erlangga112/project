export type ChatbotIntent =
  | "PROFIL_PENGGUNA"
  | "ANTREAN_PELAYANAN"
  | "PENGAJUAN_BARU"
  | "DAFTAR_LAYANAN"
  | "SOP_PELAYANAN"
  | "JAM_PELAYANAN"
  | "STATUS_NOTIFIKASI"
  | "CARI_WARGA"
  | "JUMLAH_WARGA"
  | "WARGA_AKTIF"
  | "WARGA_PINDAH"
  | "TOTAL_AKUN"
  | "JUMLAH_STAF"
  | "JUMLAH_SUPERVISOR"
  | "JUMLAH_KADES"
  | "PENGAJUAN_TOTAL"
  | "PENGAJUAN_DISETUJUI"
  | "PENGAJUAN_SELESAI"
  | "PENGAJUAN_DITOLAK"
  | "PENGAJUAN_DIPROSES"
  | "PENGAJUAN_MENUNGGU_VALIDASI"
  | "PENGAJUAN_BELUM_SELESAI"
  | "RINGKASAN_BULAN_INI"
  | "STATISTIK_PENGAJUAN"
  | "STATISTIK_SISTEM"
  | "BUAT_SURAT"
  | "STATUS_SURAT"
  | "SYARAT_SURAT"
  | "PANDUAN_CETAK"
  | "KONFIRMASI_BUAT_SURAT"
  | "JUMLAH_ROLE"
  | "UNKNOWN";

export interface IntentDetectionResult {
  intent: ChatbotIntent;
  confidence: number;
  matchedPattern?: string;
  serviceCode?: string;
  serviceName?: string;
  isAmbiguous?: boolean;
}

/**
 * Normalisasi teks untuk deteksi intent (lowercase, koreksi typo umum & pembersihan tanda baca)
 */
function normalizeText(text: string): string {
  let cleaned = text
    .toLowerCase()
    .replace(/[?!.,;:()\[\]"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Koreksi typo & singkatan umum bahasa Indonesia
  cleaned = cleaned
    .replace(/\bkeseruhan\b/g, "seluruh")
    .replace(/\bkeseluruhan\b/g, "seluruh")
    .replace(/\bsemua\b/g, "seluruh")
    .replace(/\bpenguna\b/g, "pengguna")
    .replace(/\bjumblah\b/g, "jumlah")
    .replace(/\bjml\b/g, "jumlah")
    .replace(/\bbrp\b/g, "berapa")
    .replace(/\btot\b/g, "total")
    .replace(/\bantrian\b/g, "antrean")
    .replace(/\bstatisik\b/g, "statistik")
    .replace(/\brekapan\b/g, "rekap")
    .replace(/\brolenya\b/g, "role")
    .replace(/\bperannya\b/g, "peran")
    .replace(/\bjabatannya\b/g, "jabatan");

  return cleaned;
}

export function extractServiceCode(text: string): { code: string; name: string } | undefined {
  const t = text.toLowerCase();
  if (t.includes("sktm") || t.includes("tidak mampu") || t.includes("kurang mampu") || t.includes("pra sejahtera") || t.includes("pra-sejahtera") || t.includes("beasiswa")) {
    return { code: "SKTM-01", name: "Surat Keterangan Tidak Mampu (SKTM)" };
  }
  if (t.includes("domisili") || t.includes("tempat tinggal") || t.includes("skd") || t.includes("tinggal di perum")) {
    return { code: "SKD-01", name: "Surat Keterangan Domisili (SKD)" };
  }
  if (t.includes("sku") || t.includes("usaha") || t.includes("bisnis") || t.includes("umkm") || t.includes("toko") || t.includes("dagang") || t.includes("warung")) {
    return { code: "SKU-01", name: "Surat Keterangan Usaha (SKU)" };
  }
  if (t.includes("kependudukan") || t.includes("pengantar ktp") || t.includes("pengantar kk") || t.includes("kartu keluarga") || t.includes("akta") || t.includes("spk")) {
    return { code: "SPK-01", name: "Surat Pengantar Administrasi Kependudukan" };
  }
  return undefined;
}

/**
 * Mendeteksi maksud (intent) pertanyaan pengguna seputar statistik & data sistem
 */
export function detectQuestionIntent(query: string): IntentDetectionResult {
  const q = normalizeText(query);

  // ── 0. INTENT MENGENALI PENGGUNA (USER IDENTITY & PROFILE AWARENESS) ────
  // Contoh: "saya siapa", "siapa saya", "siapa nama saya", "nama saya siapa", "profil saya",
  // "akun saya", "info akun", "data saya", "role saya", "siapa yang sedang login", "peran saya"
  const isProfileQuestion =
    q === "saya siapa" ||
    q === "siapa saya" ||
    q.includes("saya siapa") ||
    q.includes("siapa saya") ||
    q.includes("nama saya") ||
    q.includes("nama ku") ||
    q.includes("namaku") ||
    q.includes("siapa nama saya") ||
    q.includes("profil saya") ||
    q.includes("profilku") ||
    q.includes("data profil") ||
    q.includes("akun saya") ||
    q.includes("info akun") ||
    q.includes("informasi akun") ||
    q.includes("detail akun") ||
    q.includes("identitas saya") ||
    q.includes("siapa yang sedang login") ||
    q.includes("siapa yang login") ||
    q.includes("login sebagai apa") ||
    q.includes("saya login sebagai") ||
    q.includes("peran saya") ||
    q.includes("role saya") ||
    q.includes("wewenang saya") ||
    q.includes("tugas saya") ||
    q.includes("jabatan saya") ||
    q.includes("apa jabatan saya") ||
    q.includes("siapa yang sedang menggunakan sistem") ||
    q.includes("menggunakan sistem") ||
    q.includes("pengguna saat ini") ||
    q === "data saya" ||
    q.includes("informasi diri saya") ||
    q.includes("tentang saya");

  if (isProfileQuestion) {
    return {
      intent: "PROFIL_PENGGUNA",
      confidence: 1.0,
      matchedPattern: "profil_pengguna",
    };
  }

  // ── 0a2. PERTANYAAN TENTANG JUMLAH ROLE / PERAN DALAM SISTEM ────
  // Contoh: "ada berapa role", "berapa jumlah role", "role apa saja", "apa saja rolenya", "ada berapa peran",
  // "peran apa saja di sistem", "sebutkan semua role"
  const isRoleSystemQuestion =
    ((q.includes("berapa") || q.includes("ada berapa") || q.includes("jumlah")) &&
      (q.includes("role") || q.includes("peran")) &&
      !q.includes("saya")) ||
    (q.includes("role apa saja") || q.includes("peran apa saja")) ||
    (q.includes("apa saja") && (q.includes("role") || q.includes("peran"))) ||
    (q.includes("sebutkan") && (q.includes("role") || q.includes("peran")) && !q.includes("saya")) ||
    (q.includes("daftar role") || q.includes("daftar peran")) ||
    (q.includes("jenis role") || q.includes("jenis peran")) ||
    (q.includes("macam role") || q.includes("macam peran")) ||
    (q.includes("tipe pengguna") || q.includes("jenis pengguna")) ||
    (q === "role" || q === "peran" || q === "apa saja role" || q === "apa saja peran");

  if (isRoleSystemQuestion) {
    return {
      intent: "JUMLAH_ROLE",
      confidence: 0.95,
      matchedPattern: "jumlah_role_sistem",
    };
  }

  // ── 0b. ANTREAN PELAYANAN & BERKAS YANG PERLU DIPROSES ──────────
  // Contoh: "berapa pengajuan yang perlu diproses", "pengajuan yang perlu diproses",
  // "tampilkan ringkasan antrean pengajuan", "antrean saat ini", "daftar antrean", "antrean berkas"
  if (
    q.includes("perlu diproses") ||
    q.includes("perlu ditindaklanjuti") ||
    q.includes("ringkasan antrean") ||
    q.includes("ringkasan antrian") ||
    q.includes("antrean pengajuan") ||
    q.includes("antrian pengajuan") ||
    q.includes("antrean saat ini") ||
    q.includes("antrian saat ini") ||
    q.includes("daftar antrean") ||
    q.includes("daftar antrian") ||
    q.includes("antrean berkas") ||
    q.includes("antrian berkas") ||
    q.includes("antrean pelayanan") ||
    q.includes("antrian pelayanan") ||
    q === "antrean" ||
    q === "antrian"
  ) {
    return {
      intent: "ANTREAN_PELAYANAN",
      confidence: 0.95,
      matchedPattern: "antrean_pelayanan",
    };
  }

  // ── 0c. PENGAJUAN BARU MASUK (DIAJUKAN) ──────────────────────────
  // Contoh: "pengajuan baru masuk", "berkas baru masuk", "daftar pengajuan baru", "pengajuan baru"
  if (
    (q.includes("baru masuk") || q.includes("pengajuan baru") || q.includes("berkas baru")) &&
    !q.includes("buat") &&
    !q.includes("ajukan") &&
    !q.includes("bikin")
  ) {
    return {
      intent: "PENGAJUAN_BARU",
      confidence: 0.95,
      matchedPattern: "pengajuan_baru",
    };
  }

  // ── 0d. DAFTAR MASTER LAYANAN DESA ───────────────────────────────
  // Contoh: "apa saja layanan surat yang ada", "layanan apa saja", "daftar layanan", "jenis surat", "layanan desa"
  if (
    (q.includes("apa saja layanan") ||
      q.includes("layanan apa saja") ||
      q.includes("daftar layanan") ||
      q.includes("jenis layanan") ||
      q.includes("jenis surat") ||
      q.includes("layanan yang ada") ||
      q.includes("layanan yang tersedia") ||
      q.includes("surat apa saja yang ada") ||
      q.includes("surat apa saja yang bisa dibuat") ||
      q.includes("master layanan")) &&
    !q.includes("syarat") &&
    !q.includes("persyaratan")
  ) {
    return {
      intent: "DAFTAR_LAYANAN",
      confidence: 0.95,
      matchedPattern: "daftar_layanan",
    };
  }

  // ── 0e. STANDARD OPERATING PROCEDURE (SOP) & ALUR VERIFIKASI ────
  // Contoh: "bagaimana sop pemeriksaan berkas", "sop verifikasi", "alur verifikasi", "alur pengajuan", "alur pelayanan"
  if (
    q.includes("sop") ||
    q.includes("alur verifikasi") ||
    q.includes("alur pemeriksaan") ||
    q.includes("alur pengajuan") ||
    q.includes("prosedur pengajuan") ||
    q.includes("tahapan pengajuan") ||
    q.includes("tahapan verifikasi") ||
    q.includes("alur berjenjang") ||
    q.includes("prosedur pelayanan")
  ) {
    return {
      intent: "SOP_PELAYANAN",
      confidence: 0.95,
      matchedPattern: "sop_pelayanan",
    };
  }

  // ── 0f. JAM OPERASIONAL & INFORMASI KANTOR DESA ─────────────────
  // Contoh: "jam pelayanan kantor desa", "jam buka", "jam operasional", "alamat kantor desa", "biaya pengajuan"
  if (
    q.includes("jam pelayanan") ||
    q.includes("jam operasional") ||
    q.includes("jam kantor") ||
    q.includes("jam kerja") ||
    q.includes("jam buka") ||
    q.includes("kapan buka") ||
    q.includes("kantor desa tutup") ||
    q.includes("alamat kantor") ||
    q.includes("lokasi kantor") ||
    q.includes("biaya surat") ||
    q.includes("biaya pengajuan") ||
    q.includes("biaya pelayanan") ||
    q.includes("apakah gratis") ||
    q.includes("apakah berbayar")
  ) {
    return {
      intent: "JAM_PELAYANAN",
      confidence: 0.95,
      matchedPattern: "jam_pelayanan",
    };
  }

  // ── 0g. STATUS & LOG NOTIFIKASI SISTEM ───────────────────────────
  // Contoh: "status notifikasi", "log notifikasi", "notifikasi whatsapp", "notifikasi email"
  if (
    q.includes("notifikasi sistem") ||
    q.includes("log notifikasi") ||
    q.includes("status notifikasi") ||
    (q.includes("notifikasi") && (q.includes("email") || q.includes("whatsapp") || q.includes("wa") || q.includes("kirim") || q.includes("terkirim")))
  ) {
    return {
      intent: "STATUS_NOTIFIKASI",
      confidence: 0.9,
      matchedPattern: "status_notifikasi",
    };
  }

  // ── 0h. PENCARIAN DATA WARGA (APARATUR DESA) ─────────────────────
  // Contoh: "cari data warga Budi", "cari warga", "data warga atas nama"
  if (
    (q.startsWith("cari warga") ||
      q.startsWith("cari data warga") ||
      q.startsWith("cek warga") ||
      q.startsWith("cek data warga") ||
      q.includes("data warga atas nama")) &&
    !q.includes("jumlah") &&
    !q.includes("total")
  ) {
    return {
      intent: "CARI_WARGA",
      confidence: 0.9,
      matchedPattern: "cari_warga",
    };
  }

  // ── A. INTENT PELAYANAN SURAT WARGA ────────────────────────────

  // A1. KONFIRMASI PEMBUATAN SURAT
  // Contoh: "ya ajukan sekarang", "ya buatkan", "konfirmasi ajukan", "setuju ajukan", "ajukan permohonan"
  const isConfirmKeywords =
    q === "ya" ||
    q === "ya ajukan" ||
    q.includes("ajukan sekarang") ||
    q.includes("ya buatkan") ||
    q.includes("ya ajukan") ||
    q.includes("konfirmasi ajukan") ||
    q.includes("setuju ajukan") ||
    q.includes("kirim permohonan") ||
    q.includes("lanjutkan pengajuan") ||
    q.includes("buatkan sekarang");

  if (isConfirmKeywords) {
    const srv = extractServiceCode(q);
    return {
      intent: "KONFIRMASI_BUAT_SURAT",
      confidence: 0.95,
      matchedPattern: "konfirmasi_buat_surat",
      serviceCode: srv?.code,
      serviceName: srv?.name,
    };
  }

  // A2. PANDUAN CETAK & UNDUH PDF
  // Contoh: "bagaimana cara mencetak surat yang sudah disetujui", "cara cetak surat", "cara unduh pdf"
  if (
    (q.includes("cetak") || q.includes("mencetak") || q.includes("unduh") || q.includes("download") || q.includes("print")) &&
    (q.includes("surat") || q.includes("pdf") || q.includes("dokumen") || q.includes("sktm") || q.includes("disetujui") || q.includes("selesai"))
  ) {
    const srv = extractServiceCode(q);
    return {
      intent: "PANDUAN_CETAK",
      confidence: 0.95,
      matchedPattern: "panduan_cetak",
      serviceCode: srv?.code,
      serviceName: srv?.name,
    };
  }

  // A3. CEK STATUS & DAFTAR PENGAJUAN SURAT SAYA
  // Contoh: "tampilkan pengajuan surat saya", "cek pengajuan surat saya", "status pengajuan saya", "surat saya sampai mana"
  if (
    (q.includes("tampilkan") || q.includes("lihat") || q.includes("cek") || q.includes("status") || q.includes("daftar") || q.includes("lacak") || q.includes("mana")) &&
    (q.includes("pengajuan saya") ||
      q.includes("surat saya") ||
      q.includes("permohonan saya") ||
      q.includes("berkas saya") ||
      q.includes("pengajuanku") ||
      q.includes("suratku") ||
      q.includes("pengajuan surat") ||
      q === "cek status" ||
      q === "status pengajuan")
  ) {
    return {
      intent: "STATUS_SURAT",
      confidence: 0.95,
      matchedPattern: "status_surat",
    };
  }

  // A4. PERSYARATAN DOKUMEN SURAT
  // Contoh: "apa persyaratan membuat surat keterangan usaha", "syarat sktm apa saja", "syarat buat domisili"
  if (
    (q.includes("syarat") || q.includes("persyaratan") || q.includes("butuh apa") || q.includes("dokumen apa")) &&
    (q.includes("surat") || q.includes("sktm") || q.includes("sku") || q.includes("domisili") || q.includes("kependudukan") || q.includes("membuat") || q.includes("bikin"))
  ) {
    const srv = extractServiceCode(q);
    return {
      intent: "SYARAT_SURAT",
      confidence: 0.95,
      matchedPattern: "syarat_surat",
      serviceCode: srv?.code,
      serviceName: srv?.name,
    };
  }

  // A5. PEMBUATAN / PENGAJUAN SURAT
  // Contoh: "saya ingin membuat sktm", "tolong buatkan surat domisili", "mau bikin sku", "ajukan sktm"
  if (
    (q.includes("buat") || q.includes("buatkan") || q.includes("bikin") || q.includes("ajukan") || q.includes("mengajukan") || q.includes("butuh") || q.includes("minta") || q.includes("urus")) &&
    (q.includes("surat") || q.includes("sktm") || q.includes("sku") || q.includes("domisili") || q.includes("kependudukan"))
  ) {
    const srv = extractServiceCode(q);
    return {
      intent: "BUAT_SURAT",
      confidence: 0.95,
      matchedPattern: "buat_surat",
      serviceCode: srv?.code,
      serviceName: srv?.name,
    };
  }

  // ── B. INTENT STATISTIK KEPENDUDUKAN, PENGGUNA & SISTEM ──────────────────

  const hasCountKeywords =
    q.includes("berapa") ||
    q.includes("jumlah") ||
    q.includes("total") ||
    q.includes("ada berapa") ||
    q.includes("banyak") ||
    q.includes("populasi") ||
    q.includes("hitung") ||
    q.includes("rekap") ||
    q.includes("statistik") ||
    q.includes("seluruh") ||
    q.includes("daftar");

  // B0. STATISTIK SISTEM SECARA KESELURUHAN (Seluruh Data / Rekap Sistem)
  // Contoh: "berapa total seluruh data", "total seluruh data", "ringkasan seluruh data", "rekap data sistem", "statistik sistem"
  if (
    (q.includes("seluruh data") ||
      q.includes("semua data") ||
      q.includes("data sistem") ||
      q.includes("statistik sistem") ||
      q.includes("rekap sistem") ||
      q.includes("total sistem") ||
      q.includes("total semuanya") ||
      q.includes("rekap data desa") ||
      q.includes("ringkasan data")) &&
    !q.includes("pengguna") &&
    !q.includes("user") &&
    !q.includes("warga") &&
    !q.includes("pengajuan")
  ) {
    return { intent: "STATISTIK_SISTEM", confidence: 0.95, matchedPattern: "statistik_sistem" };
  }

  // B1. STATISTIK PENGGUNA / AKUN (TOTAL_AKUN)
  // Mendeteksi: "berapa jumlah keseruhan data pengguna", "berapa jumlah seluruh data pengguna",
  // "total pengguna", "jumlah pengguna", "data pengguna", "total user", "berapa user", "semua akun", dll.
  const isAskingPengguna =
    q.includes("pengguna") ||
    q.includes("user") ||
    q.includes("akun") ||
    q.includes("data pengguna");

  if (isAskingPengguna) {
    if (q.includes("staf") || q.includes("operator") || q.includes("petugas")) {
      return { intent: "JUMLAH_STAF", confidence: 0.95, matchedPattern: "jumlah_staf" };
    }
    if (q.includes("supervisor")) {
      return { intent: "JUMLAH_SUPERVISOR", confidence: 0.95, matchedPattern: "jumlah_supervisor" };
    }
    if (
      (q.includes("kades") || q.includes("kepala desa")) &&
      !q.includes("pengguna") &&
      !q.includes("user")
    ) {
      return { intent: "JUMLAH_KADES", confidence: 0.95, matchedPattern: "jumlah_kades" };
    }
    if (q.includes("warga") || q.includes("penduduk") || q.includes("masyarakat")) {
      if (q.includes("aktif")) {
        return { intent: "WARGA_AKTIF", confidence: 0.95, matchedPattern: "warga_aktif" };
      }
      if (q.includes("pindah")) {
        return { intent: "WARGA_PINDAH", confidence: 0.95, matchedPattern: "warga_pindah" };
      }
      return { intent: "JUMLAH_WARGA", confidence: 0.95, matchedPattern: "jumlah_warga" };
    }

    // Jika menanyakan jumlah, total, rekap, statistik, atau "data pengguna" secara umum
    if (
      hasCountKeywords ||
      q.includes("data pengguna") ||
      q.includes("daftar pengguna") ||
      q === "pengguna" ||
      q === "user"
    ) {
      return { intent: "TOTAL_AKUN", confidence: 0.95, matchedPattern: "total_akun" };
    }
  }

  // B2. STATISTIK WARGA & KEPENDUDUKAN
  // Contoh: "berapa jumlah warga aktif", "berapa warga yang aktif"
  if (
    (q.includes("warga") || q.includes("penduduk") || q.includes("masyarakat")) &&
    (q.includes("aktif") || q.includes("status aktif"))
  ) {
    return { intent: "WARGA_AKTIF", confidence: 0.95, matchedPattern: "warga_aktif" };
  }

  // Contoh: "berapa yang sudah pindah", "berapa warga pindah", "jumlah warga yang pindah"
  if (
    q.includes("pindah") &&
    (q.includes("warga") || q.includes("penduduk") || q.includes("berapa") || q.includes("jumlah") || q.includes("yang sudah"))
  ) {
    return { intent: "WARGA_PINDAH", confidence: 0.95, matchedPattern: "warga_pindah" };
  }

  // Contoh: "berapa jumlah warga", "ada berapa warga yang terdaftar", "total warga", "jumlah warga"
  const isAskingWarga =
    (q.includes("warga") || q.includes("masyarakat") || q.includes("penduduk")) &&
    !q.includes("staf") &&
    !q.includes("operator") &&
    !q.includes("kades") &&
    !q.includes("supervisor");

  if (isAskingWarga && hasCountKeywords) {
    return { intent: "JUMLAH_WARGA", confidence: 0.95, matchedPattern: "jumlah_warga" };
  }

  // B3. STATISTIK STAF DESA / OPERATOR
  if (
    (q.includes("staf") || q.includes("operator") || q.includes("petugas")) &&
    hasCountKeywords
  ) {
    return { intent: "JUMLAH_STAF", confidence: 0.95, matchedPattern: "jumlah_staf" };
  }

  // B4. STATISTIK SUPERVISOR & KEPALA DESA
  if (q.includes("supervisor") && hasCountKeywords) {
    return { intent: "JUMLAH_SUPERVISOR", confidence: 0.95, matchedPattern: "jumlah_supervisor" };
  }
  if ((q.includes("kades") || q.includes("kepala desa")) && hasCountKeywords) {
    return { intent: "JUMLAH_KADES", confidence: 0.95, matchedPattern: "jumlah_kades" };
  }

  // B5. STATISTIK PENGAJUAN PELAYANAN
  const isAskingPengajuan =
    (q.includes("pengajuan") ||
      q.includes("permohonan") ||
      q.includes("berkas") ||
      q.includes("surat masuk")) &&
    !q.includes("syarat") &&
    !q.includes("persyaratan") &&
    !q.includes("buat") &&
    !q.includes("bikin");

  // B5-precheck. Pertanyaan "Berapa yang disetujui?" tanpa kata "pengajuan" (shorthand / follow-up)
  // Harus sebelum blok isAskingPengajuan agar tidak terlewat
  if (
    hasCountKeywords &&
    (q.includes("disetujui") || q.includes("sudah disetujui") || q.includes("telah disetujui") || q.includes("yang disetujui")) &&
    !q.includes("tidak disetujui") &&
    !q.includes("belum disetujui") &&
    !q.includes("ditolak") &&
    !q.includes("warga") &&
    !q.includes("staf")
  ) {
    return { intent: "PENGAJUAN_DISETUJUI", confidence: 0.95, matchedPattern: "pengajuan_disetujui_shorthand" };
  }

  // B5-precheck Ditolak: "Berapa yang ditolak?" tanpa kata "pengajuan"
  if (
    hasCountKeywords &&
    (q.includes("ditolak") || q.includes("yang ditolak") || q.includes("tolak") || q.includes("tidak disetujui")) &&
    !q.includes("warga") &&
    !q.includes("staf")
  ) {
    return { intent: "PENGAJUAN_DITOLAK", confidence: 0.95, matchedPattern: "pengajuan_ditolak_shorthand" };
  }

  // B5-precheck Selesai: "Berapa yang selesai?" tanpa kata "pengajuan"
  if (
    hasCountKeywords &&
    (q.includes("selesai") || q.includes("yang selesai") || q.includes("sudah selesai") || q.includes("sudah terbit")) &&
    !q.includes("warga") &&
    !q.includes("staf")
  ) {
    return { intent: "PENGAJUAN_SELESAI", confidence: 0.95, matchedPattern: "pengajuan_selesai_shorthand" };
  }

  if (isAskingPengajuan) {
    // B5a. Pengajuan SELESAI
    if (
      q.includes("selesai") ||
      q.includes("sudah selesai") ||
      q.includes("telah selesai") ||
      q.includes("sudah terbit") ||
      q.includes("sudah diterbitkan")
    ) {
      return { intent: "PENGAJUAN_SELESAI", confidence: 0.95, matchedPattern: "pengajuan_selesai" };
    }

    // B5b-0. Pengajuan DISETUJUI — harus sebelum DITOLAK agar "tidak disetujui" tidak masuk sini
    if (
      (q.includes("disetujui") || q.includes("yang disetujui") || q.includes("sudah disetujui") || q.includes("telah disetujui")) &&
      !q.includes("tidak disetujui") &&
      !q.includes("belum disetujui") &&
      !q.includes("ditolak")
    ) {
      return { intent: "PENGAJUAN_DISETUJUI", confidence: 0.95, matchedPattern: "pengajuan_disetujui" };
    }

    // B5b. Pengajuan DITOLAK
    if (
      q.includes("ditolak") ||
      q.includes("tidak disetujui") ||
      q.includes("penolakan") ||
      q.includes("gagal")
    ) {
      return { intent: "PENGAJUAN_DITOLAK", confidence: 0.95, matchedPattern: "pengajuan_ditolak" };
    }

    // B5c. Pengajuan sedang DIPROSES / aktif / berjalan
    if (
      q.includes("diproses") ||
      q.includes("masih diproses") ||
      q.includes("sedang diproses") ||
      q.includes("dalam proses") ||
      q.includes("aktif") ||
      q.includes("berjalan") ||
      q.includes("belum selesai") ||
      q.includes("tertunda") ||
      q.includes("belum diproses") ||
      q.includes("antrean belum")
    ) {
      return { intent: "PENGAJUAN_DIPROSES", confidence: 0.9, matchedPattern: "pengajuan_diproses" };
    }

    // B5d. Pengajuan MENUNGGU VALIDASI
    if (
      q.includes("menunggu validasi") ||
      q.includes("butuh validasi") ||
      q.includes("belum divalidasi") ||
      q.includes("perlu validasi") ||
      q.includes("menunggu verifikasi") ||
      q.includes("belum diverifikasi") ||
      (q.includes("validasi") && (q.includes("berapa") || q.includes("jumlah") || q.includes("total")))
    ) {
      return { intent: "PENGAJUAN_MENUNGGU_VALIDASI", confidence: 0.95, matchedPattern: "pengajuan_menunggu_validasi" };
    }

    // B5e. Rekap bulan ini
    if (q.includes("bulan ini") || q.includes("periode ini") || q.includes("bulan sekarang")) {
      return { intent: "RINGKASAN_BULAN_INI", confidence: 0.9, matchedPattern: "ringkasan_bulan_ini" };
    }

    // B5f. Total semua pengajuan — deteksi luas, harus setelah semua filter spesifik di atas
    if (
      hasCountKeywords ||
      q.includes("statistik") ||
      q.includes("rekap") ||
      q.includes("data pengajuan") ||
      q === "ada berapa pengajuan" ||
      q === "berapa pengajuan" ||
      q === "total pengajuan"
    ) {
      return { intent: "PENGAJUAN_TOTAL", confidence: 0.95, matchedPattern: "pengajuan_total" };
    }
  }

  // B6. STATISTIK MASTER LAYANAN (JUMLAH / TOTAL LAYANAN)
  if (
    (q.includes("layanan") || q.includes("jenis surat")) &&
    (hasCountKeywords || q.includes("daftar") || q.includes("apa saja") || q.includes("master")) &&
    !q.includes("syarat") &&
    !q.includes("persyaratan")
  ) {
    return { intent: "DAFTAR_LAYANAN", confidence: 0.95, matchedPattern: "daftar_layanan" };
  }

  return { intent: "UNKNOWN", confidence: 0.0 };
}
