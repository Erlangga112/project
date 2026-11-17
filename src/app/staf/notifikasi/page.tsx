"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useDebounce } from "use-debounce";

interface StaffContactItem {
  userId: string;
  nama: string;
  email: string;
  role: "STAF_DESA" | "SUPERVISOR" | "KEPALA_DESA";
  noWhatsapp: string | null;
  isActive: boolean;
  isVerified: boolean;
  notifyNewSubmission: boolean;
  notifyPendingValidation: boolean;
  notifyPendingApproval: boolean;
}

interface NotificationLogItem {
  id: string;
  channel: "EMAIL" | "WHATSAPP";
  event: string;
  recipient: string;
  recipientName: string | null;
  subject: string | null;
  message: string;
  status: "PENDING" | "SENT" | "FAILED" | "SKIPPED";
  providerMessageId: string | null;
  errorMessage: string | null;
  attemptCount: number;
  createdAt: string;
  pengajuan?: {
    nomorPengajuan: string;
    jenisLayanan: { nama: string };
  } | null;
}

interface ConfigStatus {
  gmail: {
    isConfigured: boolean;
    user: string | null;
    from: string | null;
    error: string | null;
  };
  whatsapp: {
    isConfigured: boolean;
    phoneNumberId: string | null;
    businessAccountId: string | null;
    apiVersion: string;
    hasAccessToken: boolean;
    verifiedName: string | null;
    displayPhoneNumber: string | null;
    error: string | null;
  };
  staffContacts: StaffContactItem[];
}

