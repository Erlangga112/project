import prisma from "@/lib/prisma";
import { ChatRole } from "./roles";

/**
 * Multi-turn database query handlers & answer formatters.
 * Semua query mengambil data riil dari database PostgreSQL via Prisma.
 */

// ─── 1. DATA WARGA MULTI-TURN ──────────────────────────────────────────

export async function handleWargaFollowUp(
  action: "COUNT" | "LIST" | "DETAIL",
  role: ChatRole,
  userId?: string
): Promise<string> {
  // Pengecekan otorisasi: Role WARGA & GUEST tidak diizinkan mengakses data kependudukan warga lain
  if (action === "LIST" || action === "DETAIL") {
    if (role === "WARGA" || role === "GUEST") {
      return (
        "🛡️ **Perlindungan Privasi Warga**: Mohon maaf, demi menjaga kerahasiaan data kependudukan dan privasi warga desa, " +
        "daftar nama dan informasi pribadi warga hanya dapat diakses oleh aparatur atau staf pelayanan desa yang berwenang."
      );
    }
  }

  if (action === "COUNT") {
    const wargaCount = await prisma.user.count({
      where: { role: "WARGA" },
    });
    return `Berdasarkan database saat ini, terdapat **${wargaCount} warga yang terdaftar** dalam sistem pelayanan desa.`;
  }

  if (action === "LIST") {
    const wargaList = await prisma.user.findMany({
      where: { role: "WARGA" },
      select: {
        id: true,
        nama: true,
        email: true,
        profilWarga: {
          select: {
            status: true,
          },
        },
      },
      orderBy: { nama: "asc" },
    });

    if (wargaList.length === 0) {
      return "Berdasarkan database saat ini, belum ada warga yang terdaftar dalam sistem.";
    }

    let text = `📋 **Berikut daftar nama ${wargaList.length} warga yang terdaftar di database desa:**\n\n`;
    wargaList.forEach((w, idx) => {
      const statusLabel = w.profilWarga?.status === "PINDAH" ? " *(Status: Pindah)*" : "";
      text += `${idx + 1}. **${w.nama}** (\`${w.email}\`)${statusLabel}\n`;
    });
    text += `\n*Catatan: Sesuai kebijakan privasi kependudukan, rincian NIK dan alamat hanya dapat diakses melalui permintaan rincian lengkap.*`;
    return text;
  }

  if (action === "DETAIL") {
    const wargaList = await prisma.user.findMany({
      where: { role: "WARGA" },
      select: {
        id: true,
        nama: true,
        email: true,
        profilWarga: {
          select: {
            nik: true,
            noKk: true,
            alamat: true,
            rt: true,
            rw: true,
            status: true,
          },
        },
      },
      orderBy: { nama: "asc" },
    });

    if (wargaList.length === 0) {
      return "Berdasarkan database saat ini, belum ada data profil warga yang tersimpan.";
    }

    let text = `📊 **Tabel Data Kependudukan Warga Terdaftar:**\n\n`;
    text += `| No | Nama Warga | NIK | Alamat Domisili | RT/RW | Status |\n`;
    text += `|---|---|---|---|---|---|\n`;

    wargaList.forEach((w, idx) => {
      const pw = w.profilWarga;
      const nik = pw?.nik || "-";
      const alamat = pw?.alamat || "-";
      const rtrw = pw?.rt || pw?.rw ? `${pw.rt || "00"}/${pw.rw || "00"}` : "-";
      const status = pw?.status || "AKTIF";
      text += `| ${idx + 1} | **${w.nama}** | \`${nik}\` | ${alamat} | ${rtrw} | ${status} |\n`;
    });

    text += `\n*Data di atas divalidasi langsung dari tabel profil kependudukan desa.*`;
    return text;
  }

  return "Informasi warga tidak dapat diproses.";
}

// ─── 2. DATA PENGAJUAN MULTI-TURN ──────────────────────────────────────

