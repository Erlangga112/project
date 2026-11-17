import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import {
  loadCustomApiKeys,
  addCustomApiKey,
  deleteCustomApiKey,
  toggleCustomApiKeyStatus,
  loadCoreProvidersStatus,
  toggleCoreProviderStatus,
  CustomApiKeyEntry,
} from "@/lib/ai/custom-keys";

const ENV_PATH = join(process.cwd(), ".env.local");

/**
 * Baca file .env.local dan parse menjadi object key-value.
 */
function readEnvFile(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {};
  const content = readFileSync(ENV_PATH, "utf-8");
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key) result[key] = value;
  }
  return result;
}

/**
 * Tulis object key-value ke file .env.local dengan mempertahankan komentar.
 */
function writeEnvFile(updates: Record<string, string>) {
  const existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf-8") : "";
  const lines = existing.split("\n");

  // Update baris yang sudah ada
  const updatedKeys = new Set<string>();
  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) return line;
    const key = trimmed.slice(0, eqIdx).trim();
    if (key in updates) {
      updatedKeys.add(key);
      const val = updates[key];
      // Gunakan kutip jika value mengandung spasi atau karakter khusus
      const needsQuote = /[\s#]/.test(val);
      return `${key}=${needsQuote ? `"${val}"` : val}`;
    }
    return line;
  });

  // Tambahkan key baru yang belum ada
  for (const [key, val] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      const needsQuote = /[\s#]/.test(val);
      newLines.push(`${key}=${needsQuote ? `"${val}"` : val}`);
    }
  }

  writeFileSync(ENV_PATH, newLines.join("\n"), "utf-8");
}

/**
 * Mask API key: tampilkan 6 karakter awal dan akhir, sisanya diganti *
 */
function maskKey(value: string): string {
  if (!value || value.length <= 12) return value ? "***" : "";
  return value.slice(0, 6) + "*".repeat(Math.min(value.length - 12, 20)) + value.slice(-6);
}

function isOnlyMask(value: string): boolean {
  // Jika user tidak mengubah (nilai masih berupa mask), abaikan
  return /^\*+$/.test(value.replace(/^.{0,6}/, "").replace(/.{0,6}$/, ""));
}

/** Kunci-kunci yang boleh dikelola via API ini (whitelist ketat) */
const ALLOWED_AI_KEYS = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "GEMINI_API_KEY",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_MODEL",
  "GROQ_API_KEY",
  "GROQ_BASE_URL",
  "GROQ_MODEL",
];

const ALLOWED_NOTIF_KEYS = [
  "FONNTE_TOKEN",
  "FOONTE_API_TOKEN",
  "FONNTE_API_URL",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "NOTIFICATION_FROM_NAME",
  "NOTIFICATION_FROM_EMAIL",
];

const ALL_ALLOWED = [...ALLOWED_AI_KEYS, ...ALLOWED_NOTIF_KEYS];

