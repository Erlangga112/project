"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useDebounce } from "use-debounce";

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
  petugasContact?: { noWhatsapp?: string } | null;
  _count: {
    pengajuanLayanan: number;
  };
}

// Validasi format nomor telepon Indonesia
function validateIndonesianPhone(value: string): string | null {
  if (!value || value.trim() === "") return null; // opsional
  const clean = value.replace(/[\s\-().]/g, "");
  // Accepts: 08xxx, +628xxx, 628xxx
  if (!/^(\+62|62|0)8[1-9][0-9]{6,10}$/.test(clean)) {
    return "Format nomor tidak valid. Gunakan format Indonesia: 081234567890 atau +6281234567890";
  }
  return null;
}

export default function ManajemenPenggunaPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [debouncedSearch] = useDebounce(search, 400);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, roleFilter]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  // Dropdown menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click or Escape key
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
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (roleFilter) params.set("role", roleFilter);

      const res = await fetch(`/api/staf/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data || []);
      }
    } catch (err) {
      console.error("Fetch users error:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Statistics counts
  const totalCount = users.length;
  const wargaCount = users.filter((u) => u.role === "WARGA").length;
  const stafCount = users.filter((u) => u.role === "STAF_DESA").length;
  const supervisorCount = users.filter((u) => u.role === "SUPERVISOR").length;
  const kadesCount = users.filter((u) => u.role === "KEPALA_DESA").length;

  // Pagination calculation (5 item per page)
  const totalItems = users.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const currentUsers = users.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    if (activePage <= 3) {
      pages.push(1, 2, 3, 4, "...", totalPages);
    } else if (activePage >= totalPages - 2) {
      pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", activePage - 1, activePage, activePage + 1, "...", totalPages);
    }
    return pages;
  };

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
    setPhoneError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (user: UserItem) => {
    setSelectedUser(user);
    setFormData({
      nama: user.nama || "",
      email: user.email || "",
      password: "", // empty means keep existing
      role: user.role,
      nik: user.profilWarga?.nik || "",
      noKk: user.profilWarga?.noKk || "",
      alamat: user.profilWarga?.alamat || "",
      rt: user.profilWarga?.rt || "001",
      rw: user.profilWarga?.rw || "001",
      noTelepon: user.profilWarga?.noTelepon || user.petugasContact?.noWhatsapp || "",
      statusWarga: user.profilWarga?.status || "AKTIF",
    });
    setFormError("");
    setPhoneError(null);
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
    // Validasi nomor WA sebelum submit
    const phoneErr = validateIndonesianPhone(formData.noTelepon);
    setPhoneError(phoneErr);
    if (phoneErr) return;

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
        setSuccessMsg("Pengguna baru berhasil ditambahkan!");
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

    // Validasi nomor WA sebelum submit
    const phoneErr = validateIndonesianPhone(formData.noTelepon);
    setPhoneError(phoneErr);
    if (phoneErr) return;

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
        setSuccessMsg("Data pengguna berhasil diperbarui!");
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
        setSuccessMsg("Pengguna berhasil dihapus.");
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
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-teal-100 text-teal-800 border border-teal-300">Staf / Operator</span>;
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full lg:w-[95%] max-w-[1600px] 2xl:max-w-[1640px] mx-auto space-y-6">
      {/* ── Header Navbar ── */}
      <header className="bg-[#17365D] text-white p-6 rounded-2xl shadow-sm border border-[#17365D]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0F766E] text-white uppercase tracking-wider">
                Manajemen Pengguna
              </span>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Data Pengguna & Warga Desa
              </h1>
            </div>
            <p className="text-slate-300 text-sm">
              Kelola daftar akun pengguna, hak akses role, dan profil kependudukan warga desa
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAdd}
              className="px-5 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white text-xs font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Pengguna
            </button>
          </div>
        </div>

        {/* Navigation Bar inside Header */}
        <nav className="flex flex-nowrap overflow-x-auto -webkit-overflow-scrolling-touch scrollbar-hide items-center gap-2 pt-4 pb-1">
          <Link
            href="/staf"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/staf/pengajuan"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Verifikasi Pengajuan
          </Link>
          <Link
            href="/staf/layanan"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            Master Layanan
          </Link>
          <Link
            href="/staf/pengguna"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0F766E] text-white shadow-xs"
          >
            Data Pengguna
          </Link>
        </nav>
      </header>

      {/* ── Success Alert ── */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center gap-2 animate-fade-in">
          <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {successMsg}
        </div>
      )}

      {/* ── Stat Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Total Akun</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-blue-600 font-medium">Masyarakat (Warga)</span>
          <p className="text-2xl font-bold text-blue-700 mt-1">{wargaCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-teal-600 font-medium">Staf / Operator</span>
          <p className="text-2xl font-bold text-teal-700 mt-1">{stafCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-purple-600 font-medium">Supervisor</span>
          <p className="text-2xl font-bold text-purple-700 mt-1">{supervisorCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-amber-600 font-medium">Kepala Desa</span>
          <p className="text-2xl font-bold text-amber-700 mt-1">{kadesCount}</p>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <svg className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama, email, NIK..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full md:w-auto px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
          >
            <option value="">Semua Role</option>
            <option value="WARGA">Warga (Masyarakat)</option>
            <option value="STAF_DESA">Staf Desa (Operator)</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="KEPALA_DESA">Kepala Desa</option>
          </select>

          {(search || roleFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setRoleFilter("");
              }}
              className="px-3 py-2 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Table Container ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Pengguna</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">NIK & Kependudukan</th>
                <th className="py-3 px-4">Alamat & RT/RW</th>
                <th className="py-3 px-4">No. WhatsApp</th>
                <th className="py-3 px-4">Status Warga</th>
                <th className="py-3 px-4 text-center">Pengajuan</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="inline-block animate-spin w-6 h-6 border-2 border-[#0F766E] border-t-transparent rounded-full mb-2" />
                    <p>Memuat data pengguna...</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Tidak ada data pengguna yang sesuai kriteria pencarian.
                  </td>
                </tr>
              ) : (
                currentUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* User name & email */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#17365D] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          {user.nama ? user.nama.slice(0, 2).toUpperCase() : "U"}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{user.nama || "-"}</p>
                          <p className="text-xs text-slate-500">{user.email || "-"}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3 px-4">{getRoleBadge(user.role)}</td>

                    {/* NIK / Kependudukan — role-aware */}
                    <td className="py-3 px-4">
                      {user.role === "WARGA" ? (
                        user.profilWarga?.nik ? (
                          <div>
                            <span className="font-mono text-xs font-semibold text-slate-800">
                              {user.profilWarga.nik}
                            </span>
                            <p className="text-[11px] text-slate-400">
                              KK: {user.profilWarga.noKk || <span className="italic">belum diisi</span>}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <span className="text-xs text-amber-600 font-medium">NIK belum diisi</span>
                            <p className="text-[11px] text-slate-400">Profil warga belum lengkap</p>
                          </div>
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

                    {/* Alamat & RT/RW — only meaningful for WARGA */}
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                      {user.role === "WARGA" ? (
                        user.profilWarga?.alamat ? (
                          <>
                            <p className="truncate">{user.profilWarga.alamat}</p>
                            <p className="text-[11px] text-slate-400">
                              RT {user.profilWarga.rt || "-"} / RW {user.profilWarga.rw || "-"}
                            </p>
                          </>
                        ) : (
                          <span className="text-amber-500 text-[11px]">Alamat belum diisi</span>
                        )
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* No. WhatsApp */}
                    <td className="py-3 px-4">
                      {(() => {
                        const noWa = user.profilWarga?.noTelepon || user.petugasContact?.noWhatsapp;
                        return noWa ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22C6.486 22 2 17.514 2 12S6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
                            </svg>
                            {noWa}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        );
                      })()}
                    </td>

                    {/* Status Warga — only shown for WARGA role */}
                    <td className="py-3 px-4">
                      {user.role === "WARGA"
                        ? getStatusWargaBadge(user.profilWarga?.status)
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>

                    {/* Pengajuan count */}
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {user._count.pengajuanLayanan} berkas
                      </span>
                    </td>

                    {/* Actions — dropdown ⋮ */}
                    <td className="py-3 px-4 text-right">
                      <div className="relative inline-block" ref={openMenuId === user.id ? menuRef : null}>
                        {/* Three-dot trigger */}
                        <button
                          id={`menu-btn-${user.id}`}
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
                            aria-labelledby={`menu-btn-${user.id}`}
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
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {!loading && totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-slate-50/70 border-t border-slate-200 text-xs">
            <div className="text-[#64748B]">
              Menampilkan{" "}
              <span className="font-semibold text-[#1E293B]">
                {startIndex + 1}
              </span>
              {" - "}
              <span className="font-semibold text-[#1E293B]">{endIndex}</span> dari{" "}
              <span className="font-semibold text-[#1E293B]">{totalItems}</span> pengguna
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={activePage === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#1E293B] font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Sebelumnya</span>
              </button>

              <div className="flex items-center gap-1">
                {getPageNumbers().map((pageNum, idx) => {
                  if (pageNum === "...") {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1.5 text-slate-400">
                        ...
                      </span>
                    );
                  }
                  const isSelected = pageNum === activePage;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(Number(pageNum))}
                      className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-[#17365D] text-white shadow-xs"
                          : "bg-white border border-[#CBD5E1] text-[#1E293B] hover:bg-slate-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={activePage === totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#1E293B] font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <span>Selanjutnya</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: TAMBAH PENGGUNA ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">Tambah Pengguna Baru</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitAdd} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                  placeholder="Contoh: Ahmad Subagyo"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                    placeholder="email@desa.id"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kata Sandi *</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                    placeholder="Minimal 6 karakter"
                  />
                </div>
              </div>

              {/* Nomor WhatsApp */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor WhatsApp
                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">Opsional</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">📱</span>
                  <input
                    id="add-noTelepon"
                    type="tel"
                    value={formData.noTelepon}
                    onChange={(e) => {
                      setFormData({ ...formData, noTelepon: e.target.value });
                      setPhoneError(validateIndonesianPhone(e.target.value));
                    }}
                    className={`w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none transition-colors ${
                      phoneError
                        ? "border-rose-400 focus:border-rose-400 bg-rose-50"
                        : "border-slate-300 focus:border-[#0F766E]"
                    }`}
                    placeholder="Contoh: 081234567890"
                  />
                </div>
                {phoneError && (
                  <p className="mt-1 text-[11px] text-rose-600">{phoneError}</p>
                )}
                <p className="mt-1 text-[11px] text-slate-400">
                  Digunakan untuk notifikasi WhatsApp layanan desa. Format: 081234567890 atau +6281234567890.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role Akun *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                >
                  <option value="WARGA">WARGA (Masyarakat Pemohon)</option>
                  <option value="STAF_DESA">STAF_DESA (Operator & Verifikator)</option>
                  <option value="SUPERVISOR">SUPERVISOR (Pemeriksa Berjenjang)</option>
                  <option value="KEPALA_DESA">KEPALA_DESA (Pejabat Pengesahan)</option>
                </select>
              </div>

              {/* Data Kependudukan (Jika Warga) */}
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Profil Kependudukan (Opsional / Warga)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Nomor Induk Kependudukan (NIK)</label>
                    <input
                      type="text"
                      maxLength={16}
                      value={formData.nik}
                      onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                      placeholder="16 Digit NIK"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Nomor Kartu Keluarga (KK)</label>
                    <input
                      type="text"
                      maxLength={16}
                      value={formData.noKk}
                      onChange={(e) => setFormData({ ...formData, noKk: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                      placeholder="16 Digit KK"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs text-slate-600 mb-1">Alamat Tempat Tinggal</label>
                  <input
                    type="text"
                    value={formData.alamat}
                    onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                    placeholder="Jl. Merdeka No..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">RT</label>
                    <input
                      type="text"
                      value={formData.rt}
                      onChange={(e) => setFormData({ ...formData, rt: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                      placeholder="001"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">RW</label>
                    <input
                      type="text"
                      value={formData.rw}
                      onChange={(e) => setFormData({ ...formData, rw: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                      placeholder="002"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Status Kependudukan</label>
                    <select
                      value={formData.statusWarga}
                      onChange={(e) => setFormData({ ...formData, statusWarga: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                    >
                      <option value="AKTIF">AKTIF</option>
                      <option value="PINDAH">PINDAH</option>
                      <option value="MENINGGAL">MENINGGAL</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setPhoneError(null); }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-[#0F766E] text-white text-xs font-semibold rounded-lg hover:bg-[#0d655e] transition-colors disabled:opacity-50"
                >
                  {formLoading ? "Menyimpan..." : "Simpan Pengguna"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT PENGGUNA ── */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">Edit Data Pengguna</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitEdit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ganti Kata Sandi (Opsional)
                  </label>
                  <div className="relative">
                    <input
                      type={showEditPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                      placeholder="Kosongkan bila tidak diubah"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      aria-label={showEditPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                      aria-pressed={showEditPassword}
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                    >
                      {showEditPassword ? (
                        /* EyeOff icon */
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        /* Eye icon */
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role Akun</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                >
                  <option value="WARGA">WARGA (Masyarakat Pemohon)</option>
                  <option value="STAF_DESA">STAF_DESA (Operator & Verifikator)</option>
                  <option value="SUPERVISOR">SUPERVISOR (Pemeriksa Berjenjang)</option>
                  <option value="KEPALA_DESA">KEPALA_DESA (Pejabat Pengesahan)</option>
                </select>
              </div>

              {/* Nomor WhatsApp — Edit Modal */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor WhatsApp
                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">Opsional</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">📱</span>
                  <input
                    id="edit-noTelepon"
                    type="tel"
                    value={formData.noTelepon}
                    onChange={(e) => {
                      setFormData({ ...formData, noTelepon: e.target.value });
                      setPhoneError(validateIndonesianPhone(e.target.value));
                    }}
                    className={`w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none transition-colors ${
                      phoneError
                        ? "border-rose-400 focus:border-rose-400 bg-rose-50"
                        : "border-slate-300 focus:border-[#0F766E]"
                    }`}
                    placeholder="Contoh: 081234567890"
                  />
                </div>
                {phoneError && (
                  <p className="mt-1 text-[11px] text-rose-600">{phoneError}</p>
                )}
                <p className="mt-1 text-[11px] text-slate-400">
                  Digunakan untuk notifikasi WhatsApp layanan desa.
                </p>
              </div>

              {/* Data Kependudukan — only editable for WARGA role */}
              {formData.role === "WARGA" ? (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Profil Kependudukan
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">NIK</label>
                      <input
                        type="text"
                        maxLength={16}
                        value={formData.nik}
                        onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                        placeholder="16 digit NIK"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">No KK</label>
                      <input
                        type="text"
                        maxLength={16}
                        value={formData.noKk}
                        onChange={(e) => setFormData({ ...formData, noKk: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                        placeholder="16 digit No KK"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-xs text-slate-600 mb-1">Alamat</label>
                    <input
                      type="text"
                      value={formData.alamat}
                      onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">RT</label>
                      <input
                        type="text"
                        value={formData.rt}
                        onChange={(e) => setFormData({ ...formData, rt: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">RW</label>
                      <input
                        type="text"
                        value={formData.rw}
                        onChange={(e) => setFormData({ ...formData, rw: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Status Kependudukan</label>
                      <select
                        value={formData.statusWarga}
                        onChange={(e) => setFormData({ ...formData, statusWarga: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-[#0F766E] focus:outline-none"
                      >
                        <option value="AKTIF">AKTIF</option>
                        <option value="PINDAH">PINDAH</option>
                        <option value="MENINGGAL">MENINGGAL</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <svg className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">
                        Profil Kependudukan tidak berlaku
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Akun dengan role <span className="font-semibold">{formData.role.replace("_", " ")}</span> tidak menggunakan data NIK/KK.
                        Hanya Nama, Email, Role, dan Kata Sandi yang dapat diubah.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setPhoneError(null); }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading || !!phoneError}
                  className="px-5 py-2 bg-[#0F766E] text-white text-xs font-semibold rounded-lg hover:bg-[#0d655e] transition-colors disabled:opacity-50"
                >
                  {formLoading ? "Memperbarui..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: DETAIL PENGGUNA ── */}
      {isDetailModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#17365D] text-white flex items-center justify-center font-bold text-sm">
                  {selectedUser.nama ? selectedUser.nama.slice(0, 2).toUpperCase() : "U"}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 leading-tight">{selectedUser.nama}</h3>
                  <p className="text-xs text-slate-500">{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-xs text-slate-500">Role Sistem</span>
                <span>{getRoleBadge(selectedUser.role)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-xs text-slate-500">Nomor Induk Kependudukan</span>
                <span className="font-mono font-semibold text-slate-800">
                  {selectedUser.profilWarga?.nik || "Belum terdata"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-xs text-slate-500">Nomor Kartu Keluarga</span>
                <span className="font-mono text-slate-700">
                  {selectedUser.profilWarga?.noKk || "-"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-xs text-slate-500">Alamat Tempat Tinggal</span>
                <span className="text-right text-slate-800 max-w-xs">
                  {selectedUser.profilWarga?.alamat || "-"} (RT {selectedUser.profilWarga?.rt || "-"} / RW {selectedUser.profilWarga?.rw || "-"})
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-xs text-slate-500">Status Warga</span>
                <span>{getStatusWargaBadge(selectedUser.profilWarga?.status)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-xs text-slate-500">Nomor WhatsApp</span>
                <span className="text-xs font-medium text-slate-800">
                  {(() => {
                    const noWa = selectedUser.profilWarga?.noTelepon || selectedUser.petugasContact?.noWhatsapp;
                    return noWa ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22C6.486 22 2 17.514 2 12S6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
                        </svg>
                        {noWa}
                      </span>
                    ) : <span className="text-slate-400">Belum diisi</span>;
                  })()}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-xs text-slate-500">Total Pengajuan Surat</span>
                <span className="font-bold text-[#0F766E]">
                  {selectedUser._count.pengajuanLayanan} Pengajuan
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-xs text-slate-500">Tanggal Terdaftar</span>
                <span className="text-xs text-slate-700">
                  {new Date(selectedUser.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-5 mt-4 border-t border-slate-100">
              <button
                onClick={() => {
                  setIsDetailModalOpen(false);
                  handleOpenEdit(selectedUser);
                }}
                className="px-4 py-2 bg-[#0F766E] text-white text-xs font-semibold rounded-lg hover:bg-[#0d655e] transition-colors"
              >
                Edit Akun Ini
              </button>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: KONFIRMASI HAPUS ── */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900 text-base">Konfirmasi Hapus Pengguna</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus akun <strong>{selectedUser.nama}</strong> ({selectedUser.email})?
              Data profil kependudukan terkait juga akan terhapus. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={formLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {formLoading ? "Menghapus..." : "Ya, Hapus Pengguna"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