export async function handlePengajuanFollowUp(
  action: "COUNT" | "LIST_PEMOHON" | "FILTER_STATUS" | "NAMES_ONLY",
  role: ChatRole,
  userId?: string,
  options?: {
    statusFilter?: string[];
    statusLabel?: string;
    serviceCode?: string;
    serviceName?: string;
  }
): Promise<string> {
  const isWarga = role === "WARGA";
  // Filter base: warga hanya melihat miliknya sendiri
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {};
  if (isWarga && userId) {
    whereClause.pemohonId = userId;
  }

  const activeStatusFilter = options?.statusFilter;
  if (activeStatusFilter && activeStatusFilter.length > 0) {
    whereClause.status = { in: activeStatusFilter };
  }

  if (options?.serviceCode) {
    whereClause.jenisLayanan = {
      OR: [
        { kode: options.serviceCode },
        {
          nama: {
            contains: options.serviceCode.includes("SKTM")
              ? "Tidak Mampu"
              : options.serviceCode.includes("SKU")
              ? "Usaha"
              : options.serviceCode.includes("SKD")
              ? "Domisili"
              : "Kependudukan",
            mode: "insensitive",
          },
        },
      ],
    };
  }

  if (action === "COUNT") {
    const count = await prisma.pengajuanLayanan.count({ where: whereClause });
    const label = options?.statusLabel || "pengajuan";
    const srvText = options?.serviceName ? ` ${options.serviceName}` : "";
    if (isWarga) {
      return `Berdasarkan database saat ini, terdapat **${count} berkas pengajuan${srvText} Anda** yang berstatus **${label}**.`;
    }
    return `Berdasarkan database saat ini, terdapat **${count} pengajuan${srvText}** yang **${label}**.`;
  }

  if (action === "NAMES_ONLY") {
    const items = await prisma.pengajuanLayanan.findMany({
      where: whereClause,
      include: {
        pemohon: { select: { nama: true } },
        jenisLayanan: { select: { nama: true } },
      },
      orderBy: { tanggalPengajuan: "desc" },
    });

    const label = options?.statusLabel || "pengajuan";
    if (items.length === 0) {
      return `Saat ini tidak ada data pemohon pada berkas pengajuan yang **${label}**.`;
    }

    const srvText = options?.serviceName ? ` ${options.serviceName}` : "";
    let text = `👥 **Berikut daftar nama pemohon dari ${items.length} berkas pengajuan${srvText} (${label}):**\n\n`;
    items.forEach((p, idx) => {
      text += `${idx + 1}. **${p.pemohon.nama}** (${p.jenisLayanan.nama}) — No. Reg: \`${p.nomorPengajuan}\`\n`;
    });
    return text;
  }

  if (action === "LIST_PEMOHON" || action === "FILTER_STATUS") {
    const items = await prisma.pengajuanLayanan.findMany({
      where: whereClause,
      include: {
        pemohon: { select: { nama: true, email: true } },
        jenisLayanan: { select: { nama: true, kode: true } },
      },
      orderBy: { tanggalPengajuan: "desc" },
    });

    const label = options?.statusLabel || "pengajuan";

    if (items.length === 0) {
      if (isWarga) {
        return `Saat ini tidak ditemukan berkas pengajuan milik Anda dengan status **${label}**.`;
      }
      return `Berdasarkan database saat ini, belum ada pengajuan yang **${label}**.`;
    }

    const srvText = options?.serviceName ? ` ${options.serviceName}` : "";
    const labelText = options?.statusLabel ? ` dengan status **${options.statusLabel}**` : " yang tercatat dalam sistem";
    let text = `📋 **Berikut daftar ${items.length} pengajuan${srvText}${labelText}:**\n\n`;

    // Tampilkan data pengajuan dengan format terstruktur rapi
    const displayLimit = 15;
    const displayedItems = items.slice(0, displayLimit);

    displayedItems.forEach((p, idx) => {
      const tgl = new Date(p.tanggalPengajuan).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      text += `${idx + 1}. **Nama pemohon:** **${p.pemohon.nama}**\n`;
      text += `   • **Jenis pengajuan:** ${p.jenisLayanan.nama}\n`;
      text += `   • **No. Registrasi:** \`${p.nomorPengajuan}\`\n`;
      text += `   • **Tanggal pengajuan:** ${tgl}\n`;
      text += `   • **Status:** \`${p.status}\`\n\n`;
    });

    if (items.length > displayLimit) {
      text += `*(Menampilkan ${displayLimit} dari total ${items.length} pengajuan. Ketik "Tampilkan detail salah satu pengajuan" untuk melihat rincian lengkap berkas).*`;
    }

    return text;
  }

  return "Informasi pengajuan tidak dapat diproses.";
}

