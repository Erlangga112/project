"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import Link from "next/link";
import { useDebounce } from "use-debounce";
import StatusBadge from "@/components/dashboard/StatusBadge";

interface ProfilWarga {
  id?: string;
  nik?: string;
  noKk?: string;
  namaLengkap?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  alamat?: string;
  rt?: string;
  rw?: string;
  noTelepon?: string;
  status?: "AKTIF" | "PINDAH" | "MENINGGAL";
}

interface UserItem {
  id: string;
  nama: string;
  email: string;
  role: "WARGA" | "STAF_DESA" | "SUPERVISOR" | "KEPALA_DESA";
  createdAt: string;
  profilWarga: ProfilWarga | null;
  _count: {
    pengajuanLayanan: number;
  };
}

interface PengajuanItem {
  id: string;
  nomorPengajuan: string;
  status: string;
  tanggalPengajuan: string;
  catatan?: string | null;
  jenisLayanan: { nama: string; kode?: string };
  pemohon: { nama: string; email?: string; profilWarga: { nik: string } | null };
}

interface LayananItem {
  id: string;
  kode: string;
  nama: string;
  deskripsi: string | null;
  persyaratan: string;
  estimasiWaktu: number;
  isActive: boolean;
  createdAt: string;
}

interface AuditLogItem {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  createdAt: string;
  user?: { nama: string | null; email: string | null; role: string } | null;
}