/**
 * GET: Kembalikan status konfigurasi (nilai dimasking, bukan nilai asli) beserta daftar custom keys
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Forbidden. Hanya Supervisor yang dapat mengakses." }, { status: 403 });
  }

  const env = readEnvFile();
  const coreStatus = loadCoreProvidersStatus();

  // Ambil nilai AI default dari env
  const aiConfig = {
    openai: {
      apiKey: maskKey(env["OPENAI_API_KEY"] || ""),
      model: env["OPENAI_MODEL"] || "gpt-4o-mini",
      isConfigured: Boolean(env["OPENAI_API_KEY"]),
      isActive: coreStatus.openai,
    },
    gemini: {
      apiKey: maskKey(env["GEMINI_API_KEY"] || ""),
      isConfigured: Boolean(env["GEMINI_API_KEY"]),
      isActive: coreStatus.gemini,
    },
    deepseek: {
      apiKey: maskKey(env["DEEPSEEK_API_KEY"] || ""),
      baseUrl: env["DEEPSEEK_BASE_URL"] || "https://api.deepseek.com",
      model: env["DEEPSEEK_MODEL"] || "deepseek-chat",
      isConfigured: Boolean(env["DEEPSEEK_API_KEY"]),
      isActive: coreStatus.deepseek,
    },
    groq: {
      apiKey: maskKey(env["GROQ_API_KEY"] || ""),
      baseUrl: env["GROQ_BASE_URL"] || "https://api.groq.com/openai/v1",
      model: env["GROQ_MODEL"] || "qwen/qwen3.8-27b",
      isConfigured: Boolean(env["GROQ_API_KEY"]),
      isActive: coreStatus.groq,
    },
  };

  // Ambil daftar custom keys yang ditambahkan supervisor (dimasking juga)
  const customKeys = loadCustomApiKeys().map((k) => ({
    ...k,
    apiKey: maskKey(k.apiKey),
  }));

  // Ambil nilai notifikasi
  const notifConfig = {
    whatsapp: {
      fonnte: {
        token: maskKey(env["FONNTE_TOKEN"] || env["FOONTE_API_TOKEN"] || ""),
        apiUrl: env["FONNTE_API_URL"] || "https://api.fonnte.com/send",
        isConfigured: Boolean(env["FONNTE_TOKEN"] || env["FOONTE_API_TOKEN"]),
      },
    },
    email: {
      gmailUser: env["GMAIL_USER"] || "",
      gmailAppPassword: maskKey(env["GMAIL_APP_PASSWORD"] || ""),
      fromName: env["NOTIFICATION_FROM_NAME"] || "",
      fromEmail: env["NOTIFICATION_FROM_EMAIL"] || "",
      isConfigured: Boolean(env["GMAIL_USER"] && env["GMAIL_APP_PASSWORD"]),
    },
  };

  return NextResponse.json({ aiConfig, customKeys, notifConfig });
}

/**
 * POST: Menambahkan API Key Baru (Bisa untuk provider utama maupun cadangan/custom)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Forbidden. Hanya Supervisor yang dapat menambahkan API Key." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { provider, name, apiKey, baseUrl, model, setAsPrimary } = body;

    if (!provider || !name || !apiKey || !apiKey.trim()) {
      return NextResponse.json({ error: "Provider, nama, dan API Key wajib diisi." }, { status: 400 });
    }

    const cleanKey = apiKey.trim();
    const cleanName = name.trim();

    // 1. Tambahkan ke koleksi custom API keys
    const newEntry = addCustomApiKey({
      provider,
      name: cleanName,
      apiKey: cleanKey,
      baseUrl: baseUrl?.trim() || undefined,
      model: model?.trim() || undefined,
      isActive: true,
    });

    // 2. Jika dicentang "Set sebagai Kunci Utama", perbarui juga environment variable aktif di .env.local
    if (setAsPrimary) {
      const updates: Record<string, string> = {};
      if (provider === "groq") {
        updates.GROQ_API_KEY = cleanKey;
        if (baseUrl) updates.GROQ_BASE_URL = baseUrl.trim();
        if (model) updates.GROQ_MODEL = model.trim();
      } else if (provider === "gemini") {
        updates.GEMINI_API_KEY = cleanKey;
      } else if (provider === "deepseek") {
        updates.DEEPSEEK_API_KEY = cleanKey;
        if (baseUrl) updates.DEEPSEEK_BASE_URL = baseUrl.trim();
        if (model) updates.DEEPSEEK_MODEL = model.trim();
      } else if (provider === "openai") {
        updates.OPENAI_API_KEY = cleanKey;
        if (model) updates.OPENAI_MODEL = model.trim();
      }

      if (Object.keys(updates).length > 0) {
        writeEnvFile(updates);
        for (const [k, v] of Object.entries(updates)) {
          process.env[k] = v;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `API Key "${cleanName}" untuk ${provider.toUpperCase()} berhasil ditambahkan!${
        setAsPrimary ? " Kunci juga langsung diaktifkan sebagai kunci utama." : ""
      }`,
      entry: {
        ...newEntry,
        apiKey: maskKey(newEntry.apiKey),
      },
    });
  } catch (err: any) {
    console.error("POST /api/supervisor/settings error:", err);
    return NextResponse.json({ error: err.message || "Gagal menambahkan API Key" }, { status: 500 });
  }
}

/**
 * PATCH: Mengubah status aktif / nonaktif API Key (baik Core Provider maupun Custom Keys)
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Forbidden. Hanya Supervisor yang dapat mengubah status API Key." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, provider, isActive } = body;

    if (typeof isActive !== "boolean") {
      return NextResponse.json({ error: "Status isActive wajib bernilai boolean." }, { status: 400 });
    }

    // Kasus 1: Toggle Core Provider (openai, gemini, deepseek, groq)
    if (provider && ["openai", "gemini", "deepseek", "groq"].includes(provider)) {
      const updated = toggleCoreProviderStatus(provider as any, isActive);
      return NextResponse.json({
        success: true,
        message: `Provider ${provider.toUpperCase()} berhasil ${isActive ? "diaktifkan (dinyalakan)" : "dinonaktifkan (dimatikan)"}.`,
        provider,
        isActive,
        coreStatus: updated,
      });
    }

    // Kasus 2: Toggle Custom API Key berdasarkan ID
    if (id) {
      const updated = toggleCustomApiKeyStatus(id, isActive);
      if (!updated) {
        return NextResponse.json({ error: "API Key tidak ditemukan." }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: `API Key berhasil ${isActive ? "diaktifkan (dinyalakan)" : "dinonaktifkan (dimatikan)"}.`,
        id,
        isActive,
      });
    }

    return NextResponse.json({ error: "ID atau nama provider wajib disertakan." }, { status: 400 });
  } catch (err: any) {
    console.error("PATCH /api/supervisor/settings error:", err);
    return NextResponse.json({ error: err.message || "Gagal mengubah status API Key" }, { status: 500 });
  }
}

/**
 * DELETE: Menghapus Custom API Key
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Forbidden. Hanya Supervisor yang dapat menghapus API Key." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID API Key wajib disertakan." }, { status: 400 });
    }

    const deleted = deleteCustomApiKey(id);
    if (!deleted) {
      return NextResponse.json({ error: "API Key tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "API Key berhasil dihapus dari daftar.",
    });
  } catch (err: any) {
    console.error("DELETE /api/supervisor/settings error:", err);
    return NextResponse.json({ error: err.message || "Gagal menghapus API Key" }, { status: 500 });
  }
}

/**
 * PUT: Simpan perubahan konfigurasi ke .env.local
 * Hanya key yang ada dalam whitelist yang boleh disimpan.
 * Nilai yang masih berupa mask (tidak diubah user) diabaikan.
 */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Forbidden. Hanya Supervisor yang dapat mengubah konfigurasi." }, { status: 403 });
  }

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  // Filter hanya key yang diizinkan dan nilai yang bukan pure mask
  const toUpdate: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!ALL_ALLOWED.includes(key)) continue; // Tolak key di luar whitelist
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    // Jika nilai masih berupa mask (pengguna tidak mengubah), skip
    if (isOnlyMask(trimmed)) continue;
    toUpdate[key] = trimmed;
  }

  if (Object.keys(toUpdate).length === 0) {
    return NextResponse.json({ success: true, message: "Tidak ada perubahan yang perlu disimpan." });
  }

  try {
    writeEnvFile(toUpdate);

    // Update process.env agar efektif tanpa restart (untuk session saat ini)
    for (const [key, value] of Object.entries(toUpdate)) {
      process.env[key] = value;
    }

    return NextResponse.json({
      success: true,
      message: `${Object.keys(toUpdate).length} konfigurasi berhasil disimpan.`,
      updatedKeys: Object.keys(toUpdate),
    });
  } catch (err) {
    console.error("Settings write error:", err);
    return NextResponse.json({ error: "Gagal menyimpan konfigurasi ke file .env.local" }, { status: 500 });
  }
}
