/**
 * Conversation Memory Engine
 * Mengelola state konteks percakapan multi-turn per sesi pengguna secara aman dan terisolasi.
 */

export type ConversationEntity =
  | "WARGA"
  | "PENGAJUAN"
  | "SURAT"
  | "STAF"
  | "SUPERVISOR"
  | "KADES"
  | "PENGGUNA"
  | "STATISTIK"
  | "FITUR"
  | "ALUR_PELAYANAN"
  | "NONE";

export interface ConversationState {
  entity: ConversationEntity;
  lastIntent?: string;
  serviceCode?: string;      // e.g. "SKTM-01", "SKU-01", "SKD-01", "SPK-01"
  serviceName?: string;      // e.g. "Surat Keterangan Tidak Mampu (SKTM)"
  statusFilter?: string[];   // e.g. ["DIAJUKAN", "DIPERIKSA"], ["DISETUJUI"], ["SELESAI"]
  statusLabel?: string;      // e.g. "menunggu verifikasi", "disetujui", "selesai"
  timeFilter?: "BULAN_INI" | "BULAN_LALU";
  lastCount?: number;
  lastQuery?: string;
  lastAnswerSummary?: string;
  // State memori fitur & navigasi aplikasi
  activeFeatureId?: string;   // e.g. "staf_dashboard", "staf_verifikasi", "staf_master_layanan", "staf_data_pengguna"
  activeFeatureName?: string; // e.g. "Dashboard Administrasi", "Verifikasi Pengajuan"
  lastFeatureList?: string[]; // IDs fitur yang baru saja disebutkan dalam urutan [1, 2, 3, ...]
  activeDashboardName?: string; // e.g. "Dashboard Staf Desa"
  activePathname?: string;      // e.g. "/staf", "/staf/pengajuan"
  updatedAt: number;
}

// In-memory session store (keyed by userId or guestSessionId)
// TTL: 30 menit tidak aktif
const SESSION_TTL_MS = 30 * 60 * 1000;
const sessionStore = new Map<string, ConversationState>();

/**
 * Mengambil state konteks percakapan aktif untuk user/session.
 * Jika in-memory state tidak ada (misal server baru restart),
 * dapat merekonstruksi konteks dari riwayat pesan sebelumnya.
 */
export function getSessionState(
  sessionKey: string,
  historyMessages?: Array<{ role: string; content: string }>
): ConversationState {
  const existing = sessionStore.get(sessionKey);
  const now = Date.now();

  if (existing && now - existing.updatedAt < SESSION_TTL_MS) {
    return existing;
  }

  // Jika tidak ada di memory atau sudah kedaluwarsa, coba infer dari history jika ada
  if (historyMessages && historyMessages.length >= 2) {
    const inferred = inferStateFromHistory(historyMessages);
    if (inferred) {
      sessionStore.set(sessionKey, inferred);
      return inferred;
    }
  }

  // Default empty state
  const defaultState: ConversationState = {
    entity: "NONE",
    updatedAt: now,
  };
  return defaultState;
}

/**
 * Menyimpan / memperbarui state konteks percakapan.
 */
export function updateSessionState(
  sessionKey: string,
  updates: Partial<ConversationState>
): ConversationState {
  const current = sessionStore.get(sessionKey) || {
    entity: "NONE",
    updatedAt: Date.now(),
  };

  const updated: ConversationState = {
    ...current,
    ...updates,
    updatedAt: Date.now(),
  };

  sessionStore.set(sessionKey, updated);
  return updated;
}

/**
 * Membersihkan / mereset konteks percakapan untuk user/session (misal klik Reset Chat).
 */
export function clearSessionState(sessionKey: string): void {
  sessionStore.delete(sessionKey);
}

/**
 * Heuristik rekonstruksi konteks dari riwayat pesan jika memory cache dingin/hilang.
 */
