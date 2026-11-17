"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationCenterProps {
  variant?: "light" | "dark";
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Baru saja";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} mnt lalu`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} jam lalu`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} hari lalu`;

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

export default function NotificationCenter({ variant = "light" }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number>(0);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=30", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const items: NotificationItem[] = Array.isArray(data) ? data : data.notifications || [];
        const count: number = typeof data.unreadCount === "number" ? data.unreadCount : items.filter((n) => !n.readAt).length;

        // Browser notification if unread count increased
        if (count > prevCountRef.current && prevCountRef.current > 0 && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          const newest = items.find((n) => !n.readAt);
          if (newest) {
            new Notification(newest.title, {
              body: newest.message,
              icon: "/favicon.ico",
            });
          }
        }

        prevCountRef.current = count;
        setNotifications(items);
        setUnreadCount(count);
      }
    } catch (err) {
      console.warn("Gagal memuat notifikasi:", err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // refresh setiap 15 detik

    const handleFocus = () => fetchNotifications();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id?: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : {}),
      });
      fetchNotifications();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notifications?id=${id}`, { method: "DELETE" });
      fetchNotifications();
    } catch {
      // ignore
    }
  };

  const handleClearRead = async () => {
    try {
      await fetch("/api/notifications?clear=read", { method: "DELETE" });
      fetchNotifications();
    } catch {
      // ignore
    }
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    if (!notif.readAt) {
      handleMarkAsRead(notif.id);
    }
    setIsOpen(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const requestBrowserPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      await Notification.requestPermission();
    }
  };

  const filteredNotifications = activeTab === "unread" ? notifications.filter((n) => !n.readAt) : notifications;

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "SUCCESS":
        return (
          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-emerald-100 text-emerald-600 ring-2 ring-emerald-50">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case "WARNING":
        return (
          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-amber-100 text-amber-600 ring-2 ring-amber-50">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        );
      case "ERROR":
        return (
          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-rose-100 text-rose-600 ring-2 ring-rose-50">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-teal-100 text-[#0F766E] ring-2 ring-teal-50">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const buttonClass =
    variant === "dark"
      ? "relative p-2 text-slate-200 hover:text-white hover:bg-white/10 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-[#0F766E]/40"
      : "relative p-2 text-slate-600 hover:text-[#17365D] hover:bg-slate-100 rounded-xl transition-all border border-slate-200/80 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ── Tombol Lonceng Notifikasi ── */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          requestBrowserPermission();
        }}
        className={buttonClass}
        aria-label="Pusat Notifikasi"
        aria-expanded={isOpen}
        title="Notifikasi"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-extrabold text-white bg-rose-600 ring-2 ring-white rounded-full shadow-sm animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown Panel Notifikasi ── */}
      {isOpen && (
        <div className="absolute right-0 sm:right-0 mt-2.5 w-[calc(100vw-2rem)] max-w-sm sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[85vh] animate-fade-in focus:outline-none">
          {/* Header Panel */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-[#17365D]">Pusat Notifikasi</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                  {unreadCount} baru
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => handleMarkAsRead()}
                className="text-xs font-semibold text-[#0F766E] hover:text-[#115e59] transition-colors"
                title="Tandai semua sebagai sudah dibaca"
              >
                Tandai dibaca
              </button>
            )}
          </div>

          {/* Tab Filter: Semua vs Belum Dibaca */}
          <div className="flex border-b border-slate-100 bg-white px-3 pt-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`pb-2 px-3 font-semibold border-b-2 transition-all ${
                activeTab === "all"
                  ? "border-[#17365D] text-[#17365D]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Semua ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("unread")}
              className={`pb-2 px-3 font-semibold border-b-2 transition-all ${
                activeTab === "unread"
                  ? "border-[#0F766E] text-[#0F766E]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Belum Dibaca ({unreadCount})
            </button>
          </div>

          {/* List Notifikasi */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-slate-600">
                  {activeTab === "unread" ? "Semua notifikasi sudah dibaca!" : "Belum ada notifikasi"}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Pembaruan status pengajuan Anda akan muncul di sini.
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const isUnread = !notif.readAt;
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`group relative p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 ${
                      isUnread ? "bg-teal-50/40" : "bg-white"
                    }`}
                  >
                    {/* Ikon Tipe */}
                    {getIcon(notif.type)}

                    {/* Konten Notifikasi */}
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className={`text-xs text-[#1E293B] ${isUnread ? "font-bold" : "font-medium"}`}>
                          {notif.title}
                        </p>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-[#0F766E] shrink-0" title="Belum dibaca" />
                        )}
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                        {notif.link && (
                          <span className="text-[10px] font-semibold text-[#0F766E] group-hover:underline">
                            Buka tautan →
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tombol Hapus per Item */}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, notif.id)}
                      className="absolute top-3 right-3 p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                      title="Hapus notifikasi ini"
                      aria-label="Hapus notifikasi"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Panel: Link ke Pusat Notifikasi Penuh */}
          <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link
              href="/notifikasi"
              onClick={() => setIsOpen(false)}
              className="font-bold text-[#17365D] hover:text-[#0F766E] transition-colors flex items-center gap-1"
            >
              Lihat Semua Notifikasi
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            {notifications.some((n) => n.readAt) && (
              <button
                type="button"
                onClick={handleClearRead}
                className="text-[11px] font-medium text-slate-500 hover:text-rose-600 transition-colors"
                title="Hapus notifikasi yang sudah dibaca"
              >
                Bersihkan dibaca
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
