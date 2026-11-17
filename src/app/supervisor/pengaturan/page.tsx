"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

interface CustomKeyItem {
  id: string;
  provider: "openai" | "gemini" | "deepseek" | "groq" | "custom";
  name: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  isActive: boolean;
  createdAt: string;
}

export default function SupervisorSettingsPage() {
  const [activeTab, setActiveTab] = useState<"ai" | "notifikasi">("ai");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states untuk AI Chatbot (Default Provider)
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [deepseekBaseUrl, setDeepseekBaseUrl] = useState("https://api.deepseek.com");
  const [deepseekModel, setDeepseekModel] = useState("deepseek-chat");
  const [groqKey, setGroqKey] = useState("");
  const [groqBaseUrl, setGroqBaseUrl] = useState("https://api.groq.com/openai/v1");
  const [groqModel, setGroqModel] = useState("qwen/qwen3.8-27b");

  // Form states untuk Tambah API Key Baru (Modal)
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyProvider, setNewKeyProvider] = useState<"groq" | "deepseek" | "gemini" | "openai">("groq");
  const [newKeyName, setNewKeyName] = useState("");
  const [newApiKeyVal, setNewApiKeyVal] = useState("");
  const [newKeyBaseUrl, setNewKeyBaseUrl] = useState("https://api.groq.com/openai/v1");
  const [newKeyModel, setNewKeyModel] = useState("qwen/qwen3.8-27b");
  const [newKeySetPrimary, setNewKeySetPrimary] = useState(true);
  const [isAddingKey, setIsAddingKey] = useState(false);

  // List of custom added keys
  const [customKeys, setCustomKeys] = useState<CustomKeyItem[]>([]);

  // Form states untuk Notifikasi
  const [fonnteToken, setFonnteToken] = useState("");
  const [fonnteApiUrl, setFonnteApiUrl] = useState("https://api.fonnte.com/send");
  const [gmailUser, setGmailUser] = useState("");
  const [gmailAppPassword, setGmailAppPassword] = useState("");
  const [notificationFromName, setNotificationFromName] = useState("");
  const [notificationFromEmail, setNotificationFromEmail] = useState("");

  // Testing states
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  // Original configuration status from server
  const [configSummary, setConfigSummary] = useState<any>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/supervisor/settings");
      if (!res.ok) throw new Error("Gagal mengambil pengaturan");
      const data = await res.json();
      setConfigSummary(data);

      // AI States
      if (data.aiConfig) {
        setOpenaiKey(data.aiConfig.openai?.apiKey || "");
        setOpenaiModel(data.aiConfig.openai?.model || "gpt-4o-mini");
        setGeminiKey(data.aiConfig.gemini?.apiKey || "");
        setDeepseekKey(data.aiConfig.deepseek?.apiKey || "");
        setDeepseekBaseUrl(data.aiConfig.deepseek?.baseUrl || "https://api.deepseek.com");
        setDeepseekModel(data.aiConfig.deepseek?.model || "deepseek-chat");
        setGroqKey(data.aiConfig.groq?.apiKey || "");
        setGroqBaseUrl(data.aiConfig.groq?.baseUrl || "https://api.groq.com/openai/v1");
        setGroqModel(data.aiConfig.groq?.model || "qwen/qwen3.8-27b");
      }

      // Custom Keys
      if (data.customKeys) {
        setCustomKeys(data.customKeys);
      }

      // Notifikasi States
      if (data.notifConfig) {
        setFonnteToken(data.notifConfig.whatsapp?.fonnte?.token || "");
        setFonnteApiUrl(data.notifConfig.whatsapp?.fonnte?.apiUrl || "https://api.fonnte.com/send");
        setGmailUser(data.notifConfig.email?.gmailUser || "");
        setGmailAppPassword(data.notifConfig.email?.gmailAppPassword || "");
        setNotificationFromName(data.notifConfig.email?.fromName || "");
        setNotificationFromEmail(data.notifConfig.email?.fromEmail || "");
      }
    } catch (err: any) {
      setSaveMessage({ type: "error", text: err.message || "Gagal memuat pengaturan" });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddNewKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim() || !newApiKeyVal.trim()) {
      alert("Nama label dan API Key wajib diisi!");
      return;
    }

    setIsAddingKey(true);
    try {
      const res = await fetch("/api/supervisor/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: newKeyProvider,
          name: newKeyName.trim(),
          apiKey: newApiKeyVal.trim(),
          baseUrl: newKeyBaseUrl?.trim() || undefined,
          model: newKeyModel?.trim() || undefined,
          setAsPrimary: newKeySetPrimary,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambahkan API key");

      setSaveMessage({ type: "success", text: data.message || "Kunci API baru berhasil ditambahkan!" });
      setShowAddModal(false);
      // Reset form
      setNewKeyName("");
      setNewApiKeyVal("");
      // Refresh
      await fetchSettings();
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan saat menambahkan API key");
    } finally {
      setIsAddingKey(false);
    }
  }

  async function handleToggleCoreProvider(provider: "groq" | "deepseek" | "gemini" | "openai", currentStatus: boolean) {
    const nextStatus = !currentStatus;
    try {
      const res = await fetch("/api/supervisor/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, isActive: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status provider");

      setSaveMessage({ type: "success", text: data.message });
      await fetchSettings();
    } catch (err: any) {
      alert(err.message || "Gagal mengubah status provider");
    }
  }

  async function handleToggleKeyStatus(id: string, name: string, currentStatus: boolean) {
    const nextStatus = !currentStatus;
    try {
      const res = await fetch("/api/supervisor/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status API key");

      setSaveMessage({ type: "success", text: data.message });
      await fetchSettings();
    } catch (err: any) {
      alert(err.message || "Gagal mengubah status");
    }
  }

  async function handleDeleteKey(id: string, name: string) {
    if (!confirm(`Hapus API Key "${name}"?`)) return;

    try {
      const res = await fetch(`/api/supervisor/settings?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus API key");

      setSaveMessage({ type: "success", text: data.message });
      await fetchSettings();
    } catch (err: any) {
      alert(err.message || "Gagal menghapus API key");
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);

    const payload: Record<string, string> = {};

    if (activeTab === "ai") {
      if (openaiKey) payload.OPENAI_API_KEY = openaiKey;
      if (openaiModel) payload.OPENAI_MODEL = openaiModel;
      if (geminiKey) payload.GEMINI_API_KEY = geminiKey;
      if (deepseekKey) payload.DEEPSEEK_API_KEY = deepseekKey;
      if (deepseekBaseUrl) payload.DEEPSEEK_BASE_URL = deepseekBaseUrl;
      if (deepseekModel) payload.DEEPSEEK_MODEL = deepseekModel;
      if (groqKey) payload.GROQ_API_KEY = groqKey;
      if (groqBaseUrl) payload.GROQ_BASE_URL = groqBaseUrl;
      if (groqModel) payload.GROQ_MODEL = groqModel;
    } else {
      if (fonnteToken) {
        payload.FONNTE_TOKEN = fonnteToken;
        payload.FOONTE_API_TOKEN = fonnteToken;
      }
      if (fonnteApiUrl) payload.FONNTE_API_URL = fonnteApiUrl;
      if (gmailUser) payload.GMAIL_USER = gmailUser;
      if (gmailAppPassword) payload.GMAIL_APP_PASSWORD = gmailAppPassword;
      if (notificationFromName) payload.NOTIFICATION_FROM_NAME = notificationFromName;
      if (notificationFromEmail) payload.NOTIFICATION_FROM_EMAIL = notificationFromEmail;
    }

    try {
      const res = await fetch("/api/supervisor/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan pengaturan");
      setSaveMessage({ type: "success", text: data.message || "Pengaturan berhasil diperbarui." });
      await fetchSettings();
    } catch (err: any) {
      setSaveMessage({ type: "error", text: err.message || "Terjadi kesalahan saat menyimpan" });
    } finally {
      setSaving(false);
    }
  }

  async function testAiConnection(providerOrKeyId: string) {
    setTestingProvider(providerOrKeyId);
    try {
      const res = await fetch(`/api/chatbot/provider/status?provider=${providerOrKeyId}`);
      const data = await res.json();
      const status = data.status;
      const isOk = Boolean(status?.ok || status?.connected || status?.success);

      if (isOk) {
        setTestResults((prev) => ({
          ...prev,
          [providerOrKeyId]: {
            success: true,
            message: status?.message || `Terhubung aktif (${status?.latencyMs || 0}ms)`,
          },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [providerOrKeyId]: {
            success: false,
            message: status?.message || status?.error || "Gagal terhubung ke provider",
          },
        }));
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [providerOrKeyId]: {
          success: false,
          message: err.message || "Kesalahan jaringan",
        },
      }));
    } finally {
      setTestingProvider(null);
    }
  }

  return (
    <div className="page-container">
      {/* ── Header ── */}
      <header className="dashboard-header">
        <div className="dashboard-header-top">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="role-badge">Supervisor</span>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                Pengaturan API & Integrasi
              </h1>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm lg:text-base">
              Kelola dan uji kredensial provider AI Chatbot (Gemini, Groq, DeepSeek, OpenAI) serta kanal notifikasi sistem desa.
            </p>
          </div>
          <LogoutButton />
        </div>

        <nav className="header-nav" aria-label="Menu supervisor">
          <Link href="/supervisor" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>
          <Link href="/supervisor/pengajuan" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Validasi Pengajuan
          </Link>
          <Link href="/supervisor/laporan" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Laporan & Statistik
          </Link>
          <Link href="/supervisor/database" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            Database Desa
          </Link>
          <Link href="/supervisor/audit" className="nav-link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Audit Logs
          </Link>
          <Link href="/supervisor/pengaturan" className="nav-link nav-link-active">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Pengaturan API
          </Link>
        </nav>
      </header>

      {/* ── Main Content Container ── */}
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 space-x-2 bg-white px-4 pt-2 rounded-t-xl shadow-xs">
          <button
            onClick={() => setActiveTab("ai")}
            className={`py-3 px-4 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "ai"
                ? "border-[#0F766E] text-[#0F766E]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Provider AI Chatbot
            {customKeys.length > 0 && (
              <span className="ml-1 bg-teal-100 text-teal-800 text-xs px-2 py-0.5 rounded-full font-bold">
                {customKeys.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("notifikasi")}
            className={`py-3 px-4 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "notifikasi"
                ? "border-[#0F766E] text-[#0F766E]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Kanal Notifikasi (WhatsApp & Email)
          </button>
        </div>

        {/* Status Message Notification */}
        {saveMessage && (
          <div
            className={`p-4 rounded-xl text-sm flex items-center justify-between border shadow-xs transition-all ${
              saveMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2.5 font-medium">
              {saveMessage.type === "success" ? (
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-200 text-emerald-800 font-bold text-xs">
                  ✓
                </span>
              ) : (
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-rose-200 text-rose-800 font-bold text-xs">
                  ✕
                </span>
              )}
              <span>{saveMessage.text}</span>
            </div>
            <button
              onClick={() => setSaveMessage(null)}
              className="text-slate-400 hover:text-slate-700 font-bold px-2 py-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col justify-center items-center gap-3 shadow-xs">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-teal-600"></div>
            <p className="text-sm text-slate-500 font-medium">Memuat konfigurasi API sistem...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── TAB 1: AI Chatbot Providers ── */}
            {activeTab === "ai" && (
              <div className="space-y-6">
                {/* Header Action: Banner + Add Key Button */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                      <span>⚡</span> Manajemen & Konfigurasi API Key AI
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                      Konfigurasikan kunci API untuk provider chatbot desa (Groq, Gemini, DeepSeek, OpenAI), uji koneksi secara langsung, atau tambahkan kunci baru yang Anda miliki.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewKeyProvider("groq");
                      setNewKeyModel("qwen/qwen3.8-27b");
                      setNewKeyBaseUrl("https://api.groq.com/openai/v1");
                      setShowAddModal(true);
                    }}
                    className="px-4 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>+ Tambah API Key Baru</span>
                  </button>
                </div>

                {/* Custom Keys Table / List */}
                {customKeys.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          <span>🔑</span> Kunci API Tambahan Terdaftar ({customKeys.length})
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Kunci API tambahan yang siap digunakan dan dapat diuji koneksinya secara langsung.
                        </p>
                      </div>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                        Tersimpan di server
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-3">Status</th>
                            <th className="py-3 px-3">Provider</th>
                            <th className="py-3 px-3">Label / Nama Kunci</th>
                            <th className="py-3 px-3">Kunci (Masked)</th>
                            <th className="py-3 px-3">Model</th>
                            <th className="py-3 px-3">Hasil Uji</th>
                            <th className="py-3 px-3 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {customKeys.map((k) => (
                            <tr key={k.id} className={`hover:bg-slate-50/80 transition-colors ${!k.isActive ? "bg-slate-50/50 opacity-60" : ""}`}>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleToggleKeyStatus(k.id, k.name, k.isActive)}
                                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                    k.isActive ? "bg-emerald-600" : "bg-slate-300"
                                  }`}
                                  title={k.isActive ? "Klik untuk Menonaktifkan" : "Klik untuk Mengaktifkan"}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                      k.isActive ? "translate-x-4" : "translate-x-0"
                                    }`}
                                  />
                                </button>
                                <span className={`ml-2 text-[11px] font-semibold ${k.isActive ? "text-emerald-700" : "text-slate-500"}`}>
                                  {k.isActive ? "Aktif" : "Nonaktif"}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span className={`uppercase font-bold px-2 py-0.5 rounded text-[10px] border ${
                                  k.provider === "groq"
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : k.provider === "gemini"
                                    ? "bg-teal-50 text-teal-800 border-teal-200"
                                    : k.provider === "deepseek"
                                    ? "bg-sky-50 text-sky-800 border-sky-200"
                                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                }`}>
                                  {k.provider}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-semibold text-slate-900">{k.name}</td>
                              <td className="py-3 px-3 font-mono text-slate-600">{k.apiKey}</td>
                              <td className="py-3 px-3 font-mono text-slate-600">{k.model || "-"}</td>
                              <td className="py-3 px-3">
                                {testResults[k.id] ? (
                                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded ${
                                    testResults[k.id].success
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-rose-50 text-rose-700 border border-rose-200"
                                  }`}>
                                    {testResults[k.id].success ? "✓" : "✕"} {testResults[k.id].message}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[11px]">Belum diuji</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right whitespace-nowrap space-x-1">
                                <button
                                  type="button"
                                  onClick={() => testAiConnection(k.id)}
                                  disabled={testingProvider === k.id}
                                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors cursor-pointer"
                                  title="Uji koneksi API key ini"
                                >
                                  {testingProvider === k.id ? "Menguji..." : "⚡ Uji"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleKeyStatus(k.id, k.name, k.isActive)}
                                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                                    k.isActive
                                      ? "text-amber-700 hover:bg-amber-50"
                                      : "text-emerald-700 hover:bg-emerald-50"
                                  }`}
                                >
                                  {k.isActive ? "Matikan" : "Nyalakan"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteKey(k.id, k.name)}
                                  className="text-rose-600 hover:bg-rose-50 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer"
                                  title="Hapus API Key ini"
                                >
                                  Hapus
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Modal Tambah API Key Baru */}
                {showAddModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <span>➕</span> Tambah Kunci API Baru
                        </h3>
                        <button
                          type="button"
                          onClick={() => setShowAddModal(false)}
                          className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      <form onSubmit={handleAddNewKey} className="space-y-4 text-xs">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Pilih Provider AI
                          </label>
                          <select
                            value={newKeyProvider}
                            onChange={(e) => {
                              const p = e.target.value as any;
                              setNewKeyProvider(p);
                              if (p === "groq") {
                                setNewKeyModel("qwen/qwen3.8-27b");
                                setNewKeyBaseUrl("https://api.groq.com/openai/v1");
                              } else if (p === "deepseek") {
                                setNewKeyModel("deepseek-chat");
                                setNewKeyBaseUrl("https://api.deepseek.com");
                              } else if (p === "gemini") {
                                setNewKeyModel("gemini-2.5-flash");
                                setNewKeyBaseUrl("https://generativelanguage.googleapis.com/v1beta/openai");
                              } else if (p === "openai") {
                                setNewKeyModel("gpt-4o-mini");
                                setNewKeyBaseUrl("https://api.openai.com/v1");
                              }
                            }}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-medium focus:bg-white focus:border-teal-600 focus:outline-none"
                          >
                            <option value="groq">⚡ Groq AI (Ultra Fast LPU)</option>
                            <option value="gemini">✨ Google Gemini AI</option>
                            <option value="deepseek">🐋 DeepSeek AI (Chat / Coder)</option>
                            <option value="openai">🟢 OpenAI / Endpoint Kompatibel</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Nama / Label Kunci (cth: "Groq Llama 3.3 70B", "Gemini Pribadi")
                          </label>
                          <input
                            type="text"
                            required
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            placeholder="cth: Groq Kunci Utama"
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-teal-600 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Nilai API Key
                          </label>
                          <input
                            type="text"
                            required
                            value={newApiKeyVal}
                            onChange={(e) => setNewApiKeyVal(e.target.value)}
                            placeholder="gsk_... / sk-... / AQ.Ab..."
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono focus:bg-white focus:border-teal-600 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Model yang Digunakan
                          </label>
                          <input
                            type="text"
                            required
                            value={newKeyModel}
                            onChange={(e) => setNewKeyModel(e.target.value)}
                            placeholder="Nama model..."
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono focus:bg-white focus:border-teal-600 focus:outline-none"
                          />
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <span className="text-[11px] text-slate-500 font-medium">Pilihan Cepat:</span>
                            {newKeyProvider === "groq" && (
                              <>
                                <button type="button" onClick={() => setNewKeyModel("qwen/qwen3.8-27b")} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono cursor-pointer">qwen/qwen3.8-27b</button>
                                <button type="button" onClick={() => setNewKeyModel("llama-3.3-70b-versatile")} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono cursor-pointer">llama-3.3-70b-versatile</button>
                                <button type="button" onClick={() => setNewKeyModel("llama-3.1-8b-instant")} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono cursor-pointer">llama-3.1-8b-instant</button>
                              </>
                            )}
                            {newKeyProvider === "gemini" && (
                              <>
                                <button type="button" onClick={() => setNewKeyModel("gemini-2.5-flash")} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono cursor-pointer">gemini-2.5-flash</button>
                                <button type="button" onClick={() => setNewKeyModel("gemini-2.0-flash")} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono cursor-pointer">gemini-2.0-flash</button>
                                <button type="button" onClick={() => setNewKeyModel("gemini-1.5-flash")} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono cursor-pointer">gemini-1.5-flash</button>
                              </>
                            )}
                            {newKeyProvider === "deepseek" && (
                              <>
                                <button type="button" onClick={() => setNewKeyModel("deepseek-chat")} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono cursor-pointer">deepseek-chat</button>
                                <button type="button" onClick={() => setNewKeyModel("deepseek-reasoner")} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono cursor-pointer">deepseek-reasoner</button>
                              </>
                            )}
                            {newKeyProvider === "openai" && (
                              <>
                                <button type="button" onClick={() => setNewKeyModel("gpt-4o-mini")} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono cursor-pointer">gpt-4o-mini</button>
                                <button type="button" onClick={() => setNewKeyModel("gpt-4o")} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono cursor-pointer">gpt-4o</button>
                              </>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Base URL (Opsional)
                          </label>
                          <input
                            type="text"
                            value={newKeyBaseUrl}
                            onChange={(e) => setNewKeyBaseUrl(e.target.value)}
                            placeholder="https://api.groq.com/openai/v1"
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono focus:bg-white focus:border-teal-600 focus:outline-none"
                          />
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                          <input
                            type="checkbox"
                            id="set-primary-checkbox"
                            checked={newKeySetPrimary}
                            onChange={(e) => setNewKeySetPrimary(e.target.checked)}
                            className="mt-0.5 w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                          />
                          <label htmlFor="set-primary-checkbox" className="text-slate-700 cursor-pointer text-xs">
                            <span className="font-semibold text-slate-900 block">Jadikan sebagai Kunci Utama Aktif</span>
                            <span className="text-[11px] text-slate-500">
                              Otomatis memperbarui environment server (.env.local) untuk provider ini.
                            </span>
                          </label>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setShowAddModal(false)}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            type="submit"
                            disabled={isAddingKey}
                            className="px-5 py-2 bg-[#0F766E] hover:bg-[#0d655e] text-white font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {isAddingKey ? "Menambahkan..." : "Simpan Kunci Baru"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Form Utama untuk Mengedit Kunci Utama */}
                <form onSubmit={handleSaveSettings} className="space-y-6">
                  {/* Grid 4 Provider Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Card: Google Gemini */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-xl text-teal-700">
                              ✨
                            </span>
                            <div>
                              <h4 className="font-bold text-slate-900 text-base">Google Gemini</h4>
                              <p className="text-xs text-slate-500">Model native Google SDK</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleCoreProvider("gemini", configSummary?.aiConfig?.gemini?.isActive !== false)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                configSummary?.aiConfig?.gemini?.isActive !== false ? "bg-emerald-600" : "bg-slate-300"
                              }`}
                              title={configSummary?.aiConfig?.gemini?.isActive !== false ? "Klik untuk Menonaktifkan Gemini" : "Klik untuk Menyalakan Gemini"}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                  configSummary?.aiConfig?.gemini?.isActive !== false ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                                configSummary?.aiConfig?.gemini?.isActive === false
                                  ? "bg-slate-100 text-slate-500 border-slate-200"
                                  : configSummary?.aiConfig?.gemini?.isConfigured
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {configSummary?.aiConfig?.gemini?.isActive === false
                                ? "Nonaktif"
                                : configSummary?.aiConfig?.gemini?.isConfigured
                                ? "Aktif"
                                : "Belum Diisi"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3.5">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Gemini API Key (GEMINI_API_KEY)
                            </label>
                            <input
                              type="text"
                              value={geminiKey}
                              onChange={(e) => setGeminiKey(e.target.value)}
                              placeholder="AQ.Ab... atau AIzaSy..."
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Model yang Digunakan
                            </label>
                            <input
                              type="text"
                              value={geminiModel}
                              onChange={(e) => setGeminiModel(e.target.value)}
                              placeholder="gemini-2.5-flash"
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none font-mono"
                            />
                            <div className="flex gap-1.5 mt-1.5">
                              {["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"].map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setGeminiModel(m)}
                                  className={`text-[10px] px-2 py-0.5 rounded font-mono border cursor-pointer ${
                                    geminiModel === m
                                      ? "bg-teal-50 border-teal-300 text-teal-800 font-bold"
                                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                  }`}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => testAiConnection("gemini")}
                          disabled={testingProvider === "gemini"}
                          className="text-xs px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {testingProvider === "gemini" ? "Menguji..." : "⚡ Uji Koneksi"}
                        </button>

                        {testResults["gemini"] && (
                          <span
                            className={`text-xs px-2.5 py-1 rounded-lg font-medium border ${
                              testResults["gemini"].success
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {testResults["gemini"].success ? "✓ " : "✕ "}
                            {testResults["gemini"].message}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card: Groq AI */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-xl text-amber-700">
                              ⚡
                            </span>
                            <div>
                              <h4 className="font-bold text-slate-900 text-base">Groq AI (Ultra Fast)</h4>
                              <p className="text-xs text-slate-500">LPU Inference Engine</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleCoreProvider("groq", configSummary?.aiConfig?.groq?.isActive !== false)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                configSummary?.aiConfig?.groq?.isActive !== false ? "bg-emerald-600" : "bg-slate-300"
                              }`}
                              title={configSummary?.aiConfig?.groq?.isActive !== false ? "Klik untuk Menonaktifkan Groq" : "Klik untuk Menyalakan Groq"}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                  configSummary?.aiConfig?.groq?.isActive !== false ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                                configSummary?.aiConfig?.groq?.isActive === false
                                  ? "bg-slate-100 text-slate-500 border-slate-200"
                                  : configSummary?.aiConfig?.groq?.isConfigured
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {configSummary?.aiConfig?.groq?.isActive === false
                                ? "Nonaktif"
                                : configSummary?.aiConfig?.groq?.isConfigured
                                ? "Aktif"
                                : "Belum Diisi"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3.5">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Groq API Key (GROQ_API_KEY)
                            </label>
                            <input
                              type="text"
                              value={groqKey}
                              onChange={(e) => setGroqKey(e.target.value)}
                              placeholder="gsk_..."
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Base URL
                            </label>
                            <input
                              type="text"
                              value={groqBaseUrl}
                              onChange={(e) => setGroqBaseUrl(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Model
                            </label>
                            <input
                              type="text"
                              value={groqModel}
                              onChange={(e) => setGroqModel(e.target.value)}
                              placeholder="qwen/qwen3.8-27b"
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none font-mono"
                            />
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {["qwen/qwen3.8-27b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"].map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setGroqModel(m)}
                                  className={`text-[10px] px-2 py-0.5 rounded font-mono border cursor-pointer ${
                                    groqModel === m
                                      ? "bg-amber-50 border-amber-300 text-amber-800 font-bold"
                                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                  }`}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => testAiConnection("groq")}
                          disabled={testingProvider === "groq"}
                          className="text-xs px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {testingProvider === "groq" ? "Menguji..." : "⚡ Uji Koneksi"}
                        </button>

                        {testResults["groq"] && (
                          <span
                            className={`text-xs px-2.5 py-1 rounded-lg font-medium border ${
                              testResults["groq"].success
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {testResults["groq"].success ? "✓ " : "✕ "}
                            {testResults["groq"].message}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card: DeepSeek AI */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-xl text-sky-700">
                              🐋
                            </span>
                            <div>
                              <h4 className="font-bold text-slate-900 text-base">DeepSeek AI</h4>
                              <p className="text-xs text-slate-500">DeepSeek Chat / Coder</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleCoreProvider("deepseek", configSummary?.aiConfig?.deepseek?.isActive !== false)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                configSummary?.aiConfig?.deepseek?.isActive !== false ? "bg-emerald-600" : "bg-slate-300"
                              }`}
                              title={configSummary?.aiConfig?.deepseek?.isActive !== false ? "Klik untuk Menonaktifkan DeepSeek" : "Klik untuk Menyalakan DeepSeek"}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                  configSummary?.aiConfig?.deepseek?.isActive !== false ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                                configSummary?.aiConfig?.deepseek?.isActive === false
                                  ? "bg-slate-100 text-slate-500 border-slate-200"
                                  : configSummary?.aiConfig?.deepseek?.isConfigured
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {configSummary?.aiConfig?.deepseek?.isActive === false
                                ? "Nonaktif"
                                : configSummary?.aiConfig?.deepseek?.isConfigured
                                ? "Aktif"
                                : "Belum Diisi"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3.5">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              DeepSeek API Key (DEEPSEEK_API_KEY)
                            </label>
                            <input
                              type="text"
                              value={deepseekKey}
                              onChange={(e) => setDeepseekKey(e.target.value)}
                              placeholder="sk-..."
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Base URL
                            </label>
                            <input
                              type="text"
                              value={deepseekBaseUrl}
                              onChange={(e) => setDeepseekBaseUrl(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Model
                            </label>
                            <input
                              type="text"
                              value={deepseekModel}
                              onChange={(e) => setDeepseekModel(e.target.value)}
                              placeholder="deepseek-chat"
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none font-mono"
                            />
                            <div className="flex gap-1.5 mt-1.5">
                              {["deepseek-chat", "deepseek-reasoner"].map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setDeepseekModel(m)}
                                  className={`text-[10px] px-2 py-0.5 rounded font-mono border cursor-pointer ${
                                    deepseekModel === m
                                      ? "bg-sky-50 border-sky-300 text-sky-800 font-bold"
                                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                  }`}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => testAiConnection("deepseek")}
                          disabled={testingProvider === "deepseek"}
                          className="text-xs px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {testingProvider === "deepseek" ? "Menguji..." : "⚡ Uji Koneksi"}
                        </button>

                        {testResults["deepseek"] && (
                          <span
                            className={`text-xs px-2.5 py-1 rounded-lg font-medium border ${
                              testResults["deepseek"].success
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {testResults["deepseek"].success ? "✓ " : "✕ "}
                            {testResults["deepseek"].message}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card: OpenAI / NVIDIA NIM */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl text-emerald-700">
                              🟢
                            </span>
                            <div>
                              <h4 className="font-bold text-slate-900 text-base">OpenAI / Endpoint Kompatibel</h4>
                              <p className="text-xs text-slate-500">GPT-4o Mini / Llama 3</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleCoreProvider("openai", configSummary?.aiConfig?.openai?.isActive !== false)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                configSummary?.aiConfig?.openai?.isActive !== false ? "bg-emerald-600" : "bg-slate-300"
                              }`}
                              title={configSummary?.aiConfig?.openai?.isActive !== false ? "Klik untuk Menonaktifkan OpenAI" : "Klik untuk Menyalakan OpenAI"}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                  configSummary?.aiConfig?.openai?.isActive !== false ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                                configSummary?.aiConfig?.openai?.isActive === false
                                  ? "bg-slate-100 text-slate-500 border-slate-200"
                                  : configSummary?.aiConfig?.openai?.isConfigured
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {configSummary?.aiConfig?.openai?.isActive === false
                                ? "Nonaktif"
                                : configSummary?.aiConfig?.openai?.isConfigured
                                ? "Aktif"
                                : "Belum Diisi"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3.5">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              OpenAI API Key (OPENAI_API_KEY)
                            </label>
                            <input
                              type="text"
                              value={openaiKey}
                              onChange={(e) => setOpenaiKey(e.target.value)}
                              placeholder="sk-proj-... atau sk-..."
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Model
                            </label>
                            <input
                              type="text"
                              value={openaiModel}
                              onChange={(e) => setOpenaiModel(e.target.value)}
                              placeholder="gpt-4o-mini"
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none font-mono"
                            />
                            <div className="flex gap-1.5 mt-1.5">
                              {["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"].map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setOpenaiModel(m)}
                                  className={`text-[10px] px-2 py-0.5 rounded font-mono border cursor-pointer ${
                                    openaiModel === m
                                      ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-bold"
                                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                  }`}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => testAiConnection("openai")}
                          disabled={testingProvider === "openai"}
                          className="text-xs px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {testingProvider === "openai" ? "Menguji..." : "⚡ Uji Koneksi"}
                        </button>

                        {testResults["openai"] && (
                          <span
                            className={`text-xs px-2.5 py-1 rounded-lg font-medium border ${
                              testResults["openai"].success
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {testResults["openai"].success ? "✓ " : "✕ "}
                            {testResults["openai"].message}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-3 bg-[#0F766E] hover:bg-[#0d655e] disabled:opacity-50 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer text-sm"
                    >
                      {saving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Simpan Perubahan Kunci Utama</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── TAB 2: Notifikasi (WhatsApp & Email) ── */}
            {activeTab === "notifikasi" && (
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <span>📱</span> Pengaturan Kanal Notifikasi Otomatis
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Kanal ini digunakan sistem untuk mengirim konfirmasi pengajuan surat, rincian perbaikan berkas, serta notifikasi resmi ke warga dan aparatur desa.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* WhatsApp (Fonnte) */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl text-emerald-700">
                            💬
                          </span>
                          <div>
                            <h4 className="font-bold text-slate-900 text-base">WhatsApp Gateway (Fonnte)</h4>
                            <p className="text-xs text-slate-500">Pemberitahuan instan via WA</p>
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                            configSummary?.notifConfig?.whatsapp?.fonnte?.isConfigured
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {configSummary?.notifConfig?.whatsapp?.fonnte?.isConfigured ? "Aktif" : "Belum Diisi"}
                        </span>
                      </div>

                      <div className="space-y-3.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Fonnte API Token (FONNTE_TOKEN / FOONTE_API_TOKEN)
                          </label>
                          <input
                            type="text"
                            value={fonnteToken}
                            onChange={(e) => setFonnteToken(e.target.value)}
                            placeholder="Token dari fonnte.com..."
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            API URL
                          </label>
                          <input
                            type="text"
                            value={fonnteApiUrl}
                            onChange={(e) => setFonnteApiUrl(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none font-mono"
                          />
                        </div>

                        <p className="text-[11px] text-slate-500">
                          💡 Token ini otomatis disinkronkan ke kedua environment variable (<code>FONNTE_TOKEN</code> & <code>FOONTE_API_TOKEN</code>).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Gmail SMTP */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-xl text-rose-700">
                            ✉️
                          </span>
                          <div>
                            <h4 className="font-bold text-slate-900 text-base">Email Notifikasi (Gmail SMTP)</h4>
                            <p className="text-xs text-slate-500">Pengiriman dokumen & verifikasi warga</p>
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                            configSummary?.notifConfig?.email?.isConfigured
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {configSummary?.notifConfig?.email?.isConfigured ? "Aktif" : "Belum Diisi"}
                        </span>
                      </div>

                      <div className="space-y-3.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Email Gmail Pengirim (GMAIL_USER)
                          </label>
                          <input
                            type="email"
                            value={gmailUser}
                            onChange={(e) => setGmailUser(e.target.value)}
                            placeholder="kantordesa@gmail.com"
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            App Password 16 Digit (GMAIL_APP_PASSWORD)
                          </label>
                          <input
                            type="text"
                            value={gmailAppPassword}
                            onChange={(e) => setGmailAppPassword(e.target.value)}
                            placeholder="xxxx xxxx xxxx xxxx"
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none font-mono"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Nama Pengirim
                            </label>
                            <input
                              type="text"
                              value={notificationFromName}
                              onChange={(e) => setNotificationFromName(e.target.value)}
                              placeholder="Pelayanan Desa Perum"
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Email Tampil
                            </label>
                            <input
                              type="email"
                              value={notificationFromEmail}
                              onChange={(e) => setNotificationFromEmail(e.target.value)}
                              placeholder="noreply@desa.id"
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-3 bg-[#0F766E] hover:bg-[#0d655e] disabled:opacity-50 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer text-sm"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Simpan Perubahan Notifikasi</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
