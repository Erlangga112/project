import { ChatRole } from "./roles";

export interface GuardrailCheckResult {
  blocked: boolean;
  authoritativeResponse?: string;
  reason?: string;
}

export function checkSecurityGuardrails(
  query: string,
  role: ChatRole,
  userName?: string
): GuardrailCheckResult {
  const lower = query.toLowerCase().trim();

  // 1. ATTEMPT TO REQUEST SECRETS / PASSWORDS / TOKENS / API KEYS
  const secretKeywords = [
    "password", "kata sandi", "katasandi", "passcode", "secret",
    "api key", "apikey", "api_key", "token", "jwt", "hash",
    "database url", "kredensial", "env", ".env", "rahasia sistem",
  ];
  const asksForSecret = secretKeywords.some((k) => lower.includes(k));
  if (asksForSecret) {
    return {
      blocked: true,
      reason: "SECRET_REQUEST_BLOCKED",
      authoritativeResponse:
        "🔒 **Akses Ditolak**: Demi alasan keamanan sistem dan perlindungan privasi, data rahasia seperti kata sandi (password), token autentikasi, kredensial, dan API key tidak dapat diakses atau ditampilkan.",
    };
  }

  // 2. ATTEMPT TO APPROVE OR MODIFY SUBMISSION STATUS VIA CHATBOT
  const approvalKeywords = [
    "setujui pengajuan", "setujui surat", "acc pengajuan", "approve",
    "ubah status pengajuan", "ubah status jadi", "ganti status pengajuan",
    "selesaikan pengajuan ini", "tolak pengajuan ini", "batalkan pengajuan ini",
    "verifikasi pengajuan nomor", "terbitkan surat ini",
  ];
  const attemptsApproval = approvalKeywords.some((k) => lower.includes(k));
  if (attemptsApproval) {
    return {
      blocked: true,
      reason: "APPROVAL_VIA_CHAT_BLOCKED",
      authoritativeResponse:
        "⚠️ **Aksi Tidak Diizinkan Melalui Chat**: Persetujuan, pengesahan, atau perubahan status pengajuan tidak dapat dilakukan melalui percakapan chatbot. Tindakan resmi harus dilakukan melalui tombol aksi pada dashboard pelayanan sesuai dengan wewenang dan SOP yang berlaku.",
    };
  }

  // 3. CROSS-USER DATA ACCESS (WARGA or GUEST asking for another citizen's data)
  if (role === "WARGA" || role === "GUEST") {
    const isAskingForOtherPerson =
      lower.includes("orang lain") ||
      lower.includes("warga lain") ||
      (lower.includes("milik") && !lower.includes("milik saya") && !lower.includes("milikku") && !lower.includes("sendiri")) ||
      (userName && !lower.includes(userName.toLowerCase()) && (lower.includes("milik siti") || lower.includes("punya siti") || lower.includes("milik budi") || lower.includes("punya budi") || lower.includes("pengajuan budi") || lower.includes("pengajuan siti"))) ||
      lower.includes("nik orang lain") ||
      lower.includes("nik warga lain") ||
      (lower.includes("nik") && lower.includes("orang lain"));

    const isAskingDataOrSubmissions =
      lower.includes("pengajuan") ||
      lower.includes("surat") ||
      lower.includes("data") ||
      lower.includes("berkas") ||
      lower.includes("nik") ||
      lower.includes("status");

    if (isAskingForOtherPerson && isAskingDataOrSubmissions) {
      return {
        blocked: true,
        reason: "CROSS_USER_PRIVACY_BLOCKED",
        authoritativeResponse:
          "🛡️ **Perlindungan Privasi Warga**: Mohon maaf, demi menjaga kerahasiaan dan keamanan data pribadi masyarakat, Anda hanya memiliki hak akses untuk melihat data dan status pengajuan milik Anda sendiri.",
      };
    }
  }

  // 4. OFF-TOPIC FILTER (Coding, academic math/science, recipes, general non-village topics)
  const offTopicKeywords = [
    // Coding & scripts
    "buatkan kode", "buat kode", "buatkan coding", "buat coding",
    "tulis kode", "tuliskan kode", "tulis coding", "contoh kode", "contoh program",
    "kode python", "kode javascript", "kode java", "kode php", "kode html", "kode sql",
    "python", "javascript", "typescript", "c++", "golang", "programming", "console.log",
    "function ", "class ", "def ", "import ",
    // Academic & math
    "rumus ", "persamaan", "integral", "turunan", "akar kuadrat", "fisika", "kimia", "biologi",
    // Creative writing
    "buatkan puisi", "buat puisi", "buatkan cerpen", "buat cerpen", "buatkan lirik", "surat cinta",
    // Recipes & medical
    "resep ", "cara masak", "cara membuat kue", "obat sakit",
    // General politics/unrelated
    "presiden", "pemilu", "pilpres", "sepak bola", "artis",
  ];

  // Whitelist keywords to ensure village administration inquiries are never misclassified
  const desaWhitelist = [
    "surat", "sktm", "sku", "domisili", "pengantar", "kematian", "kelahiran",
    "layanan", "pengajuan", "persyaratan", "syarat", "desa", "dokumen", "verifikasi",
    "antrean", "antrian", "status", "laporan", "statistik", "target", "prosedur",
    "kantor", "kades", "supervisor", "operator", "petugas", "staf", "warga",
    "halo", "hai", "selamat", "terima kasih", "siapa kamu", "bisa bantu apa",
  ];

  const isOffTopic = offTopicKeywords.some((k) => lower.includes(k));
  const hasDesaContext = desaWhitelist.some((k) => lower.includes(k));

  if (isOffTopic && !hasDesaContext) {
    return {
      blocked: true,
      reason: "OFF_TOPIC_BLOCKED",
      authoritativeResponse:
        "Mohon maaf, saya hanya dapat membantu seputar pelayanan dan administrasi desa. 😊\n\nApakah ada yang ingin Anda tanyakan mengenai layanan surat desa, status pengajuan, persyaratan dokumen, atau informasi pelayanan?",
    };
  }

  return { blocked: false };
}

export function postProcessResponse(text: string): string {
  // Strip code blocks if AI accidentally output them
  let cleaned = text.replace(/```[\s\S]*?```/g, "");

  // Strip obvious script definitions
  cleaned = cleaned.replace(/\bdef\s+\w+\s*\(.*?\):/g, "");
  cleaned = cleaned.replace(/\bfunction\s+\w+\s*\(.*?\)/g, "");

  return cleaned.trim();
}