// ─── 3. DATA SURAT SPESIFIK (SKTM, SKU, SKD, SPK) MULTI-TURN ───────────

export async function handleSuratFollowUp(
  action: "COUNT" | "LIST_PEMOHON" | "STATUS_BREAKDOWN" | "SELESAI" | "DISETUJUI",
  serviceCode: string,
  serviceName: string,
  role: ChatRole,
  userId?: string
): Promise<string> {
  const isWarga = role === "WARGA";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {
    jenisLayanan: {
      OR: [
        { kode: serviceCode },
        { nama: { contains: serviceCode.includes("SKTM") ? "Tidak Mampu" : serviceCode.includes("SKU") ? "Usaha" : serviceCode.includes("SKD") ? "Domisili" : "Kependudukan", mode: "insensitive" } },
      ],
    },
  };

  if (isWarga && userId) {
    whereClause.pemohonId = userId;
  }

  if (action === "COUNT") {
    const count = await prisma.pengajuanLayanan.count({ where: whereClause });
    if (isWarga) {
      return `Berdasarkan database saat ini, Anda memiliki **${count} pengajuan ${serviceName}**.`;
    }
    return `Berdasarkan database saat ini, terdapat **${count} pengajuan ${serviceName}** yang tercatat di sistem.`;
  }

  if (action === "LIST_PEMOHON") {
    const list = await prisma.pengajuanLayanan.findMany({
      where: whereClause,
      include: {
        pemohon: { select: { nama: true } },
        jenisLayanan: { select: { nama: true } },
      },
      orderBy: { tanggalPengajuan: "desc" },
    });

    if (list.length === 0) {
      return `Belum ada pemohon yang mengajukan **${serviceName}** di sistem.`;
    }

    let text = `👥 **Daftar Pemohon ${serviceName} (${list.length} berkas):**\n\n`;
    list.forEach((item, idx) => {
      const tgl = new Date(item.tanggalPengajuan).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      text += `${idx + 1}. **${item.pemohon.nama}** — No. Reg: \`${item.nomorPengajuan}\` (Diajukan: ${tgl}) — Status: **${item.status}**\n`;
    });
    return text;
  }

  if (action === "DISETUJUI") {
    whereClause.status = { in: ["DISETUJUI", "DISETUJUI_SUPERVISOR"] };
    const items = await prisma.pengajuanLayanan.findMany({
      where: whereClause,
      include: {
        pemohon: { select: { nama: true } },
        jenisLayanan: { select: { nama: true } },
      },
      orderBy: { tanggalPengajuan: "desc" },
    });

    if (items.length === 0) {
      return `Belum ada pengajuan **${serviceName}** yang berstatus **DISETUJUI**.`;
    }

    let text = `Berikut pengajuan **${serviceName}** yang sudah disetujui:\n\n`;
    text += `| No | No. Registrasi | Pemohon | Jenis Layanan | Tanggal | Status |\n`;
    text += `|---|---|---|---|---|---|\n`;

    items.forEach((p, idx) => {
      const tgl = new Date(p.tanggalPengajuan).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      text += `| ${idx + 1} | \`${p.nomorPengajuan}\` | **${p.pemohon.nama}** | ${p.jenisLayanan.nama} | ${tgl} | \`${p.status}\` |\n`;
    });

    return text;
  }

  if (action === "STATUS_BREAKDOWN" || action === "SELESAI") {
    if (action === "SELESAI") {
      whereClause.status = "SELESAI";
    }

    const items = await prisma.pengajuanLayanan.findMany({
      where: whereClause,
      include: {
        pemohon: { select: { nama: true } },
        dokumenHasil: { select: { nomorSurat: true } },
      },
      orderBy: { tanggalPengajuan: "desc" },
    });

    if (items.length === 0) {
      if (action === "SELESAI") {
        return `Belum ada pengajuan **${serviceName}** yang berstatus **SELESAI**.`;
      }
      return `Tidak ada data status pengajuan untuk **${serviceName}**.`;
    }

    if (action === "SELESAI") {
      let text = `✅ **Pengajuan ${serviceName} yang Sudah Selesai:**\n\n`;
      items.forEach((p, idx) => {
        const noSurat = p.dokumenHasil?.nomorSurat ? `Nomor Surat Sah: **${p.dokumenHasil.nomorSurat}**` : "Surat siap dicetak";
        text += `${idx + 1}. **${p.pemohon.nama}** (\`${p.nomorPengajuan}\`) — ${noSurat}\n`;
      });
      return text;
    }

    // Breakdown status
    let text = `📊 **Status Terkini Pengajuan ${serviceName}:**\n\n`;
    items.forEach((p, idx) => {
      text += `${idx + 1}. **${p.pemohon.nama}** [${p.nomorPengajuan}] ➔ Status: **${p.status}**\n`;
    });
    return text;
  }

  return "Informasi surat tidak dapat diproses.";
}