export default function NotifikasiConfigPage() {
  const [activeTab, setActiveTab] = useState<"petugas" | "testing" | "logs" | "panduan">("petugas");
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Edit Staff Modal State
  const [editingStaff, setEditingStaff] = useState<StaffContactItem | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [savingStaff, setSavingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSuccess, setStaffSuccess] = useState<string | null>(null);

  // Testing State
  const [testEmailTarget, setTestEmailTarget] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string; messageId?: string } | null>(null);

  const [testPhoneTarget, setTestPhoneTarget] = useState("");
  const [testingPhone, setTestingPhone] = useState(false);
  const [testPhoneResult, setTestPhoneResult] = useState<{ success: boolean; message: string; messageId?: string } | null>(null);

  // Testing WhatsApp Warga State
  const [testWargaPhone, setTestWargaPhone] = useState("");
  const [testWargaNama, setTestWargaNama] = useState("Bpk. Ahmad Fauzi");
  const [testWargaLayanan, setTestWargaLayanan] = useState("Surat Keterangan Usaha (SKU)");
  const [testWargaSkenario, setTestWargaSkenario] = useState("DIAJUKAN");
  const [testWargaCatatan, setTestWargaCatatan] = useState("");
  const [testingWargaPhone, setTestingWargaPhone] = useState(false);
  const [testWargaResult, setTestWargaResult] = useState<{
    success: boolean;
    message: string;
    messageId?: string;
    previewMessage?: string;
  } | null>(null);

  // Logs State
  const [logs, setLogs] = useState<NotificationLogItem[]>([]);
  const [metrics, setMetrics] = useState({ total: 0, sent: 0, failed: 0, skipped: 0 });
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [channelFilter, setChannelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchLogs, setSearchLogs] = useState("");
  const [debouncedSearchLogs] = useDebounce(searchLogs, 400);
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);

  // Fetch Config
  const fetchConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch("/api/admin/notifications/config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error("Gagal memuat status konfigurasi:", err);
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  // Fetch Logs
  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const query = new URLSearchParams();
      if (channelFilter) query.set("channel", channelFilter);
      if (statusFilter) query.set("status", statusFilter);
      if (debouncedSearchLogs) query.set("search", debouncedSearchLogs);

      const res = await fetch(`/api/admin/notifications/logs?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (err) {
      console.error("Gagal memuat log notifikasi:", err);
    } finally {
      setLoadingLogs(false);
    }
  }, [channelFilter, statusFilter, debouncedSearchLogs]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (activeTab === "logs") {
      fetchLogs();
    }
  }, [activeTab, fetchLogs]);

  // Handle Edit Staff
  const openEditStaff = (staff: StaffContactItem) => {
    setEditingStaff(staff);
    setEditPhone(staff.noWhatsapp || "");
    setEditIsActive(staff.isActive);
    setStaffError(null);
    setStaffSuccess(null);
  };

  const saveStaffContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    setSavingStaff(true);
    setStaffError(null);
    setStaffSuccess(null);

    try {
      const res = await fetch("/api/admin/notifications/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingStaff.userId,
          noWhatsapp: editPhone,
          isActive: editIsActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStaffError(data.error || "Gagal menyimpan nomor WhatsApp");
      } else {
        setStaffSuccess("Kontak WhatsApp berhasil disimpan!");
        setTimeout(() => {
          setEditingStaff(null);
          fetchConfig();
        }, 1200);
      }
    } catch {
      setStaffError("Terjadi kesalahan jaringan.");
    } finally {
      setSavingStaff(false);
    }
  };

  // Handle Test Email
  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailTarget) return;

    setTestingEmail(true);
    setTestEmailResult(null);

    try {
      const res = await fetch("/api/admin/notifications/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetEmail: testEmailTarget }),
      });

      const data = await res.json();
      if (data.success) {
        setTestEmailResult({
          success: true,
          message: data.message || "Email pengujian berhasil dikirim!",
          messageId: data.messageId,
        });
        fetchConfig();
      } else {
        setTestEmailResult({
          success: false,
          message: data.error || "Pengiriman email gagal.",
        });
      }
    } catch {
      setTestEmailResult({
        success: false,
        message: "Koneksi ke server gagal.",
      });
    } finally {
      setTestingEmail(false);
    }
  };

  // Handle Test WhatsApp
  const handleTestWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhoneTarget) return;

    setTestingPhone(true);
    setTestPhoneResult(null);

    try {
      const res = await fetch("/api/admin/notifications/test-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPhone: testPhoneTarget }),
      });

      const data = await res.json();
      if (data.success) {
        setTestPhoneResult({
          success: true,
          message: data.message || "Pesan WhatsApp pengujian berhasil dikirim!",
          messageId: data.messageId,
        });
        fetchConfig();
      } else {
        setTestPhoneResult({
          success: false,
          message: data.error || "Pengiriman WhatsApp gagal.",
        });
      }
    } catch {
      setTestPhoneResult({
        success: false,
        message: "Koneksi ke server gagal.",
      });
    } finally {
      setTestingPhone(false);
    }
  };

  // Handle Test WhatsApp Warga
  const handleTestWargaWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testWargaPhone) return;

    setTestingWargaPhone(true);
    setTestWargaResult(null);

    try {
      const res = await fetch("/api/admin/notifications/test-warga-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetPhone: testWargaPhone,
          namaWarga: testWargaNama,
          jenisLayanan: testWargaLayanan,
          skenario: testWargaSkenario,
          catatan: testWargaCatatan,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestWargaResult({
          success: true,
          message: data.message || "Pesan WhatsApp warga berhasil dikirim!",
          messageId: data.messageId,
          previewMessage: data.previewMessage,
        });
        fetchConfig();
      } else {
        setTestWargaResult({
          success: false,
          message: data.error || "Pengiriman WhatsApp warga gagal.",
          previewMessage: data.previewMessage,
        });
      }
    } catch {
      setTestWargaResult({
        success: false,
        message: "Koneksi ke server gagal.",
      });
    } finally {
      setTestingWargaPhone(false);
    }
  };

  // Handle Retry Log
  const handleRetryLog = async (logId: string) => {
    setRetryingLogId(logId);
    try {
      const res = await fetch("/api/admin/notifications/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Notifikasi berhasil dikirim ulang!");
        fetchLogs();
      } else {
        alert(`Gagal mengirim ulang: ${data.error || data.status}`);
        fetchLogs();
      }
    } catch {
      alert("Terjadi kesalahan jaringan saat mencoba mengirim ulang.");
    } finally {
      setRetryingLogId(null);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "KEPALA_DESA":
        return { text: "Kepala Desa", class: "bg-amber-100 text-amber-800 border-amber-300" };
      case "SUPERVISOR":
        return { text: "Supervisor", class: "bg-indigo-100 text-indigo-800 border-indigo-300" };
      case "STAF_DESA":
      default:
        return { text: "Staf Desa / Operator", class: "bg-teal-100 text-[#0F766E] border-teal-300" };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SENT":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Terkirim</span>;
      case "FAILED":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">Gagal</span>;
      case "SKIPPED":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">Dilewati</span>;
      case "PENDING":
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">Menunggu</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-16">
      {/* ── Top Header Banner ── */}
      <div className="bg-[#17365D] text-white border-b border-[#E2E8F0] shadow-sm">
        <div className="w-full lg:w-[95%] max-w-[1600px] 2xl:max-w-[1640px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href="/staf"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-300 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Kembali ke Dashboard
                </Link>
                <span className="text-slate-400">•</span>
                <span className="text-xs font-bold px-2.5 py-0.5 bg-teal-800/80 text-teal-200 rounded-md">
                  Notifikasi Terpadu
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Pusat Pengaturan & Pengujian Notifikasi
              </h1>
              <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                Integrasi otomatis Gmail untuk Warga dan WhatsApp Cloud API resmi Meta untuk Staf Desa serta Kepala Desa.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  fetchConfig();
                  if (activeTab === "logs") fetchLogs();
                }}
                disabled={loadingConfig || loadingLogs}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs font-bold transition-all border border-white/20 shadow-xs disabled:opacity-50"
              >
                <svg className={`w-4 h-4 ${loadingConfig ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Segarkan Status
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[95%] max-w-[1600px] 2xl:max-w-[1640px] mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* ── 2 Status Summary Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Card 1: Gmail SMTP */}
          <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-xl border border-red-100">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-[#1E293B]">Gmail SMTP (Warga)</h3>
                  <p className="text-xs text-[#64748B]">Kanal notifikasi pengajuan otomatis warga</p>
                </div>
              </div>
              <div>
                {config?.gmail.isConfigured ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Aktif / Siap
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Belum Dikonfigurasi
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-2 text-xs border-t border-[#E2E8F0] pt-4">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Akun Pengirim:</span>
                <span className="font-mono font-semibold text-[#1E293B]">
                  {config?.gmail.user || "(Belum diisi di .env: GMAIL_USER)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Protokol:</span>
                <span className="font-semibold text-[#1E293B]">Gmail SMTP (SSL 465 / TLS 587)</span>
              </div>
              {config?.gmail.error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                  <strong>Peringatan:</strong> {config.gmail.error}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("testing");
                  if (config?.gmail.user) setTestEmailTarget(config.gmail.user);
                }}
                className="w-full py-2 bg-[#17365D] hover:bg-[#122a49] text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                Uji Coba Kirim Email Warga
              </button>
            </div>
          </div>

          {/* Card 2: Meta WhatsApp Cloud API */}
          <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl border border-emerald-100">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm0 17.82c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.12 8.12 0 01-1.25-4.26c0-4.5 3.66-8.16 8.16-8.16 2.18 0 4.23.85 5.77 2.39a8.106 8.106 0 012.39 5.77c0 4.5-3.66 8.16-8.08 8.16z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-[#1E293B]">WhatsApp Cloud API (Petugas)</h3>
                  <p className="text-xs text-[#64748B]">Kanal notifikasi Staf Desa & Kepala Desa</p>
                </div>
              </div>
              <div>
                {config?.whatsapp.isConfigured ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Aktif / Siap
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Belum Dikonfigurasi
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-2 text-xs border-t border-[#E2E8F0] pt-4">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Phone Number ID:</span>
                <span className="font-mono font-semibold text-[#1E293B]">
                  {config?.whatsapp.phoneNumberId || "(Belum diisi: WHATSAPP_PHONE_NUMBER_ID)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Versi Meta API:</span>
                <span className="font-semibold text-[#1E293B]">{config?.whatsapp.apiVersion || "v21.0"}</span>
              </div>
              {config?.whatsapp.displayPhoneNumber && (
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Nomor Bisnis Terverifikasi:</span>
                  <span className="font-semibold text-emerald-700">{config.whatsapp.displayPhoneNumber}</span>
                </div>
              )}
              {config?.whatsapp.error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                  <strong>Peringatan:</strong> {config.whatsapp.error}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("testing")}
                className="w-full py-2 bg-[#0F766E] hover:bg-[#0d655e] text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                Uji Coba Kirim WhatsApp Petugas
              </button>
            </div>
          </div>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="border-b border-[#E2E8F0] mb-6 flex space-x-2 sm:space-x-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("petugas")}
            className={`pb-3 px-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === "petugas"
                ? "border-[#17365D] text-[#17365D]"
                : "border-transparent text-[#64748B] hover:text-[#1E293B]"
            }`}
          >
            Kontak WhatsApp Petugas ({config?.staffContacts.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("testing")}
            className={`pb-3 px-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === "testing"
                ? "border-[#17365D] text-[#17365D]"
                : "border-transparent text-[#64748B] hover:text-[#1E293B]"
            }`}
          >
            Uji Coba Pengiriman
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={`pb-3 px-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === "logs"
                ? "border-[#17365D] text-[#17365D]"
                : "border-transparent text-[#64748B] hover:text-[#1E293B]"
            }`}
          >
            Riwayat Notifikasi ({metrics.total})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("panduan")}
            className={`pb-3 px-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === "panduan"
                ? "border-[#17365D] text-[#17365D]"
                : "border-transparent text-[#64748B] hover:text-[#1E293B]"
            }`}
          >
            Panduan Konfigurasi (.env)
          </button>
        </div>

        {/* ── TAB 1: KONTAK WHATSAPP PETUGAS ── */}
        {activeTab === "petugas" && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-[#E2E8F0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#1E293B]">Daftar Kontak WhatsApp Staf Desa & Kepala Desa</h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Atur nomor WhatsApp resmi petugas untuk menerima peringatan pengajuan baru, validasi, dan persetujuan.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Petugas</th>
                    <th className="px-6 py-4">Role / Peran</th>
                    <th className="px-6 py-4">Nomor WhatsApp</th>
                    <th className="px-6 py-4">Status Kanal</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {config?.staffContacts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-[#64748B] text-sm">
                        Tidak ada akun staf atau kepala desa yang ditemukan.
                      </td>
                    </tr>
                  ) : (
                    config?.staffContacts.map((staff) => {
                      const roleBadge = getRoleLabel(staff.role);
                      return (
                        <tr key={staff.userId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-[#1E293B]">{staff.nama}</div>
                            <div className="text-xs text-[#64748B] font-mono">{staff.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-md text-xs font-bold border ${roleBadge.class}`}>
                              {roleBadge.text}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {staff.noWhatsapp ? (
                              <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-emerald-800">
                                <span>📱</span>
                                {staff.noWhatsapp.startsWith("62") ? `+${staff.noWhatsapp}` : staff.noWhatsapp}
                              </div>
                            ) : (
                              <span className="text-xs italic text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                                Belum diatur (Notifikasi akan dilewati)
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {staff.isActive ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Aktif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Nonaktif
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => openEditStaff(staff)}
                              className="px-3.5 py-1.5 bg-[#17365D] hover:bg-[#122a49] text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
                            >
                              Atur Nomor WA
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 2: UJI COBA PENGIRIMAN ── */}
        {activeTab === "testing" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Form Uji Gmail */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
                  ✉️
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1E293B]">Uji Coba Kirim Gmail (Warga)</h3>
                  <p className="text-xs text-[#64748B]">Kirim email pengujian dengan template HTML resmi desa</p>
                </div>
              </div>

              <form onSubmit={handleTestEmail} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#1E293B] mb-1">
                    Alamat Email Penerima:
                  </label>
                  <input
                    type="email"
                    required
                    value={testEmailTarget}
                    onChange={(e) => setTestEmailTarget(e.target.value)}
                    placeholder="contoh: warga@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#17365D] focus:bg-white transition-all font-mono"
                  />
                  <p className="text-[11px] text-[#64748B] mt-1">
                    Gunakan alamat email Anda sendiri untuk mengonfirmasi bahwa email masuk ke Inbox dengan rapi.
                  </p>
                </div>

                {testEmailResult && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                      testEmailResult.success
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-rose-50 border-rose-200 text-rose-800"
                    }`}
                  >
                    <div className="font-bold mb-1">
                      {testEmailResult.success ? "✓ Pengiriman Berhasil!" : "✗ Pengiriman Gagal!"}
                    </div>
                    <div>{testEmailResult.message}</div>
                    {testEmailResult.messageId && (
                      <div className="font-mono text-[10px] mt-1 text-slate-500">
                        Message-ID: {testEmailResult.messageId}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={testingEmail || !testEmailTarget}
                  className="w-full py-2.5 bg-[#17365D] hover:bg-[#122a49] text-white text-sm font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {testingEmail ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Sedang Mengirim Email...
                    </>
                  ) : (
                    "Kirim Email Uji Coba Sekarang"
                  )}
                </button>
              </form>
            </div>

            {/* Form Uji WhatsApp */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  💬
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1E293B]">Uji Coba Kirim WhatsApp (Petugas)</h3>
                  <p className="text-xs text-[#64748B]">Kirim pesan WhatsApp melalui Meta WhatsApp Cloud API</p>
                </div>
              </div>

              <form onSubmit={handleTestWhatsApp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#1E293B] mb-1">
                    Nomor WhatsApp Penerima (Indonesia):
                  </label>
                  <input
                    type="text"
                    required
                    value={testPhoneTarget}
                    onChange={(e) => setTestPhoneTarget(e.target.value)}
                    placeholder="contoh: +6281234567890 atau 081234567890"
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:bg-white transition-all font-mono"
                  />
                  <p className="text-[11px] text-[#64748B] mt-1">
                    Sistem otomatis memformat ke standar internasional (+62). Pastikan nomor terdaftar di WhatsApp.
                  </p>
                </div>

                {testPhoneResult && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                      testPhoneResult.success
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-rose-50 border-rose-200 text-rose-800"
                    }`}
                  >
                    <div className="font-bold mb-1">
                      {testPhoneResult.success ? "✓ Pengiriman Berhasil!" : "✗ Pengiriman Gagal!"}
                    </div>
                    <div>{testPhoneResult.message}</div>
                    {testPhoneResult.messageId && (
                      <div className="font-mono text-[10px] mt-1 text-slate-500">
                        Meta Message ID: {testPhoneResult.messageId}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={testingPhone || !testPhoneTarget}
                  className="w-full py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white text-sm font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {testingPhone ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Sedang Menghubungi WhatsApp API...
                    </>
                  ) : (
                    "Kirim Pesan WhatsApp Petugas"
                  )}
                </button>
              </form>
            </div>

            {/* ── FORM 3: UJI COBA WHATSAPP UNTUK WARGA (LENGKAP SEMUA SKENARIO) ── */}
            <div className="col-span-1 md:col-span-2 bg-white rounded-3xl border-2 border-[#0F766E]/20 shadow-md p-6 sm:p-8 bg-gradient-to-br from-white via-white to-teal-50/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-teal-100 text-[#0F766E] flex items-center justify-center font-bold text-xl shadow-xs ring-4 ring-teal-50">
                    📱
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-lg text-[#17365D]">
                        Uji Coba & Simulasi Notifikasi WhatsApp (Warga)
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-[#0F766E]">
                        Skenario Layanan
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Simulasikan pengiriman pesan WhatsApp resmi kepada warga untuk berbagai tahapan alur surat (Diajukan, Diperiksa, Perbaikan, Disetujui, Selesai, Ditolak).
                    </p>
                  </div>
                </div>

                <div className="text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                  Mode: <span className="font-bold text-[#17365D]">Simulasi Format Asli</span>
                </div>
              </div>

              <form onSubmit={handleTestWargaWhatsApp} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Pilihan Skenario Status */}
                  <div>
                    <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
                      Pilih Tahapan / Skenario Status:
                    </label>
                    <select
                      value={testWargaSkenario}
                      onChange={(e) => setTestWargaSkenario(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-xs font-bold text-[#17365D] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                    >
                      <option value="DIAJUKAN">📩 1. DIAJUKAN (Pengajuan Baru Diterima)</option>
                      <option value="DIPERIKSA">🔍 2. DIPERIKSA (Sedang Diverifikasi Staf)</option>
                      <option value="PERLU_PERBAIKAN">⚠️ 3. PERLU_PERBAIKAN (Perbaikan Berkas)</option>
                      <option value="DISETUJUI">🏛️ 4. DISETUJUI (Disetujui Kepala Desa)</option>
                      <option value="SELESAI">📜 5. SELESAI (Surat Terbit & Siap Unduh)</option>
                      <option value="DITOLAK">❌ 6. DITOLAK (Pengajuan Ditolak)</option>
                    </select>
                  </div>

                  {/* Nomor WhatsApp Warga */}
                  <div>
                    <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
                      Nomor WhatsApp Tujuan (Warga):
                    </label>
                    <input
                      type="text"
                      required
                      value={testWargaPhone}
                      onChange={(e) => setTestWargaPhone(e.target.value)}
                      placeholder="contoh: 081234567890 atau +628..."
                      className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                    />
                  </div>

                  {/* Nama Warga */}
                  <div>
                    <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
                      Nama Warga Pemohon:
                    </label>
                    <input
                      type="text"
                      value={testWargaNama}
                      onChange={(e) => setTestWargaNama(e.target.value)}
                      placeholder="Nama lengkap warga"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Jenis Layanan */}
                  <div>
                    <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
                      Jenis Layanan Surat:
                    </label>
                    <input
                      type="text"
                      value={testWargaLayanan}
                      onChange={(e) => setTestWargaLayanan(e.target.value)}
                      placeholder="contoh: Surat Keterangan Usaha (SKU)"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                    />
                  </div>

                  {/* Catatan Tambahan Petugas */}
                  <div>
                    <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
                      Catatan Petugas (Alasan / Kekurangan Dokumen):
                    </label>
                    <input
                      type="text"
                      value={testWargaCatatan}
                      onChange={(e) => setTestWargaCatatan(e.target.value)}
                      placeholder="contoh: Foto KTP terpotong, silakan unggah ulang"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                    />
                  </div>
                </div>

                {/* Hasil Respon Uji Coba */}
                {testWargaResult && (
                  <div
                    className={`p-4 rounded-2xl border text-xs leading-relaxed ${
                      testWargaResult.success
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                        : "bg-rose-50 border-rose-300 text-rose-900"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm mb-1">
                      <span>{testWargaResult.success ? "✓ Berhasil!" : "✗ Gagal!"}</span>
                      <span>{testWargaResult.message}</span>
                    </div>

                    {testWargaResult.messageId && (
                      <div className="font-mono text-[11px] text-slate-600 mt-1">
                        ID Pesan WhatsApp: <span className="font-bold">{testWargaResult.messageId}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tombol Eksekusi Kirim */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  <div className="text-[11px] text-[#64748B] flex items-center gap-1.5">
                    <span>💡</span>
                    <span>Pesan akan dikirim langsung ke WhatsApp penerima menggunakan template resmi desa.</span>
                  </div>

                  <button
                    type="submit"
                    disabled={testingWargaPhone || !testWargaPhone}
                    className="w-full sm:w-auto px-7 py-3 bg-[#17365D] hover:bg-[#122a49] text-white text-xs font-extrabold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
                  >
                    {testingWargaPhone ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Sedang Mengirim Notifikasi WhatsApp Warga...
                      </>
                    ) : (
                      <>
                        <span>📲</span>
                        <span>Kirim Uji Coba WhatsApp ke Warga Sekarang</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── TAB 3: RIWAYAT NOTIFIKASI (LOGS) ── */}
        {activeTab === "logs" && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            {/* Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-[#E2E8F0] border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <div className="p-4 text-center">
                <div className="text-xs text-[#64748B]">Total Tercatat</div>
                <div className="text-xl font-extrabold text-[#1E293B] mt-0.5">{metrics.total}</div>
              </div>
              <div className="p-4 text-center">
                <div className="text-xs text-emerald-600">Berhasil Terkirim</div>
                <div className="text-xl font-extrabold text-emerald-700 mt-0.5">{metrics.sent}</div>
              </div>
              <div className="p-4 text-center">
                <div className="text-xs text-rose-600">Gagal Dikirim</div>
                <div className="text-xl font-extrabold text-rose-700 mt-0.5">{metrics.failed}</div>
              </div>
              <div className="p-4 text-center">
                <div className="text-xs text-amber-600">Dilewati / Belum Diatur</div>
                <div className="text-xl font-extrabold text-amber-700 mt-0.5">{metrics.skipped}</div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 bg-white">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="px-3 py-1.5 border border-[#CBD5E1] rounded-xl text-xs bg-white text-[#1E293B] focus:outline-none"
                >
                  <option value="">Semua Kanal</option>
                  <option value="EMAIL">Gmail Saja</option>
                  <option value="WHATSAPP">WhatsApp Saja</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 border border-[#CBD5E1] rounded-xl text-xs bg-white text-[#1E293B] focus:outline-none"
                >
                  <option value="">Semua Status</option>
                  <option value="SENT">Terkirim</option>
                  <option value="FAILED">Gagal</option>
                  <option value="SKIPPED">Dilewati</option>
                  <option value="PENDING">Menunggu</option>
                </select>
              </div>

              <div className="w-full sm:w-64">
                <input
                  type="text"
                  value={searchLogs}
                  onChange={(e) => setSearchLogs(e.target.value)}
                  placeholder="Cari penerima, no pengajuan..."
                  className="w-full px-3 py-1.5 border border-[#CBD5E1] rounded-xl text-xs bg-[#F8FAFC] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Waktu</th>
                    <th className="px-4 py-3">Kanal</th>
                    <th className="px-4 py-3">Peristiwa</th>
                    <th className="px-4 py-3">Penerima</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Provider ID / Catatan Error</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {loadingLogs ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-[#64748B]">
                        Memuat data riwayat notifikasi...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-[#64748B]">
                        Belum ada riwayat pengiriman notifikasi yang tercatat.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono whitespace-nowrap text-slate-500">
                          {new Date(log.createdAt).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {log.channel === "EMAIL" ? (
                            <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                              ✉️ Gmail
                            </span>
                          ) : (
                            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              💬 WhatsApp
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-[#1E293B]">
                          <div>{log.event}</div>
                          {log.pengajuan && (
                            <div className="font-mono text-[10px] text-teal-700">
                              {log.pengajuan.nomorPengajuan}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono font-medium text-[#1E293B]">{log.recipient}</div>
                          {log.recipientName && (
                            <div className="text-[10px] text-[#64748B]">{log.recipientName}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getStatusBadge(log.status)}
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate">
                          {log.providerMessageId ? (
                            <span className="font-mono text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                              ID: {log.providerMessageId}
                            </span>
                          ) : log.errorMessage ? (
                            <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded text-[11px]" title={log.errorMessage}>
                              {log.errorMessage}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {log.status === "FAILED" && (
                            <button
                              type="button"
                              onClick={() => handleRetryLog(log.id)}
                              disabled={retryingLogId === log.id}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold transition-colors disabled:opacity-50"
                            >
                              {retryingLogId === log.id ? "Mengulang..." : "Kirim Ulang"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 4: PANDUAN KONFIGURASI (.ENV) ── */}
        {activeTab === "panduan" && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 sm:p-8 space-y-8">
            <div>
              <h3 className="text-xl font-bold text-[#1E293B] mb-2">Panduan Aktivasi Gmail SMTP & Meta WhatsApp Cloud API</h3>
              <p className="text-sm text-[#64748B]">
                Seluruh kredensial sensitif disimpan secara aman di file <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-xs">.env</code> pada server lokal/produksi dan tidak pernah dibagikan ke frontend.
              </p>
            </div>

            {/* Bagian 1: Gmail */}
            <div className="border border-[#E2E8F0] rounded-xl p-6 bg-[#F8FAFC]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📧</span>
                <h4 className="font-bold text-base text-[#1E293B]">1. Konfigurasi Gmail SMTP (App Password)</h4>
              </div>
              <ol className="list-decimal list-inside space-y-2 text-sm text-[#334155] leading-relaxed">
                <li>Buka akun Google Anda di <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-teal-700 underline font-semibold">Keamanan Akun Google</a>.</li>
                <li>Pastikan <strong>Verifikasi 2 Langkah (2-Step Verification)</strong> telah aktif.</li>
                <li>Cari menu <strong>Sandi Aplikasi (App Passwords)</strong> di bilah pencarian akun Google.</li>
                <li>Beri nama aplikasi, misalnya: <code className="bg-white px-2 py-0.5 rounded border border-slate-200">Pelayanan Desa</code>, lalu klik <strong>Buat</strong>.</li>
                <li>Google akan memberikan 16 karakter kata sandi aplikasi (contoh: <code className="bg-white px-2 py-0.5 rounded border border-slate-200">abcd efgh ijkl mnop</code>).</li>
                <li>Salin ke file <code className="font-mono text-xs">.env</code>:</li>
              </ol>

              <div className="mt-4 p-4 bg-[#1E293B] text-teal-300 rounded-xl font-mono text-xs overflow-x-auto">
                <pre>{`# Konfigurasi Gmail SMTP Warga
GMAIL_USER="nama_desa@gmail.com"
GMAIL_APP_PASSWORD="abcdefghijklmnop"
GMAIL_FROM_NAME="Pelayanan Desa Terpadu — Asisten Desa Perum"`}</pre>
              </div>
            </div>

            {/* Bagian 2: WhatsApp Cloud API */}
            <div className="border border-[#E2E8F0] rounded-xl p-6 bg-[#F8FAFC]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">💬</span>
                <h4 className="font-bold text-base text-[#1E293B]">2. Konfigurasi Meta WhatsApp Business Cloud API</h4>
              </div>
              <ol className="list-decimal list-inside space-y-2 text-sm text-[#334155] leading-relaxed">
                <li>Buka portal <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-teal-700 underline font-semibold">Meta for Developers</a> dan buat aplikasi bertipe <strong>Business</strong>.</li>
                <li>Tambahkan produk <strong>WhatsApp</strong> ke dalam aplikasi Meta Anda.</li>
                <li>Pada menu <strong>WhatsApp &gt; API Setup</strong>, dapatkan:
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-slate-600">
                    <li><strong>Phone Number ID</strong> (ID Nomor Telepon Resmi)</li>
                    <li><strong>WhatsApp Business Account ID</strong> (WABA ID)</li>
                    <li><strong>Temporary Access Token</strong> (untuk pengujian) atau <strong>System User Permanent Token</strong> (untuk produksi).</li>
                  </ul>
                </li>
                <li>Salin ke file <code className="font-mono text-xs">.env</code>:</li>
              </ol>

              <div className="mt-4 p-4 bg-[#1E293B] text-teal-300 rounded-xl font-mono text-xs overflow-x-auto">
                <pre>{`# Konfigurasi WhatsApp Cloud API Resmi Meta
WHATSAPP_ACCESS_TOKEN="EAAxxxxxxx..."
WHATSAPP_PHONE_NUMBER_ID="1029384756xxxxx"
WHATSAPP_BUSINESS_ACCOUNT_ID="123456789xxxxx"
WHATSAPP_API_VERSION="v21.0"`}</pre>
              </div>
            </div>

            {/* Bagian 3: Idempotensi & Keamanan */}
            <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 text-xs leading-relaxed">
              <strong>Catatan Keamanan & Idempotensi:</strong> Sistem telah dilengkapi pelindung idempotensi berbasis kunci unik (idempotency key). Setiap kali status berubah, notifikasi hanya dikirimkan 1 kali untuk status tersebut, mencegah pengiriman ganda atau spam ke warga dan petugas.
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL EDIT KONTAK WHATSAPP PETUGAS ── */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] mb-4">
              <h3 className="text-base font-bold text-[#1E293B]">Atur Nomor WhatsApp Petugas</h3>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={saveStaffContact} className="space-y-4">
              <div>
                <div className="text-xs text-[#64748B]">Nama Petugas:</div>
                <div className="font-bold text-sm text-[#1E293B]">{editingStaff.nama}</div>
                <div className="text-xs text-slate-500 font-mono">{editingStaff.email}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E293B] mb-1">
                  Nomor WhatsApp (Format Indonesia):
                </label>
                <input
                  type="text"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="contoh: +6281234567890 atau 081234567890"
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#17365D] focus:bg-white transition-all font-mono"
                />
                <p className="text-[11px] text-[#64748B] mt-1">
                  Mendukung format +62, 62, atau awalan 08.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="staffIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-[#17365D] focus:ring-[#17365D]"
                />
                <label htmlFor="staffIsActive" className="text-xs font-semibold text-[#1E293B]">
                  Aktifkan penerimaan notifikasi WhatsApp untuk petugas ini
                </label>
              </div>

              {staffError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                  {staffError}
                </div>
              )}

              {staffSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs">
                  {staffSuccess}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 border border-[#CBD5E1] text-[#64748B] hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingStaff}
                  className="px-5 py-2 bg-[#17365D] hover:bg-[#122a49] text-white rounded-xl text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
                >
                  {savingStaff ? "Menyimpan..." : "Simpan Kontak"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
