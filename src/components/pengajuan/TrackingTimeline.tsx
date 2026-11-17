"use client";

import React from "react";

export interface LogEntry {
  id: string;
  action: string;
  catatan?: string | null;
  statusBefore?: string | null;
  statusAfter?: string | null;
  createdAt: string;
  user?: {
    nama?: string | null;
    role?: string | null;
  } | null;
}

interface TrackingTimelineProps {
  status: string;
  logs?: LogEntry[];
  diprosesOleh?: {
    nama: string | null;
    role: string;
  } | null;
  tanggalPengajuan: string;
  tanggalSelesai?: string | null;
  dokumenHasil?: {
    id: string;
    nomorSurat: string;
    filePath?: string | null;
  } | null;
  isCompact?: boolean;
}

type StepState = "completed" | "current" | "pending" | "revision" | "rejected";

interface StepConfig {
  number: number;
  title: string;
  subtitle: string;
  roleHandler: string;
  state: StepState;
  dateStr?: string;
  actorName?: string;
  note?: string;
  nextStepInfo?: string;
}

export default function TrackingTimeline({
  status,
  logs = [],
  diprosesOleh,
  tanggalPengajuan,
  tanggalSelesai,
  dokumenHasil,
  isCompact = false,
}: TrackingTimelineProps) {
  // Urutkan logs kronologis
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Helper pencari log terkait tahapan tertentu
  const findLogByStatus = (targetStatuses: string[]) => {
    return sortedLogs.find(
      (l) =>
        (l.statusAfter && targetStatuses.includes(l.statusAfter)) ||
        targetStatuses.some((st) => l.action.toUpperCase().includes(st))
    );
  };

  const logDiperiksa = findLogByStatus(["DIPERIKSA"]);
  const logPerluPerbaikan = sortedLogs.filter(
    (l) => l.statusAfter === "PERLU_PERBAIKAN" || l.action.includes("Perbaikan")
  ).pop();
  const logSupervisor = findLogByStatus(["MENUNGGU_VALIDASI", "DISETUJUI_SUPERVISOR"]);
  const logKades = findLogByStatus(["MENUNGGU_APPROVAL_KEPALA_DESA", "DISETUJUI"]);
  const logSelesai = findLogByStatus(["SELESAI"]);
  const logDitolak = sortedLogs.filter(
    (l) => l.statusAfter === "DITOLAK" || l.action.includes("Tolak")
  ).pop();

  const isDitolak = status === "DITOLAK";
  const isPerluPerbaikan = status === "PERLU_PERBAIKAN";

  // Penentuan status tiap tahapan
  // Tahap 1: Pengajuan Dikirim
  const step1State: StepState = "completed";

  // Tahap 2: Pemeriksaan Staf Desa
  let step2State: StepState = "pending";
  if (["DIPERIKSA"].includes(status)) {
    step2State = "current";
  } else if (isPerluPerbaikan) {
    step2State = "revision";
  } else if (
    ["MENUNGGU_VALIDASI", "DISETUJUI_SUPERVISOR", "MENUNGGU_APPROVAL_KEPALA_DESA", "DISETUJUI", "SELESAI"].includes(
      status
    )
  ) {
    step2State = "completed";
  } else if (isDitolak && !logSupervisor && !logKades) {
    step2State = "rejected";
  }

  // Tahap 3: Validasi Supervisor
  let step3State: StepState = "pending";
  if (status === "MENUNGGU_VALIDASI") {
    step3State = "current";
  } else if (
    ["DISETUJUI_SUPERVISOR", "MENUNGGU_APPROVAL_KEPALA_DESA", "DISETUJUI", "SELESAI"].includes(status)
  ) {
    step3State = "completed";
  } else if (isDitolak && logSupervisor && !logKades) {
    step3State = "rejected";
  }

  // Tahap 4: Persetujuan Kepala Desa
  let step4State: StepState = "pending";
  if (status === "MENUNGGU_APPROVAL_KEPALA_DESA") {
    step4State = "current";
  } else if (["DISETUJUI", "SELESAI"].includes(status)) {
    step4State = "completed";
  } else if (isDitolak && logKades) {
    step4State = "rejected";
  }

  // Tahap 5: Penerbitan Surat & Dokumen PDF (Selesai)
  let step5State: StepState = "pending";
  if (status === "DISETUJUI") {
    step5State = "current";
  } else if (status === "SELESAI") {
    step5State = "completed";
  }

  const steps: StepConfig[] = [
    {
      number: 1,
      title: "Pengajuan Dikirim",
      subtitle: "Permohonan berhasil didaftarkan oleh warga ke sistem desa.",
      roleHandler: "Warga Pemohon",
      state: step1State,
      dateStr: new Date(tanggalPengajuan).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      nextStepInfo: "Menunggu pemeriksaan berkas oleh Staf Pelayanan Desa.",
    },
    {
      number: 2,
      title: "Pemeriksaan & Verifikasi Berkas",
      subtitle: isPerluPerbaikan
        ? "Petugas meminta Anda melengkapi atau memperbaiki dokumen persyaratan."
        : "Pemeriksaan kelengkapan dan keabsahan berkas persyaratan.",
      roleHandler: "Staf Pelayanan Desa",
      state: step2State,
      actorName: diprosesOleh?.nama || logDiperiksa?.user?.nama || "Staf Pelayanan",
      dateStr: logDiperiksa ? new Date(logDiperiksa.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : undefined,
      note: isPerluPerbaikan && logPerluPerbaikan?.catatan ? logPerluPerbaikan.catatan : undefined,
      nextStepInfo: "Setelah berkas lengkap, akan diteruskan ke Supervisor untuk validasi.",
    },
    {
      number: 3,
      title: "Validasi Pengawas Pelayanan",
      subtitle: "Peninjauan administratif tingkat pengawas pelayanan desa.",
      roleHandler: "Supervisor Pelayanan",
      state: step3State,
      actorName: logSupervisor?.user?.nama || "Supervisor Pelayanan",
      dateStr: logSupervisor ? new Date(logSupervisor.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : undefined,
      note: logSupervisor?.catatan || undefined,
      nextStepInfo: "Setelah divalidasi, berkas diajukan ke meja Kepala Desa.",
    },
    {
      number: 4,
      title: "Pemeriksaan & Pengesahan Kades",
      subtitle: "Penetapan persetujuan dan pengesahan resmi oleh Kepala Desa.",
      roleHandler: "Kepala Desa Perum",
      state: step4State,
      actorName: logKades?.user?.nama || "Bapak Kepala Desa",
      dateStr: logKades ? new Date(logKades.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : undefined,
      note: logKades?.catatan || undefined,
      nextStepInfo: "Setelah disahkan, nomor registrasi surat diterbitkan oleh staf.",
    },
    {
      number: 5,
      title: "Penerbitan Surat & PDF Resmi",
      subtitle: dokumenHasil?.nomorSurat
        ? `Surat resmi telah terbit (No: ${dokumenHasil.nomorSurat}). Dokumen PDF siap diunduh & dicetak.`
        : "Penomoran surat dan pembuatan berkas dokumen PDF resmi.",
      roleHandler: "Sistem & Operator Pelayanan",
      state: step5State,
      dateStr: tanggalSelesai
        ? new Date(tanggalSelesai).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
        : logSelesai
        ? new Date(logSelesai.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
        : undefined,
      actorName: logSelesai?.user?.nama || undefined,
      note: dokumenHasil?.nomorSurat ? `Nomor Surat Sah: ${dokumenHasil.nomorSurat}` : undefined,
    },
  ];

  if (isCompact) {
    // Mode Ringkas (Untuk Kartu Pengajuan di Halaman List)
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">Kemajuan Proses Pelayanan:</span>
          <span className="font-mono text-slate-500">
            {isDitolak
              ? "Permohonan Ditolak"
              : isPerluPerbaikan
              ? "Perlu Perbaikan"
              : status === "SELESAI"
              ? "5/5 Selesai"
              : status === "DISETUJUI"
              ? "4/5 Disetujui (Menunggu Terbit)"
              : status === "MENUNGGU_APPROVAL_KEPALA_DESA"
              ? "3/5 Menunggu Kades"
              : status === "MENUNGGU_VALIDASI"
              ? "2/5 Menunggu Supervisor"
              : status === "DIPERIKSA"
              ? "1/5 Diperiksa Staf"
              : "0/5 Diajukan"}
          </span>
        </div>

        {/* Progress Bar 5 Kotak */}
        <div className="grid grid-cols-5 gap-1.5">
          {steps.map((st) => {
            let bgClass = "bg-slate-200";
            if (st.state === "completed") bgClass = "bg-emerald-500";
            if (st.state === "current") bgClass = "bg-sky-500 animate-pulse";
            if (st.state === "revision") bgClass = "bg-amber-500";
            if (st.state === "rejected") bgClass = "bg-rose-500";

            return (
              <div key={st.number} className="flex flex-col gap-1">
                <div className={`h-2 rounded-full ${bgClass} transition-colors`} />
                <span className="text-[10px] text-slate-500 truncate text-center hidden sm:block">
                  {st.title.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Mode Lengkap (Untuk Halaman Detail Pengajuan)
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 md:p-8 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0F766E] animate-pulse" />
            <h3 className="text-base font-bold text-[#17365D]">
              Pelacakan Alur & Riwayat Tahapan Pengajuan
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Informasi riwayat pemrosesan berjenjang dari pengajuan hingga surat PDF resmi diterbitkan.
          </p>
        </div>

        {diprosesOleh?.nama && (
          <div className="text-left sm:text-right bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs">
            <span className="text-slate-500 block">Petugas Penanggung Jawab:</span>
            <strong className="text-[#17365D] font-semibold">{diprosesOleh.nama}</strong>
          </div>
        )}
      </div>

      {/* Banner Khusus Ditolak */}
      {isDitolak && (
        <div className="my-5 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-[#DC2626] flex items-start gap-3">
          <div className="p-1 bg-rose-100 rounded-lg shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-[#DC2626]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <strong className="font-bold block text-sm">Permohonan Pengajuan Tidak Dapat Disetujui</strong>
            <span>{logDitolak?.catatan || "Permohonan ditolak oleh pejabat berwenang berdasarkan hasil verifikasi dokumen."}</span>
          </div>
        </div>
      )}

      {/* Timeline Stepper Vertikal */}
      <div className="relative mt-6 space-y-8 before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-slate-200 before:pointer-events-none">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;

          // Icon & Style per State
          let iconBg = "bg-slate-100 border-slate-300 text-slate-400";
          let badgeText = "Belum Dimulai";
          let badgeBg = "bg-slate-100 text-slate-600 border-slate-200";

          if (step.state === "completed") {
            iconBg = "bg-emerald-500 border-emerald-600 text-white shadow-xs shadow-emerald-200";
            badgeText = "Selesai";
            badgeBg = "bg-emerald-50 text-[#15803D] border-emerald-200";
          } else if (step.state === "current") {
            iconBg = "bg-sky-600 border-sky-700 text-white shadow-xs shadow-sky-200 animate-pulse";
            badgeText = "Sedang Diproses";
            badgeBg = "bg-sky-50 text-[#0284C7] border-sky-200 font-bold";
          } else if (step.state === "revision") {
            iconBg = "bg-amber-500 border-amber-600 text-white shadow-xs shadow-amber-200 animate-bounce";
            badgeText = "Perlu Perbaikan";
            badgeBg = "bg-amber-50 text-[#D97706] border-amber-200 font-bold";
          } else if (step.state === "rejected") {
            iconBg = "bg-rose-500 border-rose-600 text-white shadow-xs shadow-rose-200";
            badgeText = "Ditolak";
            badgeBg = "bg-rose-50 text-[#DC2626] border-rose-200";
          }

          return (
            <div key={step.number} className="relative flex items-start gap-4 sm:gap-6">
              {/* Bulat Lingkaran Indikator */}
              <div
                className={`relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 font-bold text-xs transition-colors ${iconBg}`}
              >
                {step.state === "completed" ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.state === "revision" ? (
                  <span className="text-base">!</span>
                ) : step.state === "rejected" ? (
                  <span className="text-base">✕</span>
                ) : (
                  <span>{step.number}</span>
                )}
              </div>

              {/* Konten Tahapan */}
              <div
                className={`flex-1 p-4 rounded-xl border transition-all ${
                  step.state === "current"
                    ? "bg-sky-50/50 border-sky-200 shadow-xs"
                    : step.state === "revision"
                    ? "bg-amber-50/60 border-amber-300 shadow-xs"
                    : step.state === "completed"
                    ? "bg-white border-slate-200"
                    : "bg-slate-50/60 border-slate-200/80 opacity-75"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-bold text-[#1E293B]">
                      Tahap {step.number}: {step.title}
                    </h4>
                    <span
                      className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${badgeBg}`}
                    >
                      {badgeText}
                    </span>
                  </div>

                  <span className="text-[11px] font-medium text-slate-400">
                    Pelaksana: <strong className="text-slate-600">{step.roleHandler}</strong>
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-2.5">
                  {step.subtitle}
                </p>

                {/* Info Petugas & Waktu Selesai */}
                {(step.dateStr || step.actorName) && (
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    {step.actorName && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Oleh: <strong>{step.actorName}</strong>
                      </span>
                    )}
                    {step.dateStr && (
                      <span className="flex items-center gap-1 font-mono text-slate-400">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {step.dateStr}
                      </span>
                    )}
                  </div>
                )}

                {/* Catatan Khusus Tahapan (Catatan Perbaikan / Catatan Petugas) */}
                {step.note && (
                  <div
                    className={`mt-2.5 p-3 rounded-lg text-xs border ${
                      step.state === "revision"
                        ? "bg-amber-100/70 border-amber-300 text-amber-900"
                        : "bg-slate-100 border-slate-200 text-slate-700"
                    }`}
                  >
                    <span className="font-semibold block mb-0.5">Catatan Petugas:</span>
                    <p className="italic">{step.note}</p>
                  </div>
                )}

                {/* Petunjuk Tahapan Selanjutnya */}
                {step.state === "current" && step.nextStepInfo && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-sky-800 font-medium bg-sky-100/60 px-3 py-1.5 rounded-lg border border-sky-200">
                    <svg className="w-3.5 h-3.5 text-sky-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span>Langkah Berikutnya: {step.nextStepInfo}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
