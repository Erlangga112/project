import React from "react";

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case "DIAJUKAN":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-[#D97706] text-xs font-semibold rounded-full border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
          Diajukan
        </span>
      );
    case "DIPERIKSA":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 text-[#0284C7] text-xs font-semibold rounded-full border border-sky-200">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0284C7]" />
          Diperiksa
        </span>
      );
    case "PERLU_PERBAIKAN":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-[#D97706] text-xs font-semibold rounded-full border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
          Perlu Perbaikan
        </span>
      );
    case "MENUNGGU_VALIDASI":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-[#D97706] text-xs font-semibold rounded-full border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
          Menunggu Validasi
        </span>
      );
    case "DISETUJUI_SUPERVISOR":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 text-[#0F766E] text-xs font-semibold rounded-full border border-teal-200">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E]" />
          Disetujui Spv
        </span>
      );
    case "MENUNGGU_APPROVAL_KEPALA_DESA":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-[#D97706] text-xs font-semibold rounded-full border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
          Menunggu Kades
        </span>
      );
    case "DISETUJUI":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-[#15803D] text-xs font-semibold rounded-full border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
          Disetujui
        </span>
      );
    case "SELESAI":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-[#15803D] text-xs font-semibold rounded-full border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
          Selesai
        </span>
      );
    case "DITOLAK":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-[#DC2626] text-xs font-semibold rounded-full border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
          Ditolak
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-[#64748B] text-xs font-semibold rounded-full border border-[#E2E8F0]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]" />
          {status}
        </span>
      );
  }
}
