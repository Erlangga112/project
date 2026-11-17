import { ChatRole } from "./roles";
import { ChatbotIntent } from "./intents";

export interface PermissionCheckResult {
  allowed: boolean;
  refusalMessage?: string;
  reason?: string;
}

/**
 * Memeriksa apakah role pengguna diizinkan mengakses data/statistik sesuai intent pertanyaan.
 */
export function checkStatisticPermission(
  role: ChatRole,
  intent: ChatbotIntent
): PermissionCheckResult {
  // Intent umum non-statistik atau tidak dikenali selalu diizinkan masuk ke pipeline AI
  if (intent === "UNKNOWN") {
    return { allowed: true };
  }

  // ── INTENT PUBLIK & PROFIL PRIBADI (DAPAT DIAKSES SEMUA PENGGUNA) ──
  const isAlwaysAllowed = [
    "PROFIL_PENGGUNA",
    "DAFTAR_LAYANAN",
    "SOP_PELAYANAN",
    "JAM_PELAYANAN",
  ].includes(intent);

  if (isAlwaysAllowed) {
    return { allowed: true };
  }

  // ── INTENT PELAYANAN SURAT WARGA ──
  const isSuratIntent = [
    "BUAT_SURAT",
    "STATUS_SURAT",
    "SYARAT_SURAT",
    "PANDUAN_CETAK",
    "KONFIRMASI_BUAT_SURAT",
  ].includes(intent);

  if (isSuratIntent) {
    if (intent === "SYARAT_SURAT" || intent === "PANDUAN_CETAK") {
      // Informasi persyaratan dan panduan cetak bersifat publik
      return { allowed: true };
    }

    if (role === "GUEST") {
      return {
        allowed: false,
        reason: "GUEST_AUTH_REQUIRED_FOR_SURAT",
        refusalMessage:
          "🔒 **Autentikasi Diperlukan**: Untuk membuat permohonan surat atau melihat riwayat pengajuan Anda, silakan masuk (login) terlebih dahulu menggunakan akun Warga terdaftar Anda.",
      };
    }

    // Warga dan aparatur berhak mengakses layanan surat
    return { allowed: true };
  }

  // 1. GUEST / BELUM LOGIN
  if (role === "GUEST") {
    return {
      allowed: false,
      reason: "GUEST_UNAUTHORIZED_FOR_STATS",
      refusalMessage:
        "🔒 **Akses Terbatas**: Informasi statistik dan data operasional desa hanya dapat diakses oleh aparatur atau petugas desa yang telah terautentikasi ke dalam sistem. Silakan masuk (login) menggunakan akun resmi Anda.",
    };
  }

  // 2. WARGA / MASYARAKAT UMUM
  if (role === "WARGA") {
    // Warga hanya boleh mengakses informasi layanan publik dan data miliknya sendiri
    return {
      allowed: false,
      reason: "WARGA_RESTRICTED_FROM_INTERNAL_STATS",
      refusalMessage:
        "🛡️ **Akses Terbatas**: Demi menjaga privasi data kependudukan dan keamanan administrasi desa, statistik pengguna internal dan rekapitulasi data kependudukan hanya dapat diakses oleh petugas pelayanan atau staf desa yang berwenang.\n\nSebagai warga, Anda dapat menanyakan informasi seputar persyaratan surat, alur pelayanan, jam operasional, atau status pengajuan surat milik Anda sendiri.",
    };
  }

  // 3. APARATUR DESA (STAF_DESA, SUPERVISOR, KEPALA_DESA)
  if (role === "STAF_DESA" || role === "SUPERVISOR" || role === "KEPALA_DESA") {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "ROLE_UNAUTHORIZED",
    refusalMessage: "Mohon maaf, Anda tidak memiliki hak akses untuk melihat data statistik ini.",
  };
}