// ─── 4. DATA PETUGAS / STAF MULTI-TURN ─────────────────────────────────

export async function handleStafFollowUp(
  action: "COUNT" | "LIST" | "DUTIES",
  role: ChatRole
): Promise<string> {
  if (action === "COUNT") {
    const count = await prisma.user.count({ where: { role: "STAF_DESA" } });
    return `Berdasarkan database sistem saat ini, terdapat **${count} staf desa / operator pelayanan** yang bertugas.`;
  }

  if (action === "LIST") {
    const stafList = await prisma.user.findMany({
      where: { role: "STAF_DESA" },
      select: {
        nama: true,
        email: true,
        createdAt: true,
      },
      orderBy: { nama: "asc" },
    });

    if (stafList.length === 0) {
      return "Saat ini belum ada akun staf desa yang terdaftar di database.";
    }

    let text = `👥 **Daftar Staf Pelayanan Desa yang Terdaftar (${stafList.length} orang):**\n\n`;
    stafList.forEach((s, idx) => {
      text += `${idx + 1}. **${s.nama}** (\`${s.email}\`)\n`;
    });
    text += `\n*Ketik "Apa tugas mereka?" untuk melihat rincian wewenang verifikasi.*`;
    return text;
  }

  if (action === "DUTIES") {
    return (
      `📝 **Tugas & Wewenang Staf Desa (Operator Pelayanan):**\n\n` +
      `1. **Pemeriksaan Berkas Masuk:** Memeriksa lampiran persyaratan dokumen warga pada status \`DIAJUKAN\`.\n` +
      `2. **Proses Verifikasi:** Mengubah status menjadi \`DIPERIKSA\` saat meneliti keabsahan berkas.\n` +
      `3. **Tindakan Perbaikan:** Menandai \`PERLU_PERBAIKAN\` dengan catatan spesifik jika berkas kurang lengkap atau buram.\n` +
      `4. **Meneruskan ke Supervisor:** Berkas yang memenuhi syarat diteruskan ke tahap \`MENUNGGU_VALIDASI\`.\n` +
      `5. **Penerbitan Surat:** Setelah disetujui Kepala Desa, staf menerbitkan dokumen fisik/PDF dengan nomor surat definitif (\`SELESAI\`).`
    );
  }

  return "Informasi staf tidak dapat diproses.";
}

// ─── 5. DATA STATISTIK BULANAN & TREN ───────────────────────────────────

