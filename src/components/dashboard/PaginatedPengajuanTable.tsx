"use client";

import { useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/dashboard/StatusBadge";

export interface PengajuanItem {
  id: string;
  status: string;
  tanggalPengajuan: string | Date;
  jenisLayanan: {
    nama: string;
  };
  pemohon: {
    nama: string | null;
  };
}

interface PaginatedPengajuanTableProps {
  items: PengajuanItem[];
  pageSize?: number;
}

export default function PaginatedPengajuanTable({
  items,
  pageSize = 5,
}: PaginatedPengajuanTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const activePage = Math.min(currentPage, totalPages);

  const startIndex = (activePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const currentItems = items.slice(startIndex, endIndex);

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

  return (
    <div className="card">
      <div className="card-header flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <div>
          <h2 className="text-base font-bold text-[#1E293B]">
            Daftar Pengajuan Terbaru
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Menampilkan {pageSize} per halaman (Total {totalItems} pengajuan)
          </p>
        </div>
        <Link href="/staf/pengajuan" className="btn btn-primary btn-xs shrink-0">
          Lihat Semua →
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Pemohon</th>
              <th>Layanan</th>
              <th>Tanggal</th>
              <th>Status</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.length > 0 ? (
              currentItems.map((p) => {
                const dateObj = new Date(p.tanggalPengajuan);
                const formattedDate = !isNaN(dateObj.getTime())
                  ? dateObj.toLocaleDateString("id-ID")
                  : String(p.tanggalPengajuan);

                return (
                  <tr key={p.id}>
                    <td>
                      <span className="font-semibold text-[#1E293B]">
                        {p.pemohon.nama}
                      </span>
                    </td>
                    <td className="text-[#64748B]">{p.jenisLayanan.nama}</td>
                    <td className="text-[#64748B] font-mono text-xs">
                      {formattedDate}
                    </td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/staf/pengajuan/${p.id}`}
                        className="btn btn-primary btn-xs"
                      >
                        Proses
                      </Link>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <svg
                      className="empty-state-icon"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                      />
                    </svg>
                    <p className="font-medium">Belum ada pengajuan masuk</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-slate-50/70 border-t border-[#E2E8F0] text-xs">
          <div className="text-[#64748B]">
            Menampilkan{" "}
            <span className="font-semibold text-[#1E293B]">
              {totalItems > 0 ? startIndex + 1 : 0}
            </span>
            {" - "}
            <span className="font-semibold text-[#1E293B]">{endIndex}</span> dari{" "}
            <span className="font-semibold text-[#1E293B]">{totalItems}</span> pengajuan
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={activePage === 1}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#1E293B] font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-xs"
              aria-label="Halaman sebelumnya"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Sebelumnya</span>
            </button>

            <div className="flex items-center gap-1">
              {getPageNumbers().map((pageNum, idx) => {
                if (pageNum === "...") {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-1 text-slate-400">
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
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#1E293B] font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-xs"
              aria-label="Halaman selanjutnya"
            >
              <span className="hidden sm:inline">Selanjutnya</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

