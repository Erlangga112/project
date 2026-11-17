import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  description?: string;
  color?: "blue" | "green" | "yellow" | "red" | "purple" | "gray" | "teal";
}

const colorMaps: Record<
  string,
  { icon: string; value: string; bg: string }
> = {
  blue: {
    icon: "bg-[#EFF4FB] text-[#17365D] border border-[#DBEAFE]",
    value: "text-[#17365D]",
    bg: "",
  },
  teal: {
    icon: "bg-[#F0FDFA] text-[#0F766E] border border-[#CCFBF1]",
    value: "text-[#0F766E]",
    bg: "",
  },
  green: {
    icon: "bg-emerald-50 text-[#15803D] border border-emerald-200",
    value: "text-[#15803D]",
    bg: "",
  },
  yellow: {
    icon: "bg-amber-50 text-[#D97706] border border-amber-200",
    value: "text-[#D97706]",
    bg: "",
  },
  red: {
    icon: "bg-rose-50 text-[#DC2626] border border-rose-200",
    value: "text-[#DC2626]",
    bg: "",
  },
  purple: {
    icon: "bg-teal-50 text-[#0F766E] border border-teal-200",
    value: "text-[#0F766E]",
    bg: "",
  },
  gray: {
    icon: "bg-slate-100 text-[#64748B] border border-[#E2E8F0]",
    value: "text-[#64748B]",
    bg: "",
  },
};

const defaultIcons: Record<string, React.ReactNode> = {
  blue: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  teal: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  green: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  yellow: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  red: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  purple: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  gray: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
};

export default function StatCard({
  title,
  value,
  icon,
  description,
  color = "blue",
}: StatCardProps) {
  const colorStyle = colorMaps[color] ?? colorMaps.gray;
  const renderedIcon = icon ?? defaultIcons[color] ?? defaultIcons.gray;

  return (
    <div className="stat-card group">
      <div className={`stat-icon ${colorStyle.icon}`}>{renderedIcon}</div>
      <div className="min-w-0 flex-1">
        <p className="stat-label">{title}</p>
        <p className={`stat-value ${colorStyle.value}`}>{value}</p>
        {description && <p className="stat-desc">{description}</p>}
      </div>
    </div>
  );
}
