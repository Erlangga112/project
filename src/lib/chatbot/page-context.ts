import { ChatRole } from "./roles";
import { AppFeature, APP_FEATURES, getDashboardFeatures } from "./app-knowledge";

export interface PageContextPayload {
  pathname?: string;
  pageTitle?: string;
}

export interface ActivePageInfo {
  role: ChatRole;
  pathname: string;
  pageName: string;
  dashboardName: string;
  moduleName: string;
  isSpecificPage: boolean;
  pageDescription?: string;
  currentOrder?: number;
  features: AppFeature[];
  featureIds: string[];
}

/**
 * Memvalidasi dan menyelesaikan informasi halaman aktif pengguna secara aman.
 * Mencegah manipulasi pathname oleh client dengan memverifikasi otorisasi role di backend.
 */
export function resolveActivePage(
  role: ChatRole,
  pageContext?: PageContextPayload
): ActivePageInfo {
  const rawPath = (pageContext?.pathname || "").trim();

  // 1. Sanitasi pathname berdasarkan role pengguna (Role-Based Access Guard)
  let safePath = rawPath;

  if (role === "STAF_DESA") {
    if (!safePath.startsWith("/staf")) {
      safePath = "/staf";
    }
  } else if (role === "SUPERVISOR") {
    if (!safePath.startsWith("/supervisor")) {
      safePath = "/supervisor";
    }
  } else if (role === "KEPALA_DESA") {
    if (!safePath.startsWith("/kades")) {
      safePath = "/kades";
    }
  } else if (role === "WARGA") {
    if (!safePath.startsWith("/warga")) {
      safePath = "/warga";
    }
  } else if (role === "ADMIN") {
    if (!safePath.startsWith("/staf") && !safePath.startsWith("/admin") && !safePath.startsWith("/supervisor")) {
      safePath = "/staf";
    }
  } else {
    // GUEST
    if (!safePath.startsWith("/warga") && safePath !== "/") {
      safePath = "/warga";
    }
  }

  // 2. Ambil daftar fitur resmi sesuai role pengguna
  const features = getDashboardFeatures(role);
  const featureIds = features.map((f) => f.id);

  // 3. Tentukan nama dashboard dan konteks halaman sesuai role & route
  let dashboardName = "Dashboard Pelayanan";
  let pageName = "Dashboard";
  let moduleName = "Dashboard";
  let isSpecificPage = false;
  let pageDescription: string | undefined;
  let currentOrder: number | undefined = 1;

  if (role === "STAF_DESA") {
    dashboardName = "Dashboard Staf Desa";
    if (safePath.startsWith("/staf/pengajuan")) {
      pageName = "Verifikasi Pengajuan";
      moduleName = "Verifikasi Pengajuan";
      isSpecificPage = true;
      currentOrder = 2;
      pageDescription =
        "memeriksa antrean berkas pengajuan warga, meneliti kelengkapan dokumen persyaratan, meminta perbaikan berkas, dan meneruskan berkas ke tahap validasi berikutnya";
    } else if (safePath.startsWith("/staf/layanan")) {
      pageName = "Master Layanan";
      moduleName = "Master Layanan";
      isSpecificPage = true;
      currentOrder = 3;
      pageDescription =
        "mengelola katalog jenis surat permohonan desa, memperbarui persyaratan dokumen, dan mengatur estimasi waktu pelayanan";
    } else if (safePath.startsWith("/staf/pengguna")) {
      pageName = "Data Pengguna";
      moduleName = "Data Pengguna";
      isSpecificPage = true;
      currentOrder = 4;
      pageDescription =
        "melihat data kependudukan warga desa, mendaftarkan akun warga baru, dan memperbarui informasi profil kependudukan";
    } else {
      pageName = "Dashboard Administrasi";
      moduleName = "Dashboard Administrasi";
      isSpecificPage = false;
      currentOrder = 1;
      pageDescription = "memantau kartu metrik antrean pelayanan, lonjakan berkas masuk, dan tabel antrean pelayanan harian";
    }
  } else if (role === "SUPERVISOR") {
    dashboardName = "Dashboard Supervisor";
    if (safePath.startsWith("/supervisor/pengajuan")) {
      pageName = "Validasi Pengajuan";
      moduleName = "Validasi Pengajuan";
      isSpecificPage = true;
      currentOrder = 2;
      pageDescription = "menelaah dan memvalidasi berkas yang telah diverifikasi staf sebelum diteruskan ke Kepala Desa";
    } else if (safePath.startsWith("/supervisor/laporan")) {
      pageName = "Laporan & Statistik";
      moduleName = "Laporan & Statistik";
      isSpecificPage = true;
      currentOrder = 3;
      pageDescription = "melihat visualisasi grafik analitik, proporsi pengajuan bulanan, dan ekspor laporan rekapitulasi";
    } else if (safePath.startsWith("/supervisor/database")) {
      pageName = "Database Desa";
      moduleName = "Database Desa";
      isSpecificPage = true;
      currentOrder = 4;
      pageDescription = "mengeksplorasi data kependudukan terpadu desa dan rekapitulasi akun warga terdaftar";
    } else if (safePath.startsWith("/supervisor/audit")) {
      pageName = "Audit Logs";
      moduleName = "Audit Logs";
      isSpecificPage = true;
      currentOrder = 5;
      pageDescription = "memeriksa catatan rekam jejak aktivitas operasional seluruh pengguna dan log peristiwa sistem";
    } else {
      pageName = "Dashboard Pengawasan";
      moduleName = "Dashboard Pengawasan";
      isSpecificPage = false;
      currentOrder = 1;
      pageDescription = "memantau metrik performa pelayanan desa secara real-time dan beban antrean validasi";
    }
  } else if (role === "KEPALA_DESA") {
    dashboardName = "Dashboard Kepala Desa";
    if (safePath.startsWith("/kades/pengajuan")) {
      pageName = "Approval Pengajuan";
      moduleName = "Approval Pengajuan";
      isSpecificPage = true;
      currentOrder = 2;
      pageDescription = "memeriksa dan memberikan pengesahan akhir (tanda tangan elektronik / TTE) terhadap surat permohonan warga";
    } else if (safePath.startsWith("/kades/laporan")) {
      pageName = "Laporan Eksekutif";
      moduleName = "Laporan Eksekutif";
      isSpecificPage = true;
      currentOrder = 3;
      pageDescription = "meninjau data performa desa, volume permohonan, dan tren kebijakan pelayanan masyarakat";
    } else if (safePath.startsWith("/kades/audit")) {
      pageName = "Audit Trail";
      moduleName = "Audit Trail";
      isSpecificPage = true;
      currentOrder = 4;
      pageDescription = "memverifikasi riwayat keabsahan hukum dan persetujuan dokumen resmi desa";
    } else {
      pageName = "Dashboard Eksekutif";
      moduleName = "Dashboard Eksekutif";
      isSpecificPage = false;
      currentOrder = 1;
      pageDescription = "melihat ikhtisar eksekutif dan ringkasan permohonan prioritas pimpinan desa";
    }
  } else if (role === "WARGA") {
    dashboardName = "Dashboard Pelayanan Warga";
    if (safePath.startsWith("/warga/layanan")) {
      pageName = "Ajukan Pelayanan";
      moduleName = "Ajukan Pelayanan";
      isSpecificPage = true;
      currentOrder = 2;
      pageDescription = "memilih jenis surat permohonan yang dibutuhkan dan mengisi formulir pengajuan online";
    } else if (safePath.startsWith("/warga/pengajuan")) {
      pageName = "Status Pengajuan";
      moduleName = "Status Pengajuan";
      isSpecificPage = true;
      currentOrder = 3;
      pageDescription = "memantau riwayat verifikasi berkas permohonan Anda dan mengunduh surat resmi yang sudah selesai";
    } else if (safePath.startsWith("/warga/asisten-ai")) {
      pageName = "Asisten AI";
      moduleName = "Asisten AI";
      isSpecificPage = true;
      currentOrder = 4;
      pageDescription = "berkonsultasi secara langsung mengenai syarat dokumen dan panduan pengajuan surat desa";
    } else {
      pageName = "Dashboard Pelayanan Warga";
      moduleName = "Dashboard Pelayanan Warga";
      isSpecificPage = false;
      currentOrder = 1;
      pageDescription = "melihat status ringkas berkas permohonan pribadi dan mengajukan permohonan baru";
    }
  } else if (role === "ADMIN") {
    dashboardName = "Dashboard Administrator Desa";
    pageName = "Dashboard Administrasi";
    moduleName = "Dashboard Administrasi";
    isSpecificPage = false;
    currentOrder = 1;
    pageDescription = "memantau operasional sistem, master layanan surat, dan konfigurasi akun pengguna";
  } else {
    // GUEST
    dashboardName = "Portal Pelayanan Warga";
    pageName = "Beranda Informasi Publik";
    moduleName = "Informasi Publik";
    isSpecificPage = false;
    currentOrder = 1;
    pageDescription = "mengecek persyaratan surat desa dan informasi jam pelayanan kantor desa";
  }

  return {
    role,
    pathname: safePath,
    pageName,
    dashboardName,
    moduleName,
    isSpecificPage,
    pageDescription,
    currentOrder,
    features,
    featureIds,
  };
}

