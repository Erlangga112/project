import { ChatRole } from "./roles";

/**
 * Knowledge Base Resmi Fitur & Struktur Aplikasi
 * Berdasarkan audit langsung terhadap source code project:
 * - Halaman & route (src/app/**)
 * - Komponen navigasi (src/components/Navbar.tsx)
 * - Dashboard role (src/app/staf, src/app/warga, src/app/supervisor, src/app/kades)
 * - API route & controller tindakan (src/app/api/**)
 */

export interface AppFeature {
  id: string;
  order: number;
  name: string;
  displayName?: string;
  shortSummary: string;
  route: string;
  summary: string;
  functionDetails: string;
  usageGuide: string;
  canEdit: boolean;
  editDetails: string;
  allowedRoles: ChatRole[];
  dataUsed: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. KATALOG FITUR LENGKAP APLIKASI
// ─────────────────────────────────────────────────────────────────────────────

export const APP_FEATURES: Record<string, AppFeature> = {
  // ─── FITUR STAF DESA ───
  staf_dashboard: {
    id: "staf_dashboard",
    order: 1,
    name: "Dashboard Administrasi",
    displayName: "Dashboard",
    shortSummary: "untuk melihat ringkasan aktivitas pelayanan.",
    route: "/staf",
    summary: "Pusat monitoring antrean pelayanan, kartu statistik beban kerja, antrean verifikasi prioritas, dan tabel database pengajuan terkini.",
    functionDetails:
      "Berfungsi untuk memantau ringkasan operasional pelayanan secara langsung melalui 5 kartu statistik utama " +
      "(Total Pengajuan, Menunggu Verifikasi, Disetujui, Ditolak, dan Basis Data Pengguna), " +
      "tabel 'Antrian Verifikasi — Perlu Ditindaklanjuti' untuk prioritas penanganan, " +
      "serta 'Tabel Database Pengajuan Terkini' untuk memantau seluruh berkas sistem secara komprehensif.",
    usageGuide:
      "1. Buka menu 'Dashboard' (/staf).\n" +
      "2. Pantau 5 kartu metrik di bagian atas (Total Pengajuan, Menunggu Verifikasi, Disetujui, Ditolak, dan Basis Data Pengguna).\n" +
      "3. Pada tabel antrean pelayanan, temukan berkas permohonan warga dan klik tombol 'Proses' untuk langsung meneliti dan memverifikasi berkas.\n" +
      "4. Pantau 'Tabel Database Pengajuan Terkini' untuk melihat seluruh riwayat berkas sistem desa.",
    canEdit: true,
    editDetails: "Staf dapat memulai pemrosesan antrean berkas langsung dari tombol aksi tabel.",
    allowedRoles: ["STAF_DESA"],
    dataUsed: ["Tabel pengajuanLayanan", "Tabel jenisLayanan", "Tabel user"],
  },

  staf_verifikasi: {
    id: "staf_verifikasi",
    order: 2,
    name: "Verifikasi Pengajuan",
    displayName: "Verifikasi Pengajuan",
    shortSummary: "untuk memeriksa berkas permohonan.",
    route: "/staf/pengajuan",
    summary: "Modul penelaahan berkas persyaratan surat, pemeriksaan berkas, permintaan perbaikan, dan penerbitan surat.",
    functionDetails:
      "Berfungsi untuk memeriksa berkas pengajuan warga secara komprehensif. Staf memeriksa dokumen lampiran (KTP, KK, Surat RT/RW, foto usaha, dll.), " +
      "memulai pemeriksaan (status DIPERIKSA), meminta perbaikan dokumen dengan catatan spesifik (status PERLU_PERBAIKAN), " +
      "meneruskan berkas lengkap ke supervisor (status MENUNGGU_VALIDASI), dan menerbitkan surat sah desa (status SELESAI) setelah disetujui Kepala Desa.",
    usageGuide:
      "1. Buka menu 'Verifikasi Pengajuan' (/staf/pengajuan).\n" +
      "2. Gunakan filter status atau pencarian untuk menemukan berkas yang perlu ditindaklanjuti.\n" +
      "3. Klik baris berkas untuk membuka halaman telaah detail (/staf/pengajuan/[id]).\n" +
      "4. Periksa data pemohon dan pratinjau dokumen lampiran.\n" +
      "5. Pilih tindakan: 'Mulai Pemeriksaan', 'Minta Perbaikan' (isi catatan kekurangan), 'Teruskan ke Supervisor', atau 'Terbitkan Surat' jika sudah disetujui Kades.",
    canEdit: true,
    editDetails: "Staf memiliki wewenang penuh untuk mengubah status verifikasi berkas, mengirim catatan perbaikan kepada warga, dan menerbitkan dokumen surat.",
    allowedRoles: ["STAF_DESA"],
    dataUsed: ["Tabel pengajuanLayanan", "Tabel dokumenPengajuan", "Tabel logPengajuan", "Tabel dokumenHasil"],
  },

  staf_master_layanan: {
    id: "staf_master_layanan",
    order: 3,
    name: "Master Layanan",
    displayName: "Master Layanan",
    shortSummary: "untuk mengelola layanan desa.",
    route: "/staf/layanan",
    summary: "Manajemen katalog jenis surat permohonan desa, persyaratan dokumen, dan estimasi waktu proses.",
    functionDetails:
      "Berfungsi untuk mengelola katalog surat desa (seperti SKTM, SKU, SKD, dan SPK). " +
      "Staf dapat menambah jenis layanan surat baru (/staf/layanan/baru), mengedit formulir persyaratan dokumen (/staf/layanan/[id]/edit), " +
      "mengatur estimasi hari kerja penyelesaian, serta mengaktifkan atau menonaktifkan ketersediaan surat bagi warga.",
    usageGuide:
      "1. Buka menu 'Master Layanan' (/staf/layanan).\n" +
      "2. Untuk menambah layanan: Klik tombol '+ Tambah Layanan' (/staf/layanan/baru), lengkapi nama surat, kode, deskripsi, daftar persyaratan dokumen, dan estimasi waktu kerja, lalu klik 'Simpan'.\n" +
      "3. Untuk mengubah layanan: Klik tombol 'Edit' pada kartu surat yang ingin diperbarui, sesuaikan persyaratan atau waktu, lalu simpan perubahan.",
    canEdit: true,
    editDetails: "Staf berwenang penuh menambah, mengedit persyaratan, mengubah estimasi hari kerja, dan mengaktifkan/menonaktifkan layanan surat desa.",
    allowedRoles: ["STAF_DESA"],
    dataUsed: ["Tabel jenisLayanan"],
  },

  staf_data_pengguna: {
    id: "staf_data_pengguna",
    order: 4,
    name: "Data Pengguna",
    displayName: "Data Pengguna",
    shortSummary: "untuk mengelola informasi pengguna sesuai kewenangan.",
    route: "/staf/pengguna",
    summary: "Pengelolaan basis data akun warga dan aparatur desa, pendaftaran warga baru, dan pembaruan profil kependudukan.",
    functionDetails:
      "Berfungsi untuk mengelola seluruh akun pengguna dan data kependudukan warga desa. " +
      "Menyajikan tabel berpaginasi (5 per halaman) dengan pencarian NIK/Nama, pendaftaran akun/warga baru secara langsung, " +
      "pembaruan data profil kependudukan (NIK, No. KK, Alamat, RT/RW, No. WhatsApp), serta pengaturan status warga (Aktif/Pindah).",
    usageGuide:
      "1. Buka menu 'Data Pengguna' (/staf/pengguna).\n" +
      "2. Untuk menambah pengguna baru: Klik tombol '+ Tambah Pengguna' di kanan atas tabel, isi formulir akun (nama, email, password, role) dan data kependudukan (NIK, KK, alamat, RT/RW, nomor WhatsApp), lalu klik 'Simpan Pengguna'.\n" +
      "3. Untuk mengedit data warga: Klik tombol menu titik tiga pada baris warga yang bersangkutan ➔ pilih 'Edit Pengguna' ➔ lakukan pembaruan data lalu simpan.\n" +
      "4. Gunakan kolom pencarian untuk menyaring warga berdasarkan Nama atau NIK.",
    canEdit: true,
    editDetails: "Staf berwenang mendaftarkan akun baru, memperbarui data NIK/alamat/kontak warga, dan mengubah status kependudukan (Aktif/Pindah).",
    allowedRoles: ["STAF_DESA"],
    dataUsed: ["Tabel user", "Tabel profilWarga", "Tabel petugasContact"],
  },

  // ─── FITUR WARGA ───
  warga_dashboard: {
    id: "warga_dashboard",
    order: 1,
    name: "Dashboard Pelayanan Warga",
    displayName: "Dashboard",
    shortSummary: "untuk melihat ringkasan berkas pengajuan pribadi dan permohonan aktif.",
    route: "/warga",
    summary: "Ringkasan berkas pengajuan pribadi, shortcut permohonan baru, dan panduan alur pelayanan mandiri.",
    functionDetails:
      "Berfungsi sebagai beranda mandiri bagi warga untuk melihat status ringkas berkas permohonan miliknya " +
      "(Pengajuan Aktif, Surat Selesai, Pengajuan Ditolak), riwayat 5 pengajuan surat terakhir, dan tombol cepat mengajukan surat baru.",
    usageGuide:
      "1. Buka halaman utama (/warga).\n" +
      "2. Periksa status berkas Anda pada kartu ringkasan atau tabel pengajuan terbaru.\n" +
      "3. Klik tombol 'Ajukan Permohonan' untuk memilih jenis surat yang ingin dibuat, atau klik 'Tanya AI' untuk konsultasi persyaratan.",
    canEdit: true,
    editDetails: "Warga dapat mengedit data profil pribadinya (NIK, KK, alamat, no. WhatsApp) melalui modal profil di navbar atas.",
    allowedRoles: ["WARGA"],
    dataUsed: ["Tabel pengajuanLayanan (hanya milik user yang login)", "Tabel user", "Tabel profilWarga"],
  },

  warga_ajukan: {
    id: "warga_ajukan",
    order: 2,
    name: "Ajukan Pelayanan",
    displayName: "Ajukan Pelayanan",
    shortSummary: "untuk memilih katalog surat dan mengajukan permohonan mandiri secara online.",
    route: "/warga/layanan",
    summary: "Katalog layanan surat permohonan online dan pengisian formulir pengajuan mandiri.",
    functionDetails:
      "Berfungsi menampilkan katalog surat desa yang aktif (SKTM, SKU, SKD, SPK) lengkap dengan persyaratan berkas dan estimasi hari kerja. " +
      "Warga dapat memilih surat yang dibutuhkan dan mengisi formulir pengajuan online beserta unggah berkas persyaratan pendukung.",
    usageGuide:
      "1. Buka menu 'Ajukan Pelayanan' (/warga/layanan).\n" +
      "2. Pilih surat yang diinginkan (misal: Surat Keterangan Usaha / SKU) dan klik 'Ajukan Permohonan'.\n" +
      "3. Pada halaman formulir (/warga/layanan/[id]/ajukan), isi keperluan surat dan unggah foto/dokumen persyaratan (KTP, KK, Surat RT/RW, dll).\n" +
      "4. Klik 'Kirim Pengajuan'. Anda akan memperoleh nomor registrasi resmi pengajuan.",
    canEdit: true,
    editDetails: "Warga dapat mengisi formulir pengajuan baru dan mengunggah dokumen persyaratan pendukung.",
    allowedRoles: ["WARGA"],
    dataUsed: ["Tabel jenisLayanan", "Tabel pengajuanLayanan", "Tabel dokumenPengajuan"],
  },

  warga_status: {
    id: "warga_status",
    order: 3,
    name: "Status Pengajuan",
    displayName: "Status Pengajuan",
    shortSummary: "untuk melacak progres verifikasi berkas dan mengunduh surat resmi yang telah selesai.",
    route: "/warga/pengajuan",
    summary: "Pelacakan timeline proses pengajuan surat dan pengunduhan/cetak dokumen resmi.",
    functionDetails:
      "Berfungsi untuk memantau perjalanan berkas secara transparan melalui tahapan berjenjang " +
      "(Diajukan ➔ Diperiksa Operator ➔ Validasi Supervisor ➔ Disetujui Kepala Desa ➔ Selesai). " +
      "Jika surat berstatus SELESAI, warga dapat langsung melihat pratinjau dan mengunduh/mencetak dokumen resmi berstempel digital desa.",
    usageGuide:
      "1. Buka menu 'Status Pengajuan' (/warga/pengajuan).\n" +
      "2. Klik permohonan Anda untuk melihat detail riwayat verifikasi dan catatan petugas (/warga/pengajuan/[id]).\n" +
      "3. Jika status 'PERLU_PERBAIKAN', perbaiki dan unggah ulang berkas sesuai catatan operator.\n" +
      "4. Jika status 'SELESAI', klik tombol 'Cetak Dokumen' (/surat/[id]) untuk mencetak atau mengunduh surat resmi desa.",
    canEdit: true,
    editDetails: "Warga dapat mengunggah ulang dokumen perbaikan jika diminta oleh operator pelayanan.",
    allowedRoles: ["WARGA"],
    dataUsed: ["Tabel pengajuanLayanan", "Tabel logPengajuan", "Tabel dokumenHasil"],
  },

  warga_asisten_ai: {
    id: "warga_asisten_ai",
    order: 4,
    name: "Asisten AI",
    displayName: "Asisten AI",
    shortSummary: "untuk konsultasi cerdas seputar persyaratan dan panduan administrasi desa.",
    route: "/warga/asisten-ai",
    summary: "Asisten cerdas digital desa untuk konsultasi persyaratan, panduan layanan, dan informasi kependudukan.",
    functionDetails:
      "Berfungsi memberikan pendampingan interaktif kepada warga mengenai syarat pengajuan surat, " +
      "jam pelayanan kantor desa, alur birokrasi, dan bantuan teknis penggunaan sistem.",
    usageGuide:
      "Buka menu 'Asisten AI' (/warga/asisten-ai) atau klik tombol chat di pojok kanan bawah pada seluruh halaman, lalu ketik pertanyaan Anda.",
    canEdit: false,
    editDetails: "Fitur tanya jawab interaktif.",
    allowedRoles: ["WARGA"],
    dataUsed: ["Knowledge base aplikasi", "Tabel jenisLayanan", "Tabel pengajuanLayanan"],
  },

  // ─── FITUR SUPERVISOR ───
  supervisor_dashboard: {
    id: "supervisor_dashboard",
    order: 1,
    name: "Dashboard Pengawasan",
    displayName: "Dashboard",
    shortSummary: "untuk memantau ringkasan kinerja pengawasan dan indikator mutu pelayanan.",
    route: "/supervisor",
    summary: "Monitoring operasional pelayanan, metrik efisiensi kerja, dan antrean validasi berjenjang.",
    functionDetails:
      "Berfungsi menyajikan indikator kinerja pengawasan, beban berkas menunggu validasi (MENUNGGU_VALIDASI), " +
      "tingkat penyelesaian surat, dan tabel ringkasan berkas masuk untuk pengawasan mutu pelayanan.",
    usageGuide:
      "Buka menu 'Dashboard' (/supervisor) untuk memantau metrik performa pelayanan desa secara real-time.",
    canEdit: false,
    editDetails: "Dashboard monitoring baca-saja (read-only monitoring).",
    allowedRoles: ["SUPERVISOR"],
    dataUsed: ["Tabel pengajuanLayanan", "Tabel user", "Tabel jenisLayanan"],
  },

  supervisor_validasi: {
    id: "supervisor_validasi",
    order: 2,
    name: "Validasi Pengajuan",
    displayName: "Validasi Pengajuan",
    shortSummary: "untuk menelaah dan memvalidasi berkas sebelum diteruskan ke Kepala Desa.",
    route: "/supervisor/pengajuan",
    summary: "Validasi berjenjang terhadap berkas yang telah diverifikasi staf sebelum diteruskan ke Kepala Desa.",
    functionDetails:
      "Berfungsi menelaah berkas permohonan berstatus MENUNGGU_VALIDASI. Supervisor memeriksa kembali keabsahan data " +
      "dan catatan staf, lalu memberikan keputusan validasi: meneruskan ke Kepala Desa (status MENUNGGU_APPROVAL_KEPALA_DESA) " +
      "atau mengembalikan berkas ke staf/warga (status PERLU_PERBAIKAN).",
    usageGuide:
      "1. Buka menu 'Validasi Pengajuan' (/supervisor/pengajuan).\n" +
      "2. Pilih berkas yang menunggu validasi untuk membuka telaah detail (/supervisor/pengajuan/[id]).\n" +
      "3. Klik 'Validasi & Teruskan ke Kades' jika berkas memenuhi standar, atau 'Minta Perbaikan' jika terdapat koreksi administratif.",
    canEdit: true,
    editDetails: "Supervisor berwenang menyetujui validasi berkas atau mengembalikan berkas ke tahap perbaikan.",
    allowedRoles: ["SUPERVISOR"],
    dataUsed: ["Tabel pengajuanLayanan", "Tabel logPengajuan"],
  },

  supervisor_laporan: {
    id: "supervisor_laporan",
    order: 3,
    name: "Laporan & Statistik",
    displayName: "Laporan & Statistik",
    shortSummary: "untuk melihat analisis analitik, grafik tren, dan rekapitulasi data.",
    route: "/supervisor/laporan",
    summary: "Analitik komprehensif kinerja pelayanan, tren surat bulanan, dan ekspor laporan.",
    functionDetails:
      "Berfungsi menyajikan visualisasi data statistik pelayanan bulanan, proporsi jenis surat yang diajukan, " +
      "perbandingan pengajuan disetujui vs ditolak, serta fitur ekspor laporan berkala untuk evaluasi operasional.",
    usageGuide:
      "Buka menu 'Laporan & Statistik' (/supervisor/laporan) untuk melihat grafik tren dan mengunduh laporan rekapitulasi.",
    canEdit: false,
    editDetails: "Modul analitik dan laporan.",
    allowedRoles: ["SUPERVISOR"],
    dataUsed: ["Tabel pengajuanLayanan", "Tabel jenisLayanan"],
  },

  supervisor_database: {
    id: "supervisor_database",
    order: 4,
    name: "Database Desa",
    displayName: "Database Desa",
    shortSummary: "untuk menelusuri data kependudukan terpadu desa.",
    route: "/supervisor/database",
    summary: "Eksplorasi basis data kependudukan terpadu dan agregasi data warga desa.",
    functionDetails:
      "Berfungsi memberikan akses menyeluruh terhadap rekap data kependudukan desa terdaftar, distribusi warga per wilayah RT/RW, dan rekapitulasi akun sistem.",
    usageGuide:
      "Buka menu 'Database Desa' (/supervisor/database) untuk menelusuri data kependudukan terpadu.",
    canEdit: false,
    editDetails: "Modul penelusuran database kependudukan desa.",
    allowedRoles: ["SUPERVISOR"],
    dataUsed: ["Tabel user", "Tabel profilWarga"],
  },

  supervisor_audit: {
    id: "supervisor_audit",
    order: 5,
    name: "Audit Logs",
    displayName: "Audit Logs",
    shortSummary: "untuk memeriksa rekam jejak aktivitas operasional dan log sistem.",
    route: "/supervisor/audit",
    summary: "Pemeriksaan rekam jejak aktivitas operasional dan catatan sistem (system logs).",
    functionDetails:
      "Berfungsi mencatat dan menampilkan log aktivitas seluruh pengguna, perubahan status pengajuan, " +
      "riwayat login, dan tindakan aparatur desa untuk menjamin akuntabilitas serta keamanan sistem.",
    usageGuide:
      "Buka menu 'Audit Logs' (/supervisor/audit) untuk memantau riwayat aktivitas dan log peristiwa sistem.",
    canEdit: false,
    editDetails: "Catatan riwayat aktivitas tidak dapat diubah (immutable audit log).",
    allowedRoles: ["SUPERVISOR"],
    dataUsed: ["Tabel systemLog", "Tabel logPengajuan"],
  },

  // ─── FITUR KEPALA DESA ───
  kades_dashboard: {
    id: "kades_dashboard",
    order: 1,
    name: "Dashboard Eksekutif",
    displayName: "Dashboard",
    shortSummary: "untuk melihat ikhtisar eksekutif dan ringkasan permohonan prioritas.",
    route: "/kades",
    summary: "Ringkasan eksekutif kinerja pelayanan desa dan pemantauan permohonan prioritas.",
    functionDetails:
      "Menyajikan ringkasan eksekutif tingkat pimpinan: total pengajuan berjalan, berkas yang membutuhkan persetujuan akhir (TTE), " +
      "dan efisiensi waktu penandatanganan surat warga.",
    usageGuide:
      "Buka halaman utama (/kades) untuk melihat ikhtisar eksekutif dan mengakses berkas yang perlu disetujui.",
    canEdit: false,
    editDetails: "Dashboard eksekutif pimpinan desa.",
    allowedRoles: ["KEPALA_DESA"],
    dataUsed: ["Tabel pengajuanLayanan", "Tabel jenisLayanan"],
  },

  kades_approval: {
    id: "kades_approval",
    order: 2,
    name: "Approval Pengajuan",
    displayName: "Approval Pengajuan",
    shortSummary: "untuk memeriksa dan mengesahkan berkas permohonan warga (TTE / persetujuan akhir).",
    route: "/kades/pengajuan",
    summary: "Persetujuan akhir pimpinan dan pengesahan tanda tangan elektronik (TTE) surat warga.",
    functionDetails:
      "Berfungsi memberikan keputusan akhir terhadap permohonan surat warga yang telah divalidasi oleh staf dan supervisor. " +
      "Kepala Desa dapat menyetujui berkas dengan pengesahan digital resmi (status DISETUJUI) atau menolak permohonan (status DITOLAK).",
    usageGuide:
      "1. Buka menu 'Approval Pengajuan' (/kades/pengajuan).\n" +
      "2. Pilih berkas permohonan yang menunggu pengesahan (/kades/pengajuan/[id]).\n" +
      "3. Telaah pratinjau surat dan klik tombol 'Setujui (Approval / TTE)' untuk mengesahkan surat, atau 'Tolak Pengajuan' jika tidak memenuhi kriteria.",
    canEdit: true,
    editDetails: "Kepala Desa berwenang penuh memberikan keputusan akhir pengesahan (DISETUJUI) atau penolakan (DITOLAK).",
    allowedRoles: ["KEPALA_DESA"],
    dataUsed: ["Tabel pengajuanLayanan", "Tabel dokumenHasil", "Tabel logPengajuan"],
  },

  kades_laporan: {
    id: "kades_laporan",
    order: 3,
    name: "Laporan Eksekutif",
    displayName: "Laporan Eksekutif",
    shortSummary: "untuk evaluasi kebijakan pelayanan dan laporan analitik agregat.",
    route: "/kades/laporan",
    summary: "Laporan analitik agregat untuk evaluasi kebijakan pelayanan desa.",
    functionDetails:
      "Menyajikan data statistik pelayanan desa dalam format eksekutif: volume permohonan, sebaran jenis kebutuhan surat masyarakat, " +
      "dan tren kepuasan serta kecepatan proses birokrasi desa.",
    usageGuide:
      "Buka menu 'Laporan Eksekutif' (/kades/laporan) untuk meninjau data performa desa.",
    canEdit: false,
    editDetails: "Laporan eksekutif baca-saja.",
    allowedRoles: ["KEPALA_DESA"],
    dataUsed: ["Tabel pengajuanLayanan", "Tabel jenisLayanan"],
  },

  kades_audit: {
    id: "kades_audit",
    order: 4,
    name: "Audit Trail",
    displayName: "Audit Trail",
    shortSummary: "untuk memverifikasi rekam jejak kepatuhan dan keabsahan dokumen sah desa.",
    route: "/kades/audit",
    summary: "Pemantauan rekam jejak pengesahan digital dan kepatuhan administrasi desa.",
    functionDetails:
      "Berfungsi memberikan kepastian hukum dan transparansi terhadap seluruh surat yang disahkan dan ditandatangani secara digital oleh pimpinan desa.",
    usageGuide:
      "Buka menu 'Audit Trail' (/kades/audit) untuk memverifikasi riwayat persetujuan dokumen resmi.",
    canEdit: false,
    editDetails: "Rekam jejak kepatuhan hukum.",
    allowedRoles: ["KEPALA_DESA"],
    dataUsed: ["Tabel systemLog", "Tabel dokumenHasil"],
  },

  // ─── FITUR ADMIN SISTEM ───
  admin_dashboard: {
    id: "admin_dashboard",
    order: 1,
    name: "Dashboard Administrasi",
    displayName: "Dashboard",
    shortSummary: "untuk melihat ringkasan aktivitas sistem dan pemeliharaan operasional.",
    route: "/staf",
    summary: "Monitoring operasional sistem desa, kartu status layanan, dan pemantauan akun pengguna.",
    functionDetails:
      "Berfungsi sebagai beranda administrasi sistem untuk memantau ringkasan aktivitas pelayanan desa secara menyeluruh.",
    usageGuide:
      "Buka halaman utama dashboard untuk melihat ringkasan status operasional sistem.",
    canEdit: true,
    editDetails: "Admin berwenang mengelola pengaturan dan monitoring sistem.",
    allowedRoles: ["ADMIN"],
    dataUsed: ["Tabel pengajuanLayanan", "Tabel user"],
  },

  admin_layanan: {
    id: "admin_layanan",
    order: 2,
    name: "Master Layanan",
    displayName: "Master Layanan",
    shortSummary: "untuk mengelola jenis layanan surat desa dan persyaratan formulir.",
    route: "/staf/layanan",
    summary: "Pengelolaan katalog jenis surat desa dan persyaratan dokumen.",
    functionDetails:
      "Berfungsi untuk mengonfigurasi jenis surat desa, menambah layanan baru, dan memperbarui dokumen syarat pengajuan.",
    usageGuide:
      "Buka menu 'Master Layanan' (/staf/layanan) untuk mengelola jenis surat desa.",
    canEdit: true,
    editDetails: "Admin berwenang penuh menambah dan mengubah katalog layanan surat desa.",
    allowedRoles: ["ADMIN"],
    dataUsed: ["Tabel jenisLayanan"],
  },

  admin_pengguna: {
    id: "admin_pengguna",
    order: 3,
    name: "Data Pengguna",
    displayName: "Data Pengguna",
    shortSummary: "untuk mengelola akun pengguna dan pembagian hak akses sistem.",
    route: "/staf/pengguna",
    summary: "Pengelolaan basis data akun pengguna, role aparatur, dan profil warga.",
    functionDetails:
      "Berfungsi untuk mengelola akun pengguna sistem, pembagian role (Warga, Staf, Supervisor, Kades), dan verifikasi profil.",
    usageGuide:
      "Buka menu 'Data Pengguna' (/staf/pengguna) untuk mengelola data akun pengguna.",
    canEdit: true,
    editDetails: "Admin berwenang mendaftarkan akun baru dan mengatur status pengguna.",
    allowedRoles: ["ADMIN"],
    dataUsed: ["Tabel user", "Tabel profilWarga"],
  },

  admin_audit: {
    id: "admin_audit",
    order: 4,
    name: "Audit Logs",
    displayName: "Audit Logs",
    shortSummary: "untuk memeriksa rekam jejak aktivitas operasional dan keamanan sistem.",
    route: "/supervisor/audit",
    summary: "Pemeriksaan log sistem dan audit trail operasional aplikasi.",
    functionDetails:
      "Berfungsi memeriksa seluruh catatan aktivitas sistem, status pengajuan, dan log autentikasi pengguna.",
    usageGuide:
      "Buka menu 'Audit Logs' (/supervisor/audit) untuk meninjau log keamanan sistem.",
    canEdit: false,
    editDetails: "Catatan riwayat aktivitas tidak dapat diubah (immutable audit log).",
    allowedRoles: ["ADMIN"],
    dataUsed: ["Tabel systemLog"],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. HELPER QUERY PENGETAHUAN APLIKASI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mengambil daftar fitur dashboard yang dapat diakses oleh role pengguna tertentu
 */
export function getDashboardFeatures(role: ChatRole): AppFeature[] {
  const all = Object.values(APP_FEATURES);
  // Untuk pengunjung publik/tamu, tampilkan katalog layanan mandiri warga sebagai representasi portal publik
  const targetRole = role === "GUEST" ? "WARGA" : role;
  const filtered = all.filter((f) => f.allowedRoles.includes(targetRole));
  return filtered.sort((a, b) => a.order - b.order);
}

/**
 * Mengambil fitur berdasarkan ID atau urutan nomor (1-based index)
 */
export function getFeatureByOrderOrId(
  role: ChatRole,
  identifier: number | string,
  lastFeatureList?: string[]
): AppFeature | undefined {
  const roleFeatures = getDashboardFeatures(role);

  // Jika identifier adalah angka urutan (misal: 1 untuk "pertama", 2 untuk "kedua")
  if (typeof identifier === "number") {
    // Jika ada lastFeatureList dari konteks sebelumnya, rujuk urutan tersebut
    if (lastFeatureList && lastFeatureList.length >= identifier) {
      const targetId = lastFeatureList[identifier - 1];
      return APP_FEATURES[targetId] || roleFeatures[identifier - 1];
    }
    return roleFeatures[identifier - 1];
  }

  // Jika identifier adalah string key/id
  const target = APP_FEATURES[identifier];
  if (target && (target.allowedRoles.includes(role) || role === "GUEST")) {
    return target;
  }

  // Coba cari substring nama fitur
  const lowerId = identifier.toLowerCase();
  return roleFeatures.find(
    (f) =>
      f.id.toLowerCase().includes(lowerId) ||
      f.name.toLowerCase().includes(lowerId) ||
      f.route.toLowerCase().includes(lowerId)
  );
}

/**
 * Menyusun ringkasan seluruh fitur dashboard sesuai role pengguna dan konteks aktif
 */
export function formatDashboardOverview(
  role: ChatRole,
  activeContext?: {
    dashboardName?: string;
    isSpecificPage?: boolean;
    pageName?: string;
    pageDescription?: string;
    currentOrder?: number;
  }
): {
  text: string;
  featureIds: string[];
} {
  const features = getDashboardFeatures(role);
  const featureIds = features.map((f) => f.id);

  let dashboardName = "Dashboard Pelayanan";
  if (activeContext?.dashboardName) {
    dashboardName = activeContext.dashboardName;
  } else if (role === "STAF_DESA") {
    dashboardName = "Dashboard Staf Desa";
  } else if (role === "WARGA") {
    dashboardName = "Dashboard Pelayanan Warga";
  } else if (role === "SUPERVISOR") {
    dashboardName = "Dashboard Supervisor";
  } else if (role === "KEPALA_DESA") {
    dashboardName = "Dashboard Kepala Desa";
  } else if (role === "ADMIN") {
    dashboardName = "Dashboard Administrator Desa";
  } else {
    dashboardName = "Portal Pelayanan Warga";
  }

  let text = "";
  if (activeContext?.isSpecificPage && activeContext?.pageName) {
    text = `Pada halaman **${activeContext.pageName}** (${dashboardName}), terdapat ${features.length} menu utama yang tersedia untuk akun Anda:\n\n`;

    features.forEach((f, idx) => {
      const isCurrent = idx + 1 === activeContext.currentOrder;
      const currentTag = isCurrent ? " *(halaman aktif saat ini)*" : "";
      const label =
        f.displayName && f.displayName !== f.name
          ? `**${f.displayName}** (${f.name})`
          : `**${f.name}**`;
      text += `${idx + 1}. ${label} — ${f.shortSummary}${currentTag}\n`;
    });

    if (activeContext.pageDescription) {
      text += `\nPada halaman ini, Anda dapat ${activeContext.pageDescription}.\n`;
    }
  } else {
    text = `Pada ${dashboardName}, terdapat ${features.length} menu utama yang tersedia untuk akun Anda:\n\n`;

    features.forEach((f, idx) => {
      const label =
        f.displayName && f.displayName !== f.name
          ? `**${f.displayName}** (${f.name})`
          : `**${f.name}**`;
      text += `${idx + 1}. ${label} — ${f.shortSummary}\n`;
    });
  }

  const promptOrder = activeContext?.currentOrder && activeContext.currentOrder > 1 ? "kedua" : "pertama";
  text += `\n💡 *Ketik "Apa fungsi yang ${promptOrder}?", "Bagaimana cara menggunakannya?", atau "Siapa saja yang bisa mengaksesnya?" untuk penjelasan detail.*`;

  return { text, featureIds };
}

/**
 * Menjelaskan fungsi masing-masing menu secara lengkap
 */
export function formatAllMenuFunctions(role: ChatRole): string {
  const features = getDashboardFeatures(role);

  let text = `📋 **Fungsi Lengkap Masing-Masing Menu pada Akun Anda:**\n\n`;
  features.forEach((f, idx) => {
    text += `### ${idx + 1}. ${f.name} (\`${f.route}\`)\n`;
    text += `• **Fungsi:** ${f.functionDetails}\n`;
    text += `• **Kemampuan Edit:** ${f.editDetails}\n\n`;
  });

  return text;
}

/**
 * Menjelaskan fitur yang TIDAK BISA diakses oleh role pengguna (Restricted Features)
 */
export function getRestrictedFeaturesExplanation(role: ChatRole): string {
  if (role === "WARGA") {
    return (
      `🛡️ **Fitur yang Dibatasi untuk Akun Warga:**\n\n` +
      `Sebagai pemohon pelayanan masyarakat, demi menjaga keamanan dan kerahasiaan data desa, akun Warga **tidak memiliki akses** ke:\n` +
      `1. **Verifikasi Pengajuan:** Menyetujui atau menolak berkas pemohon lain (\`/staf/pengajuan\`, \`/supervisor/pengajuan\`, \`/kades/pengajuan\`).\n` +
      `2. **Manajemen Master Layanan:** Menambah atau mengubah syarat surat desa (\`/staf/layanan\`).\n` +
      `3. **Basis Data Pengguna:** Melihat NIK, alamat, atau nomor kontak warga lain (\`/staf/pengguna\`, \`/supervisor/database\`).\n` +
      `4. **Laporan & Statistik Internal Desa:** Memantau analitik performa aparatur (\`/supervisor/laporan\`, \`/kades/laporan\`).\n` +
      `5. **Audit Logs Sistem:** Membaca catatan riwayat log aktivitas server (\`/supervisor/audit\`, \`/kades/audit\`).\n\n` +
      `*Anda hanya berwenang mengelola permohonan surat dan data profil pribadi Anda sendiri.*`
    );
  }

  if (role === "STAF_DESA") {
    return (
      `🛡️ **Fitur yang Dibatasi untuk Akun Staf Desa (Operator):**\n\n` +
      `Sebagai pelaksana verifikasi teknis, akun Staf Desa **tidak memiliki akses** ke:\n` +
      `1. **Validasi Tingkat Supervisor:** Menjalankan tahap validasi berjenjang (\`/supervisor/pengajuan\`).\n` +
      `2. **Persetujuan Akhir (Approval / TTE Kades):** Memberikan tanda tangan digital pengesahan surat resmi (\`/kades/pengajuan\`).\n` +
      `3. **Laporan Eksekutif:** Mengakses ringkasan kebijakan tingkat pimpinan (\`/kades/laporan\`).\n` +
      `4. **Audit Logs Sistem Tingkat Lanjut:** Mengakses rekam jejak server (\`/supervisor/audit\`, \`/kades/audit\`).`
    );
  }

  if (role === "SUPERVISOR") {
    return (
      `🛡️ **Fitur yang Dibatasi untuk Akun Supervisor:**\n\n` +
      `1. **Pengesahan Akhir Kepala Desa:** Supervisor bertugas memvalidasi, namun pengesahan surat final (DISETUJUI) adalah wewenang eksklusif Kepala Desa (\`/kades/pengajuan\`).\n` +
      `2. **Pengajuan Layanan Warga Pribadi:** Akun pengawasan tidak digunakan untuk mengajukan surat mandiri sebagai warga.`
    );
  }

  if (role === "KEPALA_DESA") {
    return (
      `🛡️ **Fitur yang Dibatasi untuk Akun Kepala Desa:**\n\n` +
      `1. **Pemeriksaan Operasional Awal:** Pemeriksaan berkas fisik/lampiran di awal ditangani oleh staf pelayanan (\`/staf/pengajuan\`).\n` +
      `2. **Form Master Layanan Teknis:** Pengaturan teknis dokumen formulir dikelola oleh staf desa.`
    );
  }

  return "Seluruh fitur sistem dibatasi sesuai dengan hak akses yang terdaftar pada peran akun Anda.";
}

/**
 * Panduan lengkap: Bagaimana cara menambahkan pengguna
 */
export function getAddUserGuide(role: ChatRole): string {
  if (role !== "STAF_DESA" && role !== "SUPERVISOR") {
    return (
      `🛡️ **Akses Ditolak:** Akun Anda (${role}) tidak memiliki wewenang untuk menambahkan pengguna baru. ` +
      `Penambahan akun warga dan aparatur hanya dapat dilakukan oleh **Staf Desa** atau **Supervisor** melalui menu Data Pengguna.`
    );
  }

  return (
    `👥 **Panduan Cara Menambahkan Pengguna / Warga Baru (Staf Desa):**\n\n` +
    `1. Buka menu **Data Pengguna** (\`/staf/pengguna\`) dari navbar atas.\n` +
    `2. Klik tombol biru **'+ Tambah Pengguna'** di sudut kanan atas tabel data.\n` +
    `3. Pada modal formulir pendaftaran, isi data berikut:\n` +
    `   • **Informasi Akun:** Nama lengkap, Email aktif, Kata Sandi (password), dan Role (WARGA, STAF_DESA, SUPERVISOR, atau KEPALA_DESA).\n` +
    `   • **Data Kependudukan (Wajib untuk Warga):** NIK (16 digit), No. Kartu Keluarga (KK), Tempat & Tanggal Lahir, Alamat Domisili, RT/RW, dan No. Telepon/WhatsApp.\n` +
    `   • **Status Kependudukan:** Pilih status \`AKTIF\` atau \`PINDAH\`.\n` +
    `4. Klik tombol **'Simpan Pengguna'**.\n\n` +
    `*Sistem otomatis memverifikasi bahwa Email dan NIK belum pernah terdaftar sebelumnya untuk mencegah duplikasi data.*`
  );
}

/**
 * Panduan lengkap: Bagaimana cara memverifikasi pengajuan
 */
export function getVerificationGuide(role: ChatRole): string {
  if (role === "WARGA") {
    return (
      `🛡️ **Informasi Wewenang:** Verifikasi pengajuan dilakukan oleh **Staf Desa (Operator Pelayanan)**. ` +
      `Sebagai pemohon, Anda dapat memantau status perkembangan verifikasi berkas Anda melalui menu **Status Pengajuan** (\`/warga/pengajuan\`).`
    );
  }

  return (
    `📑 **Panduan SOP Verifikasi Pengajuan Permohonan Surat (Staf Desa):**\n\n` +
    `1. Buka menu **Verifikasi Pengajuan** (\`/staf/pengajuan\`) atau klik tombol **'Proses'** pada baris antrean di Dashboard.\n` +
    `2. Klik permohonan yang berstatus \`DIAJUKAN\` untuk membuka telaah detail berkas (\`/staf/pengajuan/[id]\`).\n` +
    `3. **Pemeriksaan Dokumen:** Teliti data pemohon dan periksa pratinjau lampiran persyaratan warga (KTP, KK, Surat Pengantar RT/RW, dokumen pendukung).\n` +
    `4. **Eksekusi Tindakan Verifikasi:**\n` +
    `   • **Mulai Pemeriksaan:** Klik tombol proses untuk mengubah status menjadi \`DIPERIKSA\`.\n` +
    `   • **Minta Perbaikan:** Jika berkas buram atau syarat kurang lengkap, klik **'Minta Perbaikan'**, tulis catatan spesifik kekurangan berkas, lalu kirim. Status berubah menjadi \`PERLU_PERBAIKAN\` dan warga akan menerima notifikasi.\n` +
    `   • **Teruskan ke Supervisor:** Jika semua dokumen telah valid dan memenuhi syarat SOP, klik **'Teruskan ke Supervisor'**. Status berkas menjadi \`MENUNGGU_VALIDASI\`.\n` +
    `5. **Penerbitan Surat:** Setelah berkas disetujui Kepala Desa (\`DISETUJUI\`), buka kembali berkas tersebut dan klik tombol **'Terbitkan Surat'** untuk membuat nomor surat sah desa dan menyelesaikan permohonan (\`SELESAI\`).`
  );
}

/**
 * Panduan lengkap: Di mana saya bisa melihat laporan
 */
export function getReportLocationGuide(role: ChatRole): string {
  if (role === "SUPERVISOR") {
    return (
      `📊 **Lokasi Laporan & Statistik (Supervisor):**\n\n` +
      `Anda dapat mengakses modul laporan lengkap pada menu **Laporan & Statistik** di navigasi atas atau route \`/supervisor/laporan\`.\n` +
      `Halaman ini menyediakan:\n` +
      `• Grafik tren permohonan surat bulanan.\n` +
      `• Perbandingan pengajuan yang disetujui, ditolak, dan butuh perbaikan.\n` +
      `• Proporsi pengajuan berdasarkan jenis layanan surat (SKTM, SKU, SKD, SPK).\n` +
      `• Fitur ekspor data rekapitulasi pelayanan.`
    );
  }

  if (role === "KEPALA_DESA") {
    return (
      `📊 **Lokasi Laporan Eksekutif (Kepala Desa):**\n\n` +
      `Bapak/Ibu Kepala Desa dapat memantau ringkasan kinerja pada menu **Laporan Eksekutif** di navigasi atas atau route \`/kades/laporan\`.\n` +
      `Halaman ini memuat indikator efisiensi pelayanan, volume surat masuk, dan statistik tingkat pengesahan surat desa.`
    );
  }

  if (role === "STAF_DESA") {
    return (
      `📊 **Lokasi Pemantauan Data & Laporan (Staf Desa):**\n\n` +
      `• Untuk operasional harian, ringkasan laporan antrean dan metrik status permohonan dapat langsung Anda lihat pada **Dashboard Administrasi** (\`/staf\`).\n` +
      `• Modul analitik laporan agregat (\`/supervisor/laporan\` dan \`/kades/laporan\`) dialokasikan khusus untuk Supervisor dan Kepala Desa.`
    );
  }

  return (
    `📊 **Lokasi Riwayat Berkas Anda (Warga):**\n\n` +
    `Anda dapat melihat seluruh riwayat dan rekap pengajuan berkas Anda pada menu **Dashboard Pelayanan** (\`/warga\`) dan menu **Status Pengajuan** (\`/warga/pengajuan\`).`
  );
}

/**
 * Panduan lengkap: Bagaimana cara mengubah data
 */
export function getDataEditGuide(role: ChatRole): string {
  if (role === "STAF_DESA") {
    return (
      `✏️ **Panduan Mengubah / Mengedit Data di Sistem (Staf Desa):**\n\n` +
      `1. **Mengubah Data Warga / Pengguna:**\n` +
      `   • Buka menu **Data Pengguna** (\`/staf/pengguna\`).\n` +
      `   • Klik tombol menu titik tiga pada baris warga yang bersangkutan ➔ pilih **'Edit Pengguna'**.\n` +
      `   • Anda dapat memperbarui NIK, No. KK, Alamat Domisili, RT/RW, No. WhatsApp, status kependudukan (Aktif/Pindah), atau mereset password akun.\n` +
      `   • Klik **'Simpan Perubahan'**.\n\n` +
      `2. **Mengubah Master Layanan Surat:**\n` +
      `   • Buka menu **Master Layanan** (\`/staf/layanan\`).\n` +
      `   • Klik tombol **'Edit'** pada kartu surat (\`/staf/layanan/[id]/edit\`).\n` +
      `   • Perbarui deskripsi, persyaratan berkas, atau estimasi hari kerja, lalu simpan.\n\n` +
      `3. **Mengubah Profil Akun Sendiri:**\n` +
      `   • Klik nama/avatar Anda di pojok kanan atas navbar ➔ pilih **'Edit Profil'**.`
    );
  }

  if (role === "WARGA") {
    return (
      `✏️ **Panduan Mengubah Data Profil Anda (Warga):**\n\n` +
      `1. Klik nama atau avatar akun Anda di pojok kanan atas navbar.\n` +
      `2. Pilih menu **'Edit Profil'**.\n` +
      `3. Pada modal formulir profil, Anda dapat memperbarui NIK, No. KK, Alamat Domisili, RT/RW, dan No. WhatsApp aktif Anda.\n` +
      `4. Klik tombol **'Simpan Perubahan'**.\n\n` +
      `*Jika status pengajuan surat Anda adalah PERLU_PERBAIKAN, Anda dapat mengunggah berkas perbaikan langsung di halaman detail pengajuan (/warga/pengajuan/[id]).*`
    );
  }

  return (
    `✏️ **Mengubah Data Profil Akun:**\n` +
    `Klik avatar akun Anda di pojok kanan atas navbar ➔ pilih **'Edit Profil'** untuk memperbarui informasi kontak dan data diri Anda.`
  );
}

/**
 * Panduan lengkap: Apa yang terjadi setelah pengajuan disetujui
 */
export function getPostApprovalWorkflowGuide(): string {
  return (
    `✅ **Alur Kerja Setelah Pengajuan Disetujui (Tahap Pasca-Approval):**\n\n` +
    `1. **Pengesahan Akhir Kepala Desa (\`DISETUJUI\`):**\n` +
    `   Kepala Desa menyetujui permohonan melalui menu Approval Pengajuan (\`/kades/pengajuan\`). Pengajuan kini sah secara administratif.\n\n` +
    `2. **Penerbitan Surat Sah oleh Staf Desa (\`SELESAI\`):**\n` +
    `   • Berkas yang disetujui masuk kembali ke antrean staf desa.\n` +
    `   • Staf desa membuka detail pengajuan di \`/staf/pengajuan/[id]\` dan mengklik tombol **'Terbitkan Surat'** (\`/api/admin/pengajuan/[id]/terbitkan\`).\n` +
    `   • Sistem secara otomatis men-generate dokumen resmi dengan **Nomor Surat Sah Desa**, tanggal penerbitan definitif, dan stempel digital/QR Code (\`DokumenHasil\`).\n` +
    `   • Status permohonan berubah menjadi **\`SELESAI\`**.\n\n` +
    `3. **Penyampaian Dokumen ke Warga:**\n` +
    `   • Warga menerima notifikasi otomatis bahwa surat telah selesai dan diterbitkan.\n` +
    `   • Warga dapat langsung membuka menu Status Pengajuan (\`/warga/pengajuan/[id]\`) dan mengklik tombol **'Cetak Dokumen'** untuk mengunduh PDF resmi atau mencetaknya secara mandiri.`
  );
}