export async function handleStatistikFollowUp(
  action: "BULAN_INI" | "BULAN_LALU" | "TREND",
  role: ChatRole
): Promise<string> {
  const now = new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const namaBulanIni = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const namaBulanLalu = startOfLastMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const [countBulanIni, countBulanLalu] = await Promise.all([
    prisma.pengajuanLayanan.count({
      where: {
        tanggalPengajuan: { gte: startOfCurrentMonth },
      },
    }),
    prisma.pengajuanLayanan.count({
      where: {
        tanggalPengajuan: {
          gte: startOfLastMonth,
          lt: startOfCurrentMonth,
        },
      },
    }),
  ]);

  if (action === "BULAN_INI") {
    return `Berdasarkan database, terdapat **${countBulanIni} pengajuan masuk** pada bulan **${namaBulanIni}**.`;
  }

  if (action === "BULAN_LALU") {
    return `Pada bulan lalu (**${namaBulanLalu}**), tercatat sebanyak **${countBulanLalu} pengajuan masuk** di sistem.`;
  }

  if (action === "TREND") {
    const diff = countBulanIni - countBulanLalu;
    let trendDesc = "";
    if (diff > 0) {
      trendDesc = `terjadi **peningkatan** sebesar **${diff} pengajuan** (+${Math.round((diff / (countBulanLalu || 1)) * 100)}%) dibandingkan bulan lalu.`;
    } else if (diff < 0) {
      const absDiff = Math.abs(diff);
      trendDesc = `terjadi **penurunan** sebesar **${absDiff} pengajuan** (-${Math.round((absDiff / (countBulanLalu || 1)) * 100)}%) dibandingkan bulan lalu (karena bulan ${namaBulanIni} baru berjalan).`;
    } else {
      trendDesc = `jumlah pengajuan **tetap sama** (${countBulanIni} pengajuan).`;
    }

    return (
      `📈 **Perbandingan Statistik Pengajuan:**\n\n` +
      `• Bulan Lalu (${namaBulanLalu}): **${countBulanLalu} pengajuan**\n` +
      `• Bulan Ini (${namaBulanIni}): **${countBulanIni} pengajuan**\n\n` +
      `Secara statistik, ${trendDesc}`
    );
  }

  return "Informasi statistik bulanan tidak dapat diproses.";
}

// ─── 6. DATA KEPALA DESA / PIMPINAN ─────────────────────────────────────

export async function handleKadesFollowUp(): Promise<string> {
  const kades = await prisma.user.findFirst({
    where: { role: "KEPALA_DESA" },
    select: {
      nama: true,
      email: true,
    },
  });

  if (!kades) {
    return "Berdasarkan data sistem, akun Kepala Desa belum terdaftar.";
  }

  return (
    `🏛️ **Informasi Kepala Desa / Pimpinan Berwenang:**\n\n` +
    `• **Nama:** **${kades.nama || "Kepala Desa"}**\n` +
    `• **Email Kedinasan:** \`${kades.email || "-"}\`\n` +
    `• **Peran / Jabatan:** **Kepala Desa Perum** (\`KEPALA_DESA\`)\n` +
    `• **Wewenang:** Penandatanganan akhir dan pengesahan surat permohonan warga.`
  );
}

// ─── 6B. DATA SEMUA PENGGUNA SISTEM (USER / AKUN) ─────────────────────────

export async function handlePenggunaFollowUp(
  action: "COUNT" | "LIST" | "DETAIL",
  role: ChatRole
): Promise<string> {
  if (role === "WARGA" || role === "GUEST") {
    return (
      "🛡️ **Perlindungan Akses**: Informasi daftar pengguna sistem hanya dapat diakses oleh aparatur atau supervisor yang berwenang."
    );
  }

  if (action === "COUNT") {
    const total = await prisma.user.count();
    return `Berdasarkan database sistem saat ini, terdapat total **${total} pengguna (akun)** yang terdaftar di Sistem Pelayanan Desa Perum.`;
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
    },
    orderBy: [
      { role: "asc" },
      { nama: "asc" },
    ],
  });

  if (users.length === 0) {
    return "Saat ini belum ada data pengguna yang terdaftar di database sistem.";
  }

  const roleLabels: Record<string, string> = {
    WARGA: "🏠 Warga",
    STAF_DESA: "👨‍💼 Staf Pelayanan Desa",
    SUPERVISOR: "🔰 Supervisor",
    KEPALA_DESA: "🏛️ Kepala Desa",
  };

  const byRole: Record<string, typeof users> = {};
  users.forEach((u) => {
    const r = u.role || "LAINNYA";
    if (!byRole[r]) byRole[r] = [];
    byRole[r].push(u);
  });

  let text = `👥 **Daftar Seluruh Pengguna Sistem Terdaftar (${users.length} Akun):**\n\n`;

  const order = ["KEPALA_DESA", "SUPERVISOR", "STAF_DESA", "WARGA"];
  order.forEach((r) => {
    const list = byRole[r];
    if (list && list.length > 0) {
      const label = roleLabels[r] || r;
      text += `**${label} (${list.length}):**\n`;
      list.forEach((u, idx) => {
        text += `${idx + 1}. **${u.nama || "Tanpa Nama"}** — \`${u.email || "-"}\`\n`;
      });
      text += `\n`;
    }
  });

  // Tampilkan role lain jika ada yang tidak masuk kategori standar
  Object.keys(byRole).forEach((r) => {
    if (!order.includes(r)) {
      const list = byRole[r];
      text += `**${r} (${list.length}):**\n`;
      list.forEach((u, idx) => {
        text += `${idx + 1}. **${u.nama || "Tanpa Nama"}** — \`${u.email || "-"}\`\n`;
      });
      text += `\n`;
    }
  });

  return text.trim();
}

