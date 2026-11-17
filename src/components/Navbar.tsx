"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import NotificationCenter from "./NotificationCenter";


interface UserSession {
  id: string;
  name: string;
  email: string;
  role: "WARGA" | "STAF_DESA" | "SUPERVISOR" | "KEPALA_DESA";
}

/**
 * Mendapatkan inisial otomatis dari nama pengguna.
 * - Dua kata atau lebih: huruf pertama masing-masing kata (misal: "Michitaka Pratama" -> "MP")
 * - Satu kata: dua karakter awal secara konsisten (misal: "Michitaka" -> "MI")
 */
export function getInitials(name?: string | null): string {
  if (!name) return "U";
  const cleaned = name.trim().replace(/\s+/g, " ");
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return "U";
}

/**
 * Label dan badge role pengguna
 */
export function getRoleBadgeInfo(role?: string) {
  switch (role) {
    case "WARGA":
      return {
        label: "Warga",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "STAF_DESA":
      return {
        label: "Staf / Operator",
        badgeClass: "bg-teal-50 text-[#0F766E] border-teal-200",
      };
    case "SUPERVISOR":
      return {
        label: "Supervisor",
        badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
      };
    case "KEPALA_DESA":
      return {
        label: "Kepala Desa",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
      };
    default:
      return {
        label: role || "Pengguna",
        badgeClass: "bg-slate-50 text-slate-700 border-slate-200",
      };
  }
}

export default function Navbar() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ambil sesi autentikasi pengguna aktual dan profil fresh dari database
  useEffect(() => {
    let isMounted = true;
    // Flag untuk menghindari hapus user saat sedang re-fetch (penyebab utama flicker)
    let isRefreshing = false;

    async function loadUserIdentity() {
      // Jika sudah ada data user & ini adalah re-fetch, jangan reset user ke null
      // Tetap tampilkan data lama sambil menunggu data baru
      if (!isRefreshing) {
        isRefreshing = true;
      }

      try {
        // Prioritas 1: Ambil data profil fresh dari database melalui /api/auth/me
        const resMe = await fetch("/api/auth/me", { cache: "no-store" });
        if (resMe.ok) {
          const dataMe = await resMe.json();
          if (isMounted && dataMe?.id) {
            setUser((prev) => {
              // Hanya update state jika data benar-benar berubah untuk menghindari re-render
              if (
                prev?.id === dataMe.id &&
                prev?.name === dataMe.name &&
                prev?.email === dataMe.email &&
                prev?.role === dataMe.role
              ) {
                return prev;
              }
              return {
                id: dataMe.id,
                name: dataMe.name,
                email: dataMe.email,
                role: dataMe.role,
              };
            });
            if (isMounted) setLoading(false);
            return;
          }
        }

        // Jika /api/auth/me mengembalikan 401 (belum login), user adalah null
        if (resMe.status === 401) {
          if (isMounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        // Prioritas 2: Fallback ke /api/auth/session
        const resSession = await fetch("/api/auth/session", { cache: "no-store" });
        if (resSession.ok) {
          const dataSession = await resSession.json();
          if (isMounted && dataSession?.user?.email) {
            setUser((prev) => {
              if (prev?.email === dataSession.user.email) return prev;
              return dataSession.user;
            });
            if (isMounted) setLoading(false);
            return;
          }
        }

        // Tidak ada sesi aktif
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
      } catch (err) {
        console.warn("Could not load user identity for navbar:", err);
        // Jangan hapus user saat terjadi error jaringan, biarkan data lama tampil
        if (isMounted) setLoading(false);
      } finally {
        isRefreshing = false;
      }
    }

    loadUserIdentity();

    // Sinkronisasi hanya saat ada event profil di-update secara eksplisit dari kode lain
    // CATATAN: Sengaja TIDAK memasang window.addEventListener("focus") karena ini
    // adalah penyebab utama flickering — setiap kali user mengklik tab browser,
    // fetch ulang memicu re-render yang menampilkan "Memuat..." sesaat.
    const handleProfileUpdate = () => {
      loadUserIdentity();
    };

    window.addEventListener("user-profile-updated", handleProfileUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener("user-profile-updated", handleProfileUpdate);
    };
  }, []);

  // Menutup dropdown saat klik di luar atau saat menekan Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDropdownOpen(false);
        setMobileMenuOpen(false);
        setIsProfileModalOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  // Tutup dropdown dan mobile menu saat pindah rute
  useEffect(() => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  // Sembunyikan Navbar segera di halaman /login tanpa menunggu loading selesai
  // Ini mencegah flash/kedip sebentar sebelum loading=false
  if (pathname === "/login") {
    return null;
  }

  // Sembunyikan Navbar selama pemeriksaan sesi awal berlangsung
  // Gunakan CSS visibility:hidden bukan null agar tidak terjadi layout shift
  if (loading) {
    return (
      <header
        className="sticky top-0 z-40 w-full bg-white/95 border-b border-[#E2E8F0] shadow-xs"
        style={{ visibility: "hidden", height: "64px" }}
        aria-hidden="true"
      />
    );
  }

  // Setelah loading selesai dan tidak ada user yang login, sembunyikan
  if (!user) {
    return null;
  }

  // Tentukan item navigasi berdasarkan role pengguna
  const getNavItems = () => {
    if (!user) return [];
    switch (user.role) {
      case "STAF_DESA":
        return [
          { href: "/staf", label: "Dashboard" },
          { href: "/staf/pengajuan", label: "Verifikasi Pengajuan" },
          { href: "/staf/layanan", label: "Master Layanan" },
          { href: "/staf/pengguna", label: "Data Pengguna" },

        ];
      case "SUPERVISOR":
        return [
          { href: "/supervisor", label: "Dashboard" },
          { href: "/supervisor/pengajuan", label: "Validasi Pengajuan" },

          { href: "/supervisor/laporan", label: "Laporan & Statistik" },
          { href: "/supervisor/database", label: "Database Desa" },
          { href: "/supervisor/audit", label: "Audit Logs" },
        ];
      case "KEPALA_DESA":
        return [
          { href: "/kades", label: "Dashboard" },
          { href: "/kades/pengajuan", label: "Approval Pengajuan" },
          { href: "/kades/laporan", label: "Laporan Eksekutif" },
          { href: "/kades/audit", label: "Audit Trail" },
        ];
      case "WARGA":
      default:
        return [
          { href: "/warga", label: "Dashboard" },
          { href: "/warga/layanan", label: "Ajukan Pelayanan" },
          { href: "/warga/pengajuan", label: "Status Pengajuan" },
          { href: "/warga/asisten-ai", label: "Asisten AI" },
        ];
    }
  };

  const navItems = getNavItems();
  const roleInfo = getRoleBadgeInfo(user?.role);
  const initials = getInitials(user?.name);
  const homeHref =
    user?.role === "STAF_DESA"
      ? "/staf"
      : user?.role === "SUPERVISOR"
      ? "/supervisor"
      : user?.role === "KEPALA_DESA"
      ? "/kades"
      : "/warga";

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] shadow-xs"
        role="banner"
      >
        <div className="w-full xl:w-[95%] max-w-[1600px] 2xl:max-w-[1640px] mx-auto px-4 sm:px-6 lg:px-8 h-16 lg:h-18 flex items-center justify-between gap-4">
          {/* ── Sisi Kiri: Identitas Aplikasi & Logo ── */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Tombol Mobile Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:text-[#17365D] hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20"
              aria-label="Toggle menu navigasi"
              aria-expanded={mobileMenuOpen}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            <Link href={homeHref} className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-xl bg-[#17365D] flex items-center justify-center text-white shadow-xs group-hover:bg-[#0F766E] transition-colors shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 lg:w-5 lg:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <div className="flex flex-col">
                <div className="text-xs sm:text-sm lg:text-base font-bold text-[#17365D] tracking-tight leading-tight line-clamp-1">
                  Pelayanan Desa
                </div>
                <div className="text-[10px] sm:text-[11px] lg:text-xs font-semibold text-[#0F766E] leading-tight">
                  Asisten Desa Perum
                </div>
              </div>
            </Link>
          </div>

          {/* ── Bagian Tengah: Navigasi Utama Sesuai Role (Desktop) ── */}
          <nav
            className="hidden md:flex items-center gap-1.5 lg:gap-2 overflow-x-auto py-1"
            aria-label="Navigasi Utama"
          >
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3.5 py-1.5 lg:px-4 lg:py-2 rounded-xl text-xs lg:text-sm transition-colors shrink-0 ${
                    isActive
                      ? "bg-[#17365D] text-white font-semibold shadow-xs"
                      : "text-slate-600 hover:text-[#17365D] hover:bg-slate-100 font-medium"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* ── Sisi Kanan: Notifikasi & Identitas Pengguna Login ── */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Lonceng Notifikasi */}
            <NotificationCenter variant="light" />

            <div className="relative shrink-0" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1.5 sm:gap-2.5 p-1 sm:px-3 sm:py-1.5 rounded-2xl hover:bg-slate-100/80 transition-all border border-transparent hover:border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20"
                aria-label="Buka menu profil akun"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
              {/* Avatar lingkaran warna Navy #17365D */}
              <div
                className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full bg-[#17365D] text-white font-bold text-xs lg:text-sm flex items-center justify-center shadow-xs ring-2 ring-[#0F766E]/20 shrink-0"
                title={user?.name || "Pengguna"}
              >
                {initials}
              </div>

              {/* Nama dan Role (Desktop) */}
              <div className="text-left hidden lg:block leading-tight">
                <div
                  className="text-xs lg:text-sm font-bold text-[#1E293B] truncate max-w-[150px] lg:max-w-[200px]"
                  title={user?.name || ""}
                >
                  {user?.name || "Memuat..."}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span
                    className={`inline-block text-[10px] lg:text-xs font-semibold px-1.5 py-0.5 rounded border ${roleInfo.badgeClass}`}
                  >
                    {roleInfo.label}
                  </span>
                </div>
              </div>

              {/* Ikon Dropdown Chevron */}
              <svg
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 transition-transform duration-200 ${
                  dropdownOpen ? "rotate-180 text-[#0F766E]" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* ── Dropdown Menu Akun ── */}
            {dropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-fade-in focus:outline-none"
                role="menu"
                aria-orientation="vertical"
              >
                {/* Header Dropdown: Ringkasan Identitas Pengguna */}
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#17365D] text-white font-bold text-sm flex items-center justify-center shadow-xs shrink-0 ring-2 ring-white">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-[#1E293B] truncate" title={user?.name}>
                        {user?.name}
                      </div>
                      <div className="text-xs text-slate-500 truncate" title={user?.email}>
                        {user?.email}
                      </div>
                      <div className="mt-1">
                        <span
                          className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border ${roleInfo.badgeClass}`}
                        >
                          {roleInfo.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items Menu */}
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                    role="menuitem"
                  >
                    <svg className="w-4 h-4 text-[#0F766E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    Profil Saya
                  </button>

                  <Link
                    href={
                      user?.role === "STAF_DESA"
                        ? "/staf/pengguna"
                        : user?.role === "SUPERVISOR"
                        ? "/supervisor/database"
                        : homeHref
                    }
                    onClick={() => setDropdownOpen(false)}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                    role="menuitem"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Akses Dashboard & Pengaturan
                  </Link>
                </div>

                {/* Garis Pemisah */}
                <div className="border-t border-slate-100 my-1" />

                {/* Tombol Logout */}
                <div className="px-2 py-1">
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2 transition-colors focus:outline-none"
                    role="menuitem"
                  >
                    <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Keluar dari Akun
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>

        {/* ── Navigasi Mobile Drawer ── */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200/80 bg-white px-4 py-3 space-y-2 shadow-xl animate-fade-in max-h-[calc(100vh-4rem)] overflow-y-auto">
            {/* Quick User Banner on Mobile */}
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 mb-1">
              <div className="w-8 h-8 rounded-full bg-[#17365D] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#1E293B] truncate">{user?.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded border ${roleInfo.badgeClass}`}>
                    {roleInfo.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      isActive
                        ? "bg-[#17365D] text-white shadow-xs"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E]" />
                    )}
                  </Link>
                );
              })}
            </div>

            <div className="border-t border-slate-100 pt-2 mt-2 space-y-1">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsProfileModalOpen(true);
                }}
                className="w-full text-left px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-[#0F766E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profil Saya
              </button>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Keluar dari Akun
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Modal Detail Profil Pengguna ── */}
      {isProfileModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-modal-title"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5 animate-scale-up">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#17365D] text-white font-bold text-base flex items-center justify-center shadow-sm">
                  {initials}
                </div>
                <div>
                  <h3 id="profile-modal-title" className="text-lg font-bold text-[#1E293B]">
                    Profil Saya
                  </h3>
                  <p className="text-xs text-slate-500">Informasi akun pengguna yang sedang aktif</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Tutup modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 text-xs">
              <div>
                <span className="text-slate-500 font-medium block">Nama Lengkap:</span>
                <span className="text-slate-800 font-bold text-sm">{user?.name}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Alamat Email:</span>
                <span className="text-slate-800 font-medium">{user?.email}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Role / Jabatan Sistem:</span>
                <span
                  className={`inline-block mt-0.5 text-[11px] font-bold px-2 py-0.5 rounded-md border ${roleInfo.badgeClass}`}
                >
                  {roleInfo.label}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">ID Pengguna:</span>
                <span className="text-slate-600 font-mono text-[11px]">{user?.id}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
