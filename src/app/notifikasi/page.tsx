"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export default function NotifikasiPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "UNREAD" | "READ" | "WARNING">("ALL");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testTargetPhone, setTestTargetPhone] = useState("");
  const [testingWA, setTestingWA] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const router = useRouter();

  const handleSelfTestWA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingWA(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/warga/notifications/test-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPhone: testTargetPhone }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, message: data.message });
      } else {
        setTestResult({ success: false, message: data.error || "Uji coba WhatsApp gagal." });
      }
    } catch {
      setTestResult({ success: false, message: "Koneksi ke server gagal." });
    } finally {
      setTestingWA(false);
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications?limit=100", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.notifications || [];
        setNotifications(items);
      }
    } catch (err) {
      console.error("Gagal mengambil daftar notifikasi:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id?: string) => {
    try {
      if (id) setProcessingId(id);
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : {}),
      });
      await fetchNotifications();
    } catch (err) {
      console.error("Error marking as read:", err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setProcessingId(id);
      await fetch(`/api/notifications?id=${id}`, { method: "DELETE" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error("Error deleting notification:", err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleClearRead = async () => {
    if (!confirm("Hapus semua notifikasi yang sudah dibaca?")) return;
    try {
      await fetch("/api/notifications?clear=read", { method: "DELETE" });
      await fetchNotifications();
    } catch (err) {
      console.error("Error clearing read notifications:", err);
    }
  };

  const handleItemClick = (notif: NotificationItem) => {
    if (!notif.readAt) {
      handleMarkAsRead(notif.id);
    }
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const successCount = notifications.filter((n) => n.type === "SUCCESS").length;
  const warningCount = notifications.filter((n) => n.type === "WARNING" || n.type === "ERROR").length;

  const filtered = notifications.filter((item) => {
    // Filter Type
    if (filterType === "UNREAD" && item.readAt) return false;
    if (filterType === "READ" && !item.readAt) return false;
    if (filterType === "WARNING" && item.type !== "WARNING" && item.type !== "ERROR") return false;

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchMessage = item.message.toLowerCase().includes(q);
      return matchTitle || matchMessage;
    }

    return true;
  });

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "SUCCESS":
        return (
          <div className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center bg-emerald-50 text-emerald-600 border border-emerald-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case "WARNING":
        return (
          <div className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center bg-amber-50 text-amber-600 border border-amber-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        );
      case "ERROR":
        return (
          <div className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center bg-rose-50 text-rose-600 border border-rose-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center bg-teal-50 text-[#0F766E] border border-teal-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="page-container py-4 sm:py-8 w-full lg:w-[95%] max-w-[1600px] 2xl:max-w-[1640px] mx-auto px-3 sm:px-6">
      {/* ── Header Halaman ── */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/"
              className="text-xs font-semibold text-[#0F766E] hover:underline flex items-center gap-1"
            >
              ← Kembali ke Dashboard
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17365D] tracking-tight">
            Pusat Notifikasi Web
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pantau seluruh pemberitahuan pelayanan, persetujuan surat, dan perubahan status secara real-time.
          </p>
        </div>

        {/* Tombol Aksi Cepat */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setIsTestModalOpen(true);
              setTestResult(null);
            }}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
          >
            <span>📱</span>
            Uji Coba WhatsApp
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => handleMarkAsRead()}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-[#0F766E] border border-[#0F766E]/30 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Tandai Semua Dibaca
            </button>
          )}

          {notifications.some((n) => n.readAt) && (
            <button
              type="button"
              onClick={handleClearRead}
              className="px-3.5 py-2 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Bersihkan yang Dibaca
            </button>
          )}
        </div>
      </div>

      {/* ── Kartu Ringkasan Statistik ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total</div>
          <div className="text-2xl font-black text-[#17365D] mt-1">{notifications.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Semua pesan masuk</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs bg-rose-50/20">
          <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Belum Dibaca</div>
          <div className="text-2xl font-black text-rose-600 mt-1">{unreadCount}</div>
          <div className="text-[11px] text-rose-400 mt-0.5">Memerlukan perhatian</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs bg-emerald-50/20">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Disetujui / Sukses</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{successCount}</div>
          <div className="text-[11px] text-emerald-500 mt-0.5">Surat terbit & disetujui</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs bg-amber-50/20">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Perlu Tindakan</div>
          <div className="text-2xl font-black text-amber-700 mt-1">{warningCount}</div>
          <div className="text-[11px] text-amber-500 mt-0.5">Perbaikan atau validasi</div>
        </div>
      </div>

      {/* ── Toolbar: Filter & Pencarian ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Tab Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setFilterType("ALL")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filterType === "ALL"
                ? "bg-[#17365D] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Semua ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("UNREAD")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filterType === "UNREAD"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Belum Dibaca ({unreadCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("WARNING")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filterType === "WARNING"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Perlu Tindakan ({warningCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("READ")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filterType === "READ"
                ? "bg-slate-700 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Sudah Dibaca
          </button>
        </div>

        {/* Input Pencarian */}
        <div className="relative min-w-[260px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kata kunci notifikasi..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
          />
          <svg
            className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* ── List Notifikasi ── */}
      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center">
          <div className="inline-block animate-spin w-8 h-8 border-4 border-[#0F766E] border-t-transparent rounded-full mb-3" />
          <p className="text-xs font-semibold text-slate-500">Memuat notifikasi web...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-700">Tidak ada notifikasi yang sesuai</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `Tidak ditemukan notifikasi dengan kata kunci "${searchQuery}".`
              : "Belum ada notifikasi pada kategori yang Anda pilih."}
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-3 px-3 py-1.5 text-xs font-bold text-[#0F766E] hover:underline"
            >
              Reset Pencarian
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isUnread = !item.readAt;
            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative group flex items-start gap-4 ${
                  isUnread
                    ? "bg-teal-50/30 border-teal-200/80 shadow-xs hover:border-[#0F766E]"
                    : "bg-white border-slate-200/80 hover:border-slate-300"
                }`}
              >
                {/* Ikon Kategori */}
                {getIcon(item.type)}

                {/* Isi Notifikasi */}
                <div className="flex-1 min-w-0 pr-8">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className={`text-sm text-[#1E293B] ${isUnread ? "font-bold" : "font-semibold"}`}>
                      {item.title}
                    </h3>

                    {isUnread && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0F766E] text-white">
                        Baru
                      </span>
                    )}

                    <span className="text-[11px] text-slate-400 font-mono ml-auto">
                      {new Date(item.createdAt).toLocaleDateString("id-ID", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {item.message}
                  </p>

                  {item.link && (
                    <div className="mt-2.5">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0F766E] hover:underline">
                        Buka detail pengajuan / halaman terkait →
                      </span>
                    </div>
                  )}
                </div>

                {/* Tombol Aksi Item */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {isUnread && (
                    <button
                      type="button"
                      disabled={processingId === item.id}
                      onClick={() => handleMarkAsRead(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F766E] hover:bg-teal-50 transition-colors"
                      title="Tandai sudah dibaca"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={processingId === item.id}
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Hapus notifikasi"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL UJI COBA WHATSAPP ── */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-scale-up">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                  📱
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#17365D]">
                    Uji Coba Notifikasi WhatsApp
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pastikan nomor WhatsApp Anda aktif menerima pesan pelayanan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSelfTestWA} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-[#1E293B] mb-1">
                  Nomor WhatsApp Penerima:
                </label>
                <input
                  type="text"
                  value={testTargetPhone}
                  onChange={(e) => setTestTargetPhone(e.target.value)}
                  placeholder="Kosongkan jika ingin memakai nomor dari profil"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:bg-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Format: 081234567890 atau +6281234567890.
                </p>
              </div>

              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                    testResult.success
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-rose-50 border-rose-200 text-rose-900"
                  }`}
                >
                  <div className="font-bold mb-0.5">
                    {testResult.success ? "✓ Berhasil!" : "✗ Gagal!"}
                  </div>
                  <div>{testResult.message}</div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={testingWA}
                  className="px-5 py-2 bg-[#0F766E] hover:bg-[#0d655e] text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {testingWA ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Mengirim...
                    </>
                  ) : (
                    "Kirim Pesan Tes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