// ─── 7. DETAIL SINGLE PENGAJUAN (RINCIAN SATU BERKAS) ────────────────────

export async function handleDetailPengajuanSingle(
  role: ChatRole,
  userId?: string,
  identifier?: string
): Promise<string> {
  const isWarga = role === "WARGA";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {};
  if (isWarga && userId) {
    whereClause.pemohonId = userId;
  }

  if (identifier) {
    whereClause.OR = [
      { nomorPengajuan: { contains: identifier, mode: "insensitive" } },
      { pemohon: { nama: { contains: identifier, mode: "insensitive" } } },
    ];
  }

  const pengajuan = await prisma.pengajuanLayanan.findFirst({
    where: whereClause,
    include: {
      pemohon: {
        select: {
          id: true,
          nama: true,
          email: true,
          profilWarga: {
            select: {
              nik: true,
              alamat: true,
              rt: true,
              rw: true,
            },
          },
        },
      },
      jenisLayanan: {
        select: {
          nama: true,
          kode: true,
          estimasiWaktu: true,
        },
      },
      dokumenHasil: {
        select: {
          nomorSurat: true,
          filePath: true,
        },
      },
      logs: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          action: true,
          catatan: true,
          statusAfter: true,
          createdAt: true,
        },
      },
    },
    orderBy: { tanggalPengajuan: "desc" },
  });

  if (!pengajuan) {
    return "Tidak ditemukan data pengajuan untuk ditampilkan detailnya.";
  }

  const tgl = new Date(pengajuan.tanggalPengajuan).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Masking NIK untuk privasi kependudukan
  const rawNik = pengajuan.pemohon.profilWarga?.nik;
  const maskedNik = rawNik ? `${rawNik.slice(0, 6)}******${rawNik.slice(-4)}` : "Tidak terdata";

  let detail = `📄 **Rincian Detail Pengajuan Layanan:**\n\n`;
  detail += `• **No. Registrasi:** \`${pengajuan.nomorPengajuan}\`\n`;
  detail += `• **Nama Pemohon:** **${pengajuan.pemohon.nama}**\n`;
  detail += `• **NIK Pemohon:** \`${maskedNik}\`\n`;
  detail += `• **Jenis Layanan:** **${pengajuan.jenisLayanan.nama}** (\`${pengajuan.jenisLayanan.kode}\`)\n`;
  detail += `• **Tanggal Pengajuan:** ${tgl}\n`;
  detail += `• **Status Saat Ini:** \`${pengajuan.status}\`\n`;
  if (pengajuan.catatan) {
    detail += `• **Catatan Petugas:** *${pengajuan.catatan}*\n`;
  }
  if (pengajuan.dokumenHasil?.nomorSurat) {
    detail += `• **Nomor Surat Sah:** **${pengajuan.dokumenHasil.nomorSurat}**\n`;
  }

  if (pengajuan.logs && pengajuan.logs.length > 0) {
    detail += `\n🕒 **Riwayat Tahapan Terakhir:**\n`;
    pengajuan.logs.forEach((log) => {
      const logDate = new Date(log.createdAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      const note = log.catatan ? ` — "${log.catatan}"` : "";
      detail += `• \`${log.statusAfter || log.action}\` (${logDate})${note}\n`;
    });
  }

  return detail;
}