export function inferStateFromHistory(
  messages: Array<{ role: string; content: string }>
): ConversationState | null {
  if (!messages || messages.length === 0) return null;

  // Telusuri pesan dari yang paling akhir ke belakang (maksimal 6 pesan terakhir)
  const recentMessages = messages.slice(-6);

  for (let i = recentMessages.length - 1; i >= 0; i--) {
    const msg = recentMessages[i];
    const text = (msg.content || "").toLowerCase();

    // 1. Apakah ada indikasi SKTM / SKU / Surat spesifik?
    if (text.includes("sktm") || text.includes("tidak mampu")) {
      return {
        entity: "SURAT",
        serviceCode: "SKTM-01",
        serviceName: "Surat Keterangan Tidak Mampu (SKTM)",
        updatedAt: Date.now(),
      };
    }
    if (text.includes("sku") || text.includes("keterangan usaha")) {
      return {
        entity: "SURAT",
        serviceCode: "SKU-01",
        serviceName: "Surat Keterangan Usaha (SKU)",
        updatedAt: Date.now(),
      };
    }
    if (text.includes("skd") || text.includes("domisili")) {
      return {
        entity: "SURAT",
        serviceCode: "SKD-01",
        serviceName: "Surat Keterangan Domisili (SKD)",
        updatedAt: Date.now(),
      };
    }

    // 2. Apakah ada indikasi warga terdaftar?
    if (
      text.includes("warga yang terdaftar") ||
      text.includes("jumlah warga") ||
      text.includes("total warga") ||
      text.includes("akun warga") ||
      text.includes("data kependudukan") ||
      text.includes("berapa warga") ||
      text.includes("ada berapa warga") ||
      text.includes("berapa jumlah warga") ||
      text.includes("warga terdaftar")
    ) {
      return {
        entity: "WARGA",
        updatedAt: Date.now(),
      };
    }

    // 3. Apakah ada indikasi pengajuan verifikasi / pengajuan umum?
    if (
      text.includes("menunggu verifikasi") ||
      text.includes("belum diverifikasi") ||
      text.includes("pengajuan yang masuk") ||
      text.includes("pengajuan masuk") ||
      text.includes("antrean pengajuan") ||
      text.includes("total pengajuan") ||
      text.includes("jumlah pengajuan") ||
      text.includes("berapa pengajuan") ||
      text.includes("ada berapa pengajuan") ||
      text.includes("pengajuan selesai") ||
      text.includes("pengajuan ditolak") ||
      text.includes("pengajuan yang masih diproses")
    ) {
      let statusFilter: string[] | undefined;
      let statusLabel: string | undefined;
      if (text.includes("selesai")) {
        statusFilter = ["SELESAI"];
        statusLabel = "selesai";
      } else if (text.includes("ditolak")) {
        statusFilter = ["DITOLAK"];
        statusLabel = "ditolak";
      } else if (text.includes("diproses")) {
        statusFilter = ["DIAJUKAN", "DIPERIKSA", "PERLU_PERBAIKAN", "MENUNGGU_VALIDASI", "DISETUJUI_SUPERVISOR", "MENUNGGU_APPROVAL_KEPALA_DESA", "DISETUJUI"];
        statusLabel = "sedang diproses";
      } else if (text.includes("validasi")) {
        statusFilter = ["MENUNGGU_VALIDASI"];
        statusLabel = "menunggu validasi";
      }
      return {
        entity: "PENGAJUAN",
        statusFilter,
        statusLabel,
        updatedAt: Date.now(),
      };
    }

    // 4. Apakah ada indikasi staf desa?
    if (
      text.includes("jumlah staf") ||
      text.includes("staf desa") ||
      text.includes("operator pelayanan") ||
      text.includes("berapa staf") ||
      text.includes("ada berapa staf")
    ) {
      return {
        entity: "STAF",
        updatedAt: Date.now(),
      };
    }

    // 4b. Apakah ada indikasi Kepala Desa?
    if (text.includes("kades") || text.includes("kepala desa")) {
      return {
        entity: "KADES",
        updatedAt: Date.now(),
      };
    }

    // 5. Apakah ada indikasi fitur dashboard / menu aplikasi?
    if (
      text.includes("fitur") ||
      text.includes("dashboard") ||
      text.includes("menu") ||
      text.includes("fungsi menu") ||
      text.includes("fasilitas")
    ) {
      let featureList: string[] | undefined;
      if (text.includes("dashboard staf") || text.includes("verifikasi pengajuan")) {
        featureList = ["staf_dashboard", "staf_verifikasi", "staf_master_layanan", "staf_data_pengguna"];
      } else if (text.includes("dashboard supervisor") || text.includes("validasi pengajuan")) {
        featureList = ["supervisor_dashboard", "supervisor_validasi", "supervisor_laporan", "supervisor_database", "supervisor_audit"];
      } else if (text.includes("dashboard kepala desa") || text.includes("approval pengajuan")) {
        featureList = ["kades_dashboard", "kades_approval", "kades_laporan", "kades_audit"];
      } else if (text.includes("dashboard pelayanan warga") || text.includes("ajukan pelayanan")) {
        featureList = ["warga_dashboard", "warga_ajukan", "warga_status", "warga_asisten_ai"];
      }
      return {
        entity: "FITUR",
        lastFeatureList: featureList,
        updatedAt: Date.now(),
      };
    }

    // 6. Apakah ada indikasi statistik bulanan?
    if (text.includes("pengajuan bulan ini") || text.includes("bulan ini")) {
      return {
        entity: "STATISTIK",
        timeFilter: "BULAN_INI",
        updatedAt: Date.now(),
      };
    }
  }

  return null;
}