export default function SupervisorDatabasePage() {
  const [activeTab, setActiveTab] = useState<"pengguna" | "pengajuan" | "layanan" | "audit">("pengguna");

  // State: Pengguna
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [debouncedUserSearch] = useDebounce(userSearch, 400);

  // State: Pengajuan
  const [pengajuans, setPengajuans] = useState<PengajuanItem[]>([]);
  const [pengajuanLoading, setPengajuanLoading] = useState(false);
  const [pengajuanSearch, setPengajuanSearch] = useState("");
  const [pengajuanStatusFilter, setPengajuanStatusFilter] = useState("");
  const [debouncedPengajuanSearch] = useDebounce(pengajuanSearch, 400);

  // State: Layanan
  const [layanans, setLayanans] = useState<LayananItem[]>([]);
  const [layananLoading, setLayananLoading] = useState(false);
  const [layananSearch, setLayananSearch] = useState("");

  // State: Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState("");

  // Modals for User management
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    nama: "",
    email: "",
    password: "",
    role: "WARGA",
    nik: "",
    noKk: "",
    alamat: "",
    rt: "001",
    rw: "001",
    noTelepon: "",
    statusWarga: "AKTIF",
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [, startTransition] = useTransition();

  // Dropdown menu state (pengguna table)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Password visibility toggle in Edit modal
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Close menu on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuId(null);
    };
    if (openMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  // 1. Fetch Users
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedUserSearch) params.set("search", debouncedUserSearch);
      if (userRoleFilter) params.set("role", userRoleFilter);

      const res = await fetch(`/api/staf/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data || []);
      }
    } catch (err) {
      console.error("Fetch users error:", err);
    } finally {
      setUsersLoading(false);
    }
  }, [debouncedUserSearch, userRoleFilter]);

  // 2. Fetch Pengajuan
  const fetchPengajuans = useCallback(async () => {
    setPengajuanLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedPengajuanSearch) params.set("search", debouncedPengajuanSearch);
      if (pengajuanStatusFilter) {
        params.set("status", pengajuanStatusFilter);
      } else {
        params.set("status", "ALL");
      }

      const res = await fetch(`/api/supervisor/pengajuan?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPengajuans(data || []);
      }
    } catch (err) {
      console.error("Fetch pengajuan error:", err);
    } finally {
      setPengajuanLoading(false);
    }
  }, [debouncedPengajuanSearch, pengajuanStatusFilter]);

  // 3. Fetch Layanan
  const fetchLayanans = useCallback(async () => {
    setLayananLoading(true);
    try {
      const res = await fetch("/api/layanan");
      if (res.ok) {
        const data = await res.json();
        setLayanans(data || []);
      }
    } catch (err) {
      console.error("Fetch layanan error:", err);
    } finally {
      setLayananLoading(false);
    }
  }, []);

  // 4. Fetch Audit
  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const url = auditFilter ? `/api/audit-logs?entity=${auditFilter}` : "/api/audit-logs";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data || []);
      }
    } catch (err) {
      console.error("Fetch audit error:", err);
    } finally {
      setAuditLoading(false);
    }
  }, [auditFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (activeTab === "pengajuan") {
      fetchPengajuans();
    } else if (activeTab === "layanan") {
      fetchLayanans();
    } else if (activeTab === "audit") {
      fetchAuditLogs();
    }
  }, [activeTab, fetchPengajuans, fetchLayanans, fetchAuditLogs]);

  // User CRUD Handlers
  const handleOpenAdd = () => {
    setFormData({
      nama: "",
      email: "",
      password: "",
      role: "WARGA",
      nik: "",
      noKk: "",
      alamat: "Jl. Merdeka No. 1, Desa Perum",
      rt: "001",
      rw: "001",
      noTelepon: "",
      statusWarga: "AKTIF",
    });
    setFormError("");
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (user: UserItem) => {
    setSelectedUser(user);
    setFormData({
      nama: user.nama || "",
      email: user.email || "",
      password: "",
      role: user.role,
      nik: user.profilWarga?.nik || "",
      noKk: user.profilWarga?.noKk || "",
      alamat: user.profilWarga?.alamat || "",
      rt: user.profilWarga?.rt || "001",
      rw: user.profilWarga?.rw || "001",
      noTelepon: user.profilWarga?.noTelepon || "",
      statusWarga: user.profilWarga?.status || "AKTIF",
    });
    setFormError("");
    setIsEditModalOpen(true);
  };

  const handleOpenDetail = (user: UserItem) => {
    setSelectedUser(user);
    setIsDetailModalOpen(true);
  };

  const handleOpenDelete = (user: UserItem) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");

    try {
      const res = await fetch("/api/staf/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Gagal menambahkan pengguna");
      } else {
        setIsAddModalOpen(false);
        setSuccessMsg("Pengguna baru berhasil ditambahkan ke database!");
        setTimeout(() => setSuccessMsg(""), 4000);
        fetchUsers();
      }
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormLoading(true);
    setFormError("");

    try {
      const res = await fetch(`/api/staf/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Gagal memperbarui pengguna");
      } else {
        setIsEditModalOpen(false);
        setSuccessMsg("Data pengguna berhasil diperbarui di database!");
        setTimeout(() => setSuccessMsg(""), 4000);
        fetchUsers();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("user-profile-updated"));
        }
      }
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setFormLoading(true);
    try {
      const res = await fetch(`/api/staf/users/${selectedUser.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setIsDeleteModalOpen(false);
        setSuccessMsg("Pengguna berhasil dihapus dari database.");
        setTimeout(() => setSuccessMsg(""), 4000);
        fetchUsers();
      } else {
        alert(data.error || "Gagal menghapus pengguna.");
      }
    } catch {
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setFormLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "KEPALA_DESA":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300">Kepala Desa</span>;
      case "SUPERVISOR":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-300">Supervisor</span>;
      case "STAF_DESA":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-teal-100 text-teal-800 border border-teal-300">Staf Desa</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-300">Warga</span>;
    }
  };

  const getStatusWargaBadge = (status?: string) => {
    if (!status) return <span className="text-slate-400 text-xs">-</span>;
    switch (status) {
      case "AKTIF":
        return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Aktif</span>;
      case "PINDAH":
        return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-orange-50 text-orange-700 border border-orange-200">Pindah</span>;
      case "MENINGGAL":
        return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-rose-50 text-rose-700 border border-rose-200">Meninggal</span>;
      default:
        return <span className="text-slate-400 text-xs">{status}</span>;
    }
  };

  const filteredLayanans = layanans.filter(
    (l) =>
      l.nama.toLowerCase().includes(layananSearch.toLowerCase()) ||
      l.kode.toLowerCase().includes(layananSearch.toLowerCase())
  );

  return (
    <div className="p-3 sm:p-4 md:p-8 w-full lg:w-[95%] max-w-[1600px] 2xl:max-w-[1640px] mx-auto space-y-4 sm:space-y-6">
      {/* ── Header Navbar ── */}
      <header className="bg-[#17365D] text-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-[#17365D]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0F766E] text-white uppercase tracking-wider">
                Supervisor
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Pusat Database & Master Data Desa
              </h1>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm">
              Eksplorasi tabel database sistem: kependudukan & pengguna, riwayat pengajuan surat, master jenis layanan, serta log aktivitas
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {activeTab === "pengguna" && (
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-[#0F766E] hover:bg-[#0d655e] text-white text-xs font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                + Tambah Akun
              </button>
            )}
            <Link
              href="/supervisor"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/20 transition-colors"
            >
              &larr; Dashboard
            </Link>
          </div>
        </div>

        {/* Navigation Bar inside Header */}
        <nav className="flex flex-nowrap overflow-x-auto -webkit-overflow-scrolling-touch scrollbar-hide items-center gap-2 pt-4 pb-1">
          <Link
            href="/supervisor"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/supervisor/pengajuan"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Validasi Pengajuan
          </Link>
          <Link
            href="/supervisor/laporan"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Laporan & Statistik
          </Link>
          <Link
            href="/supervisor/database"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0F766E] text-white shadow-xs"
          >
            Database Desa
          </Link>
          <Link
            href="/supervisor/audit"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Audit Logs
          </Link>
          <Link
            href="/supervisor/pengaturan"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Pengaturan API
          </Link>
        </nav>
      </header>

      {/* ── Success Alert ── */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center gap-2 animate-fade-in shadow-xs">
          <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {successMsg}
        </div>
      )}

      {/* ── Database Tab Switcher ── */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-[#E2E8F0] flex flex-nowrap overflow-x-auto -webkit-overflow-scrolling-touch scrollbar-hide sm:flex-wrap gap-2">
        <button
          onClick={() => startTransition(() => setActiveTab("pengguna"))}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === "pengguna"
              ? "bg-[#17365D] text-white shadow-sm"
              : "text-[#64748B] hover:text-[#1E293B] hover:bg-[#F1F5F9]"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Tabel Pengguna & Warga ({users.length})
        </button>

        <button
          onClick={() => startTransition(() => setActiveTab("pengajuan"))}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === "pengajuan"
              ? "bg-[#17365D] text-white shadow-sm"
              : "text-[#64748B] hover:text-[#1E293B] hover:bg-[#F1F5F9]"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Tabel Seluruh Pengajuan
        </button>

        <button
          onClick={() => startTransition(() => setActiveTab("layanan"))}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === "layanan"
              ? "bg-[#17365D] text-white shadow-sm"
              : "text-[#64748B] hover:text-[#1E293B] hover:bg-[#F1F5F9]"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          Tabel Master Layanan ({layanans.length})
        </button>

        <button
          onClick={() => startTransition(() => setActiveTab("audit"))}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === "audit"
              ? "bg-[#17365D] text-white shadow-sm"
              : "text-[#64748B] hover:text-[#1E293B] hover:bg-[#F1F5F9]"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Tabel Log Sistem
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: PENGGUNA & KEPENDUDUKAN                                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "pengguna" && (
        <div className="space-y-6 animate-fade-in">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 md:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm">
              <span className="text-xs font-medium text-[#64748B]">Total Akun</span>
              <p className="text-2xl font-bold text-[#1E293B] mt-1">{users.length}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm">
              <span className="text-xs font-medium text-blue-600">Warga Terdaftar</span>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {users.filter((u) => u.role === "WARGA").length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm">
              <span className="text-xs font-medium text-teal-600">Staf Desa</span>
              <p className="text-2xl font-bold text-teal-600 mt-1">
                {users.filter((u) => u.role === "STAF_DESA").length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm">
              <span className="text-xs font-medium text-purple-600">Supervisor</span>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {users.filter((u) => u.role === "SUPERVISOR").length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm">
              <span className="text-xs font-medium text-amber-600">Kepala Desa</span>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {users.filter((u) => u.role === "KEPALA_DESA").length}
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#E2E8F0] flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Cari berdasarkan Nama, NIK, No. KK, atau Email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-sm text-[#1E293B]"
              />
            </div>
            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className="px-4 py-2.5 border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-sm text-[#1E293B] bg-white min-w-[160px]"
            >
              <option value="">Semua Role</option>
              <option value="WARGA">Warga</option>
              <option value="STAF_DESA">Staf Desa</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="KEPALA_DESA">Kepala Desa</option>
            </select>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
            <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-[#1E293B]">Tabel Entitas User & Profil Warga</h3>
                <p className="text-xs text-[#64748B]">Menampilkan data kependudukan terintegrasi database sistem</p>
              </div>
              <span className="text-xs text-[#64748B] font-mono">{users.length} Data ditemukan</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0]">
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Nama & Akun</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">NIK / No. KK</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Role</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Domisili (RT/RW)</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Status Warga</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider text-center">Pengajuan</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {usersLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#64748B]">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-[#0F766E] border-t-transparent rounded-full animate-spin"></div>
                          <span>Memuat tabel pengguna dari database...</span>
                        </div>
                      </td>
                    </tr>
                  ) : users.length > 0 ? (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="p-4">
                          <div className="font-semibold text-sm text-[#1E293B]">{user.nama}</div>
                          <div className="text-xs text-[#64748B]">{user.email}</div>
                        </td>
                        <td className="p-4">
                          {user.role === "WARGA" ? (
                            user.profilWarga?.nik ? (
                              <>
                                <div className="font-mono text-xs font-semibold text-[#17365D]">
                                  {user.profilWarga.nik}
                                </div>
                                <div className="text-xs text-[#64748B] font-mono">
                                  KK: {user.profilWarga.noKk || <span className="italic text-amber-500">belum diisi</span>}
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="text-xs text-amber-600 font-medium">NIK belum diisi</span>
                                <div className="text-[11px] text-slate-400">Profil warga belum lengkap</div>
                              </>
                            )
                          ) : (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                              user.role === "KEPALA_DESA"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : user.role === "SUPERVISOR"
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : "bg-teal-50 text-teal-700 border border-teal-200"
                            }`}>
                              {user.role === "KEPALA_DESA"
                                ? "Kepala Desa"
                                : user.role === "SUPERVISOR"
                                ? "Supervisor"
                                : "Staf Desa"}
                            </span>
                          )}
                        </td>
                        <td className="p-4">{getRoleBadge(user.role)}</td>
                        {/* Domisili — only for WARGA */}
                        <td className="p-4 text-xs text-[#475569]">
                          {user.role === "WARGA" ? (
                            user.profilWarga?.alamat ? (
                              <>
                                <div>RT {user.profilWarga.rt || "001"} / RW {user.profilWarga.rw || "001"}</div>
                                <div className="text-[11px] text-slate-400 truncate max-w-[150px]">{user.profilWarga.alamat}</div>
                              </>
                            ) : (
                              <span className="text-amber-500 text-[11px]">Alamat belum diisi</span>
                            )
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        {/* Status Warga — only meaningful for WARGA role */}
                        <td className="p-4">
                          {user.role === "WARGA"
                            ? getStatusWargaBadge(user.profilWarga?.status)
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="p-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-100 text-slate-700 font-semibold">
                            {user._count?.pengajuanLayanan || 0}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="relative inline-block" ref={openMenuId === user.id ? menuRef : null}>
                            {/* Three-dot trigger */}
                            <button
                              id={`db-menu-btn-${user.id}`}
                              aria-haspopup="true"
                              aria-expanded={openMenuId === user.id}
                              aria-label="Menu aksi pengguna"
                              onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/30 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                <circle cx="10" cy="4" r="1.5" />
                                <circle cx="10" cy="10" r="1.5" />
                                <circle cx="10" cy="16" r="1.5" />
                              </svg>
                            </button>

                            {/* Dropdown panel */}
                            {openMenuId === user.id && (
                              <div
                                role="menu"
                                aria-orientation="vertical"
                                aria-labelledby={`db-menu-btn-${user.id}`}
                                className="absolute right-0 z-50 mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg py-1 origin-top-right"
                                style={{ top: "100%" }}
                              >
                                {/* Detail */}
                                <button
                                  role="menuitem"
                                  onClick={() => { setOpenMenuId(null); handleOpenDetail(user); }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-[#17365D] hover:bg-slate-50 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  Detail
                                </button>
                                {/* Edit */}
                                <button
                                  role="menuitem"
                                  onClick={() => { setOpenMenuId(null); handleOpenEdit(user); }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-teal-700 hover:bg-teal-50 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit
                                </button>
                                {/* Divider */}
                                <div className="my-1 border-t border-slate-100" />
                                {/* Hapus */}
                                <button
                                  role="menuitem"
                                  onClick={() => { setOpenMenuId(null); handleOpenDelete(user); }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Hapus
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#64748B]">
                        Tidak ada data pengguna yang sesuai dengan filter pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: SELURUH PENGAJUAN LAYANAN                                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "pengajuan" && (
        <div className="space-y-6 animate-fade-in">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#E2E8F0] flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Cari Nomor Pengajuan / Nama Pemohon / NIK..."
                value={pengajuanSearch}
                onChange={(e) => setPengajuanSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-sm text-[#1E293B]"
              />
            </div>
            <select
              value={pengajuanStatusFilter}
              onChange={(e) => setPengajuanStatusFilter(e.target.value)}
              className="px-4 py-2.5 border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-sm text-[#1E293B] bg-white min-w-[180px]"
            >
              <option value="">Semua Status Pengajuan</option>
              <option value="DIAJUKAN">DIAJUKAN</option>
              <option value="DIPERIKSA">DIPERIKSA</option>
              <option value="MENUNGGU_VALIDASI">MENUNGGU_VALIDASI</option>
              <option value="DISETUJUI_SUPERVISOR">DISETUJUI_SUPERVISOR</option>
              <option value="MENUNGGU_APPROVAL_KEPALA_DESA">MENUNGGU_KEPALA_DESA</option>
              <option value="DISETUJUI">DISETUJUI</option>
              <option value="PERLU_PERBAIKAN">PERLU_PERBAIKAN</option>
              <option value="DITOLAK">DITOLAK</option>
              <option value="SELESAI">SELESAI</option>
            </select>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
            <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-[#1E293B]">Tabel Database Pengajuan Layanan Surat</h3>
                <p className="text-xs text-[#64748B]">Seluruh berkas yang terdaftar di database sistem desa</p>
              </div>
              <span className="text-xs text-[#64748B] font-mono">{pengajuans.length} Berkas</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0]">
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Nomor Pengajuan</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Pemohon</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Layanan</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Tgl. Pengajuan</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider text-center">Status</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {pengajuanLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-[#64748B]">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-[#0F766E] border-t-transparent rounded-full animate-spin"></div>
                          <span>Memuat tabel pengajuan...</span>
                        </div>
                      </td>
                    </tr>
                  ) : pengajuans.length > 0 ? (
                    pengajuans.map((item) => (
                      <tr key={item.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="p-4 font-mono text-xs font-semibold text-[#17365D]">
                          {item.nomorPengajuan}
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-sm text-[#1E293B]">{item.pemohon?.nama}</div>
                          <div className="text-xs text-[#64748B] font-mono">
                            NIK: {item.pemohon?.profilWarga?.nik || "-"}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-[#1E293B]">
                          {item.jenisLayanan?.nama}
                        </td>
                        <td className="p-4 text-xs text-[#64748B] font-mono">
                          {new Date(item.tanggalPengajuan).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="p-4 text-center">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="p-4 text-right">
                          <Link
                            href={`/supervisor/pengajuan/${item.id}`}
                            className="px-3 py-1.5 bg-[#0F766E] hover:bg-[#0d655e] text-white rounded-lg text-xs font-semibold inline-block shadow-xs transition-colors"
                          >
                            Tinjau &rarr;
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-[#64748B]">
                        Tidak ada pengajuan ditemukan dalam database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: MASTER LAYANAN DESA                                        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "layanan" && (
        <div className="space-y-6 animate-fade-in">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#E2E8F0] flex gap-3">
            <div className="relative flex-1">
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Cari Master Layanan berdasarkan Kode atau Nama..."
                value={layananSearch}
                onChange={(e) => setLayananSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-[#CBD5E1] rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 outline-none text-sm text-[#1E293B]"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
            <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-[#1E293B]">Tabel Master Jenis Layanan Surat</h3>
                <p className="text-xs text-[#64748B]">Katalog layanan surat dan standar waktu penyelesaian</p>
              </div>
              <span className="text-xs text-[#64748B] font-mono">{filteredLayanans.length} Jenis Layanan</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0]">
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Kode</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Nama Layanan</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Deskripsi</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Estimasi</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {layananLoading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[#64748B]">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-[#0F766E] border-t-transparent rounded-full animate-spin"></div>
                          <span>Memuat master layanan...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredLayanans.length > 0 ? (
                    filteredLayanans.map((lay) => (
                      <tr key={lay.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="p-4 font-mono text-xs font-bold text-[#17365D]">
                          {lay.kode}
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-sm text-[#1E293B]">{lay.nama}</div>
                        </td>
                        <td className="p-4 text-xs text-[#64748B] max-w-xs truncate">
                          {lay.deskripsi || "-"}
                        </td>
                        <td className="p-4 text-xs font-mono text-[#1E293B]">
                          {lay.estimasiWaktu} Hari Kerja
                        </td>
                        <td className="p-4 text-center">
                          {lay.isActive ? (
                            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Aktif
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                              Nonaktif
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[#64748B]">
                        Tidak ada layanan ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: AUDIT LOGS SISTEM                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "audit" && (
        <div className="space-y-6 animate-fade-in">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#E2E8F0] flex gap-3 items-center">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Filter Modul:</label>
            <select
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
              className="px-3.5 py-2 text-xs font-medium bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 text-[#1E293B]"
            >
              <option value="">Semua Aktivitas</option>
              <option value="AUTH">Otentikasi / Login</option>
              <option value="USER">Manajemen Pengguna</option>
              <option value="JENIS_LAYANAN">Master Jenis Layanan</option>
            </select>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
            <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-[#1E293B]">Tabel Log Aktivitas & Perubahan Database</h3>
                <p className="text-xs text-[#64748B]">Riwayat audit trail operasional aplikasi</p>
              </div>
              <span className="text-xs text-[#64748B] font-mono">{auditLogs.length} Log</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0]">
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Waktu</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Pengguna</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Aksi</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Entitas</th>
                    <th className="p-4 font-semibold text-xs text-[#64748B] uppercase tracking-wider">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {auditLoading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[#64748B]">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-[#0F766E] border-t-transparent rounded-full animate-spin"></div>
                          <span>Memuat log aktivitas...</span>
                        </div>
                      </td>
                    </tr>
                  ) : auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="p-4 text-xs font-mono text-[#64748B] whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("id-ID")}
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-xs text-[#1E293B]">{log.user?.nama || "Sistem"}</div>
                          <div className="text-[11px] text-[#64748B]">{log.user?.email || "-"}</div>
                        </td>
                        <td className="p-4 font-mono text-xs font-semibold text-[#0F766E]">
                          {log.action}
                        </td>
                        <td className="p-4 text-xs text-[#64748B] font-mono">
                          {log.entity}
                        </td>
                        <td className="p-4 text-xs text-[#1E293B] max-w-sm">
                          {log.details || "-"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[#64748B]">
                        Tidak ada log aktivitas ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Detail Pengguna ── */}
      {isDetailModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="p-5 bg-[#17365D] text-white flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-teal-300">Detail Entitas User</span>
                <h3 className="text-base font-bold text-white">{selectedUser.nama}</h3>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-white/70 hover:text-white p-1"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 font-medium">Email</label>
                  <p className="font-semibold text-slate-800">{selectedUser.email}</p>
                </div>
                <div>
                  <label className="text-slate-400 font-medium">Role Sistem</label>
                  <div className="mt-0.5">{getRoleBadge(selectedUser.role)}</div>
                </div>
                <div>
                  <label className="text-slate-400 font-medium">Nomor Induk Kependudukan (NIK)</label>
                  <p className="font-mono font-semibold text-slate-800">{selectedUser.profilWarga?.nik || "-"}</p>
                </div>
                <div>
                  <label className="text-slate-400 font-medium">Nomor Kartu Keluarga (KK)</label>
                  <p className="font-mono font-semibold text-slate-800">{selectedUser.profilWarga?.noKk || "-"}</p>
                </div>
                <div>
                  <label className="text-slate-400 font-medium">No. Telepon / WhatsApp</label>
                  <p className="font-semibold text-slate-800">{selectedUser.profilWarga?.noTelepon || "-"}</p>
                </div>
                <div>
                  <label className="text-slate-400 font-medium">Status Kependudukan</label>
                  <div className="mt-0.5">{getStatusWargaBadge(selectedUser.profilWarga?.status)}</div>
                </div>
              </div>
              <div className="text-xs">
                <label className="text-slate-400 font-medium">Alamat Domisili</label>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {selectedUser.profilWarga?.alamat
                    ? `${selectedUser.profilWarga.alamat}, RT ${selectedUser.profilWarga.rt || "001"} / RW ${selectedUser.profilWarga.rw || "001"}`
                    : "-"}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Tambah Pengguna ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="p-5 bg-[#17365D] text-white flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-teal-300">Input Data Baru</span>
                <h3 className="text-base font-bold text-white">Tambah Pengguna / Warga</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white/70 hover:text-white p-1">
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitAdd} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    placeholder="Contoh: Budi Santoso"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    placeholder="nama@email.com"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    placeholder="Min 6 karakter"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Role Akun *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                  >
                    <option value="WARGA">WARGA</option>
                    <option value="STAF_DESA">STAF_DESA</option>
                    <option value="SUPERVISOR">SUPERVISOR</option>
                    <option value="KEPALA_DESA">KEPALA_DESA</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">NIK (16 Digit)</label>
                  <input
                    type="text"
                    maxLength={16}
                    value={formData.nik}
                    onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                    placeholder="3201..."
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">No. KK (16 Digit)</label>
                  <input
                    type="text"
                    maxLength={16}
                    value={formData.noKk}
                    onChange={(e) => setFormData({ ...formData, noKk: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                    placeholder="3201..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-[#0F766E] text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {formLoading ? "Menyimpan..." : "Simpan Data"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Edit Pengguna ── */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="p-5 bg-[#17365D] text-white flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-teal-300">Perbarui Data</span>
                <h3 className="text-base font-bold text-white">Edit Pengguna: {selectedUser.nama}</h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-white/70 hover:text-white p-1">
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitEdit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Role Akun</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                  >
                    <option value="WARGA">WARGA</option>
                    <option value="STAF_DESA">STAF_DESA</option>
                    <option value="SUPERVISOR">SUPERVISOR</option>
                    <option value="KEPALA_DESA">KEPALA_DESA</option>
                  </select>
                </div>
                {/* Password with eye-icon toggle */}
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Ganti Kata Sandi <span className="text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showEditPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 pr-9 border border-slate-200 rounded-lg text-xs"
                      placeholder="Kosongkan bila tidak diubah"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      aria-label={showEditPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                      aria-pressed={showEditPassword}
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showEditPassword ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Kependudukan — only for WARGA */}
              {formData.role === "WARGA" ? (
                <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Profil Kependudukan</p>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Status Warga</label>
                    <select
                      value={formData.statusWarga}
                      onChange={(e) => setFormData({ ...formData, statusWarga: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      <option value="AKTIF">AKTIF</option>
                      <option value="PINDAH">PINDAH</option>
                      <option value="MENINGGAL">MENINGGAL</option>
                    </select>
                  </div>
                  <div />
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">NIK</label>
                    <input
                      type="text"
                      maxLength={16}
                      value={formData.nik}
                      onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                      placeholder="16 digit NIK"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">No. KK</label>
                    <input
                      type="text"
                      maxLength={16}
                      value={formData.noKk}
                      onChange={(e) => setFormData({ ...formData, noKk: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                      placeholder="16 digit No KK"
                    />
                  </div>
                </div>
              ) : (
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                    <svg className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-semibold text-slate-700">Profil Kependudukan tidak berlaku</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Akun <span className="font-semibold">{formData.role.replace("_", " ")}</span> tidak menggunakan NIK/KK.
                        Hanya Nama, Email, Role, dan Kata Sandi yang dapat diperbarui.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-[#0F766E] text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {formLoading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Delete Confirmation ── */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden animate-scale-up p-5">
            <h3 className="text-base font-bold text-rose-700 mb-2">Hapus Pengguna?</h3>
            <p className="text-xs text-slate-600 mb-4">
              Apakah Anda yakin ingin menghapus akun <b>{selectedUser.nama}</b> ({selectedUser.email}) dari database? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={formLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold"
              >
                {formLoading ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
