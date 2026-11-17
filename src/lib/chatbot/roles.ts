export type ChatRole = "WARGA" | "STAF_DESA" | "SUPERVISOR" | "KEPALA_DESA" | "ADMIN" | "GUEST";

export interface RoleConfig {
  role: ChatRole;
  title: string;
  badge: string;
  welcomeMessage: string;
  suggestions: string[];
}

export const ROLE_CONFIGS: Record<ChatRole, RoleConfig> = {
  GUEST: {
    role: "GUEST",
    title: "Asisten Desa Perum",
    badge: "Informasi Publik",
    welcomeMessage:
      "Halo! 👋 Selamat datang di Sistem Pelayanan Desa Perum. Saya asisten informasi publik desa. Ada yang bisa saya bantu mengenai informasi layanan, syarat dokumen, atau prosedur administrasi desa?",
    suggestions: [
      "Apa saja layanan surat yang ada?",
      "Persyaratan Surat Keterangan Usaha (SKU)",
      "Persyaratan Surat Keterangan Tidak Mampu (SKTM)",
      "Bagaimana cara mengajukan surat?",
      "Jam pelayanan kantor desa",
    ],
  },
  WARGA: {
    role: "WARGA",
    title: "Asisten Pelayanan Desa",
    badge: "Masyarakat / Warga",
    welcomeMessage:
      "Halo! 👋 Selamat datang di ruang pelayanan mandiri. Saya **Asisten Pelayanan Desa**. Saya siap membantu Anda membuat dan menyiapkan surat desa (**SKTM**, **Domisili**, **SKU**), mengecek status pengajuan, serta panduan unduh dan cetak surat resmi.",
    suggestions: [
      "Saya siapa?",
      "Saya ingin membuat SKTM.",
      "Tolong buatkan surat domisili.",
      "Tampilkan pengajuan surat saya.",
      "Apa persyaratan membuat surat keterangan usaha?",
    ],
  },
  STAF_DESA: {
    role: "STAF_DESA",
    title: "Asisten Operator Pelayanan",
    badge: "Petugas Pelayanan & Staf",
    welcomeMessage:
      "Halo, Petugas Pelayanan! 📋 Saya **Asisten Operator Pelayanan Desa**. Saya siap membantu Anda memantau antrean pengajuan yang perlu diperiksa, menjelaskan SOP verifikasi berkas, dan memantau seluruh data pelayanan desa.",
    suggestions: [
      "Saya siapa?",
      "Berapa pengajuan yang perlu diproses?",
      "Tampilkan ringkasan antrean pengajuan",
      "Bagaimana SOP pemeriksaan berkas?",
      "Apa saja layanan surat yang ada?",
    ],
  },
  SUPERVISOR: {
    role: "SUPERVISOR",
    title: "Asisten Supervisor",
    badge: "Supervisor Pelayanan",
    welcomeMessage:
      "Selamat bertugas, Supervisor! 📊 Saya **Asisten Supervisor Pelayanan**. Saya siap menyajikan analisis statistik pelayanan, status pengajuan, deteksi pengajuan tertunda, dan evaluasi kinerja operasional berdasarkan data riil sistem.",
    suggestions: [
      "Saya siapa?",
      "Berapa jumlah pengajuan yang masih menunggu verifikasi?",
      "Buatkan ringkasan pelayanan bulan ini",
      "Apakah ada pengajuan yang melewati target waktu?",
      "Bagaimana statistik pengajuan berdasarkan status?",
    ],
  },
  KEPALA_DESA: {
    role: "KEPALA_DESA",
    title: "Asisten Kepala Desa",
    badge: "Kepala Desa / Pimpinan",
    welcomeMessage:
      "Selamat datang, Bapak/Ibu Kepala Desa. 🏛️ Saya **Asisten Kepala Desa**. Saya siap menyajikan laporan eksekutif, tren permohonan layanan masyarakat, evaluasi target pelayanan, dan daftar dokumen yang menunggu persetujuan Anda.",
    suggestions: [
      "Saya siapa?",
      "Tampilkan ringkasan eksekutif pelayanan",
      "Berapa pengajuan yang menunggu persetujuan saya?",
      "Layanan apa yang paling banyak diajukan?",
      "Evaluasi pencapaian target pelayanan",
    ],
  },
  ADMIN: {
    role: "ADMIN",
    title: "Asisten Admin Desa",
    badge: "Administrator Sistem",
    welcomeMessage:
      "Halo, Administrator! ⚙️ Saya **Asisten Admin Desa**. Saya siap mendampingi pengelolaan master jenis layanan, konfigurasi sistem, dan panduan pemeliharaan operasional aplikasi.",
    suggestions: [
      "Panduan pengelolaan jenis layanan",
      "Panduan pengelolaan akun pengguna",
      "Status operasional sistem",
      "Panduan pemeliharaan data referensi",
    ],
  },
};

export function getRoleConfig(roleString?: string | null): RoleConfig {
  if (!roleString) return ROLE_CONFIGS.GUEST;
  const upper = roleString.toUpperCase();
  if (upper in ROLE_CONFIGS) {
    return ROLE_CONFIGS[upper as ChatRole];
  }
  return ROLE_CONFIGS.GUEST;
}