/**
 * Menyusun respons ikhtisar fitur yang sadar konteks halaman aktif & role.
 * Sesuai contoh jawaban resmi:
 * "Pada Dashboard Staf Desa, terdapat 4 menu utama yang tersedia untuk akun Anda:
 * 1. Dashboard (Dashboard Administrasi) — untuk melihat ringkasan aktivitas pelayanan.
 * 2. Verifikasi Pengajuan — untuk memeriksa berkas permohonan.
 * 3. Master Layanan — untuk mengelola layanan desa.
 * 4. Data Pengguna — untuk mengelola informasi pengguna sesuai kewenangan."
 */
export function formatPageAwareOverview(
  activeContext: ActivePageInfo,
  options?: { isSpecificInquiry?: boolean }
): { text: string; featureIds: string[] } {
  const {
    dashboardName,
    features,
    isSpecificPage,
    pageName,
    pageDescription,
    currentOrder,
  } = activeContext;

  const featureIds = features.map((f) => f.id);

  let text = "";

  if (isSpecificPage && options?.isSpecificInquiry) {
    text = `Pada halaman **${pageName}** (${dashboardName}), terdapat ${features.length} menu utama yang tersedia untuk akun Anda:\n\n`;

    features.forEach((f, idx) => {
      const isCurrent = idx + 1 === currentOrder;
      const currentTag = isCurrent ? " *(halaman aktif saat ini)*" : "";
      const label =
        f.displayName && f.displayName !== f.name
          ? `**${f.displayName}** (${f.name})`
          : `**${f.name}**`;
      text += `${idx + 1}. ${label} — ${f.shortSummary}${currentTag}\n`;
    });

    if (pageDescription) {
      text += `\nPada halaman ini, Anda dapat ${pageDescription}.\n`;
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

  const promptFollowUpOrder = currentOrder && currentOrder > 1 ? "kedua" : "pertama";
  text += `\n💡 *Ketik "Apa fungsi yang ${promptFollowUpOrder}?", "Bagaimana cara menggunakannya?", atau "Siapa saja yang bisa mengaksesnya?" untuk penjelasan detail.*`;

  return { text, featureIds };
}

