"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={
        className ||
        "px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-[#DC2626] border border-rose-200 rounded-xl transition-all shadow-sm font-medium text-xs flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20"
      }
      title="Keluar dari sistem"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      Keluar
    </button>
  );
}
