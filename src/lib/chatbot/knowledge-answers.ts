import prisma from "@/lib/prisma";
import { ChatRole } from "./roles";
import { getActualUserStats, getActualPelayananStats } from "./stats";

/**
 * 1. MENGENALI PENGGUNA (User Profile & Identity Awareness)
 * Mengidentifikasi nama, peran/role, profil kependudukan, wewenang, dan status tugas pengguna saat ini.
 */
export async function handleUserProfileAnswer(
  userId?: string,
  role: ChatRole = "GUEST"
): Promise<string> {
  if (!userId || role === "GUEST") {
    return (
      `👤 **Status Pengguna: Tamu / Pengunjung Publik (GUEST)**\n\n` +
      `Anda saat ini belum masuk (login) ke dalam sistem pelayanan desa.\n\n` +
      `📌 **Akses yang Tersedia untuk Tamu:**\n` +
      `• Melihat informasi publik seputar jam pelayanan kantor desa\n` +
      `• Melihat daftar jenis surat dan persyaratan dokumen administrasi\n` +
      `• Panduan prosedur dan alur pengajuan surat\n\n` +
      `👉 *Untuk mengajukan surat atau memeriksa berkas pengajuan pribadi, silakan [Masuk / Login ke Akun Anda](/login) terlebih dahulu.*`
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profilWarga: true,
    },
  });

  const userName = user?.nama || user?.profilWarga?.namaLengkap || "Pengguna";
  const userEmail = user?.email || "Tidak terdaftar";

  // A. PENGGUNA: STAF DESA (OPERATOR PELAYANAN)
  if (role === "STAF_DESA") {
    const [baruMasuk, sedangDiperiksa, perluPerbaikan, totalAntrean] = await Promise.all([
      prisma.pengajuanLayanan.count({ where: { status: "DIAJUKAN" } }),
      prisma.pengajuanLayanan.count({ where: { status: "DIPERIKSA" } }),
      prisma.pengajuanLayanan.count({ where: { status: "PERLU_PERBAIKAN" } }),
      prisma.pengajuanLayanan.count({
        where: {
          status: { in: ["DIAJUKAN", "DIPERIKSA", "PERLU_PERBAIKAN", "MENUNGGU_VALIDASI"] },
        },
      }),
    ]);

    return (
      `👤 **Identitas Pengguna Terautentikasi:**\n` +
      `• **Nama Petugas:** **${userName}**\n` +
      `• **Email Akun:** \`${userEmail}\`\n` +
      `• **Peran / Role:** **Petugas Pelayanan & Staf Desa** (\`STAF_DESA\`)\n` +
      `• **Unit Kerja:** Kantor Pelayanan Terpadu Desa Perum, Kota Cirebon\n\n` +
      `📋 **Tugas & Wewenang Utama Anda:**\n` +
      `1. Memeriksa kelengkapan berkas surat masuk dari warga\n` +
      `2. Mengubah status berkas menjadi **DIPERIKSA** saat meneliti lampiran\n` +
      `3. Memberikan catatan spesifik jika berkas **DITOLAK**\n` +
      `4. Meneruskan berkas lengkap ke Supervisor (**MENUNGGU VALIDASI**)\n` +
      `5. Mengelola master data jenis layanan dan memantau kependudukan desa\n\n` +
      `⚡ **Status Antrean Tugas Anda Hari Ini:**\n` +
      `• **Baru Masuk (Perlu Diproses):** **${baruMasuk} berkas**\n` +
      `• **Sedang Diverifikasi:** **${sedangDiperiksa} berkas**\n` +
      `• **Menunggu Perbaikan Warga:** **${perluPerbaikan} berkas**\n` +
      `• **Total Antrean Aktif:** **${totalAntrean} berkas**\n\n` +
      `👉 *Anda dapat langsung memeriksa berkas melalui menu [Verifikasi Pengajuan](/staf).*`
    );
  }

  // B. PENGGUNA: WARGA / MASYARAKAT
  if (role === "WARGA") {
    const [userPengajuan, totalWargaPengajuan] = await Promise.all([
      prisma.pengajuanLayanan.findMany({
        where: { pemohonId: userId },
        include: { jenisLayanan: true, dokumenHasil: true },
        orderBy: { tanggalPengajuan: "desc" },
        take: 3,
      }),
      prisma.pengajuanLayanan.count({
        where: { pemohonId: userId },
      }),
    ]);

    const pw = user?.profilWarga;
    const nikFormatted = pw?.nik ? `${pw.nik.slice(0, 6)}******${pw.nik.slice(-4)}` : "Belum terdata";
    const noKkFormatted = pw?.noKk ? `${pw.noKk.slice(0, 6)}******${pw.noKk.slice(-4)}` : "Belum terdata";
    const alamat = pw?.alamat ? `${pw.alamat}, RT ${pw.rt || "00"} / RW ${pw.rw || "00"}` : "Desa Perum";
    const statusWarga = pw?.status || "AKTIF";

    let pengajuanSummary = `Anda memiliki **${totalWargaPengajuan} pengajuan surat** di sistem.`;
    if (totalWargaPengajuan > 0 && userPengajuan.length > 0) {
      pengajuanSummary += `\n\n**Pengajuan Terbaru Anda:**\n`;
      userPengajuan.forEach((p) => {
        pengajuanSummary += `• **[${p.nomorPengajuan}]** ${p.jenisLayanan.nama} — Status: **${p.status}**\n`;
      });
    }

    return (
      `👤 **Data Profil Anda (Warga Desa Perum):**\n` +
      `• **Nama Lengkap:** **${userName}**\n` +
      `• **Email:** \`${userEmail}\`\n` +
      `• **Peran / Role:** **Masyarakat / Warga Terdaftar** (\`WARGA\`)\n` +
      `• **NIK:** \`${nikFormatted}\`\n` +
      `• **No. KK:** \`${noKkFormatted}\`\n` +
      `• **Alamat Domisili:** ${alamat}\n` +
      `• **Status Kependudukan:** **${statusWarga}**\n\n` +
      `📑 **Status Layanan Persuratan Anda:**\n` +
      `${pengajuanSummary}\n\n` +
      `👉 *Anda dapat membuat surat baru dengan mengetikkan misalnya "Saya ingin membuat SKTM" atau membuka halaman [Pengajuan Surat](/warga/pengajuan).*`
    );
  }

  // C. PENGGUNA: SUPERVISOR PELAYANAN
  if (role === "SUPERVISOR") {
    const [menungguValidasi, delayedCount, stats] = await Promise.all([
      prisma.pengajuanLayanan.count({ where: { status: "MENUNGGU_VALIDASI" } }),
      prisma.pengajuanLayanan.count({
        where: {
          status: { notIn: ["SELESAI", "DITOLAK"] },
          tanggalPengajuan: { lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        },
      }),
      getActualPelayananStats(),
    ]);

    return (
      `👤 **Identitas Pengguna Terautentikasi:**\n` +
      `• **Nama Supervisor:** **${userName}**\n` +
      `• **Email Akun:** \`${userEmail}\`\n` +
      `• **Peran / Role:** **Supervisor Pelayanan Desa** (\`SUPERVISOR\`)\n` +
      `• **Unit Kerja:** Pengawasan & Mutu Pelayanan Desa Perum\n\n` +
      `📋 **Wewenang & Fungsi Pengawasan Anda:**\n` +
      `1. Memvalidasi berkas yang telah diperiksa operator sebelum diteruskan ke Kepala Desa\n` +
      `2. Mengontrol SLA waktu tunggu agar tidak terjadi berkas tertunda/melebihi estimasi\n` +
      `3. Memantau database kependudukan, master layanan, dan jejak audit aktivitas sistem\n\n` +
      `⚡ **Status Pengawasan Hari Ini:**\n` +
      `• Berkas Menunggu Validasi Anda: **${menungguValidasi} berkas**\n` +
      `• Berkas Melebihi Batas SLA (>3 Hari): **${delayedCount} berkas**\n` +
      `• Total Pengajuan Selesai Bulan Ini: **${stats.bulanIni.selesai} berkas**`
    );
  }

  // D. PENGGUNA: KEPALA DESA
  if (role === "KEPALA_DESA") {
    const [menungguTtd, selesaiCount, totalStats] = await Promise.all([
      prisma.pengajuanLayanan.count({
        where: {
          status: { in: ["MENUNGGU_APPROVAL_KEPALA_DESA", "DISETUJUI_SUPERVISOR"] },
        },
      }),
      prisma.pengajuanLayanan.count({ where: { status: "SELESAI" } }),
      getActualPelayananStats(),
    ]);

    return (
      `🏛️ **Identitas Pimpinan Desa Terautentikasi:**\n` +
      `• **Nama Kepala Desa:** **${userName}**\n` +
      `• **Email Resmi:** \`${userEmail}\`\n` +
      `• **Peran / Role:** **Kepala Desa Perum** (\`KEPALA_DESA\`)\n` +
      `• **Wewenang:** Pengesahan tertinggi, approval surat resmi, dan kebijakan umum pelayanan desa\n\n` +
      `📊 **Ringkasan Eksekutif untuk Anda:**\n` +
      `• Berkas Menunggu Tanda Tangan / Persetujuan Anda: **${menungguTtd} surat**\n` +
      `• Total Surat Berhasil Diterbitkan: **${selesaiCount} surat**\n` +
      `• Total Permohonan Masuk: **${totalStats.totalPengajuan} permohonan**\n\n` +
      `👉 *Bapak/Ibu Kepala Desa dapat langsung menyetujui surat melalui menu [Approval Pengajuan](/kades).*`
    );
  }

  return `Halo **${userName}**! Anda terdaftar dengan peran **${role}** di Sistem Pelayanan Desa Perum.`;
}

/**
 * 1b. JUMLAH ROLE / PERAN DALAM SISTEM
 * Menampilkan data role dalam sistem:
 * - mode "COUNT": Jika hanya ditanya jumlah role (misal: "ada berapa role?") -> jawab spesifik jumlahnya.
 * - mode "LIST": Jika ditanya rincian/apa saja rolenya -> jawab daftar role beserta rinciannya.
 */
export async function handleJumlahRoleAnswer(
  role: ChatRole,
  mode: "COUNT" | "LIST" = "COUNT"
): Promise<string> {
  try {
    const roleCounts = await prisma.user.groupBy({
      by: ["role"],
      _count: { id: true },
    });

    const roleLabels: Record<string, string> = {
      WARGA: "🏠 Warga",
      STAF_DESA: "👨‍💼 Staf Pelayanan Desa",
      STAF: "👨‍💼 Staf Pelayanan Desa",
      OPERATOR: "⚙️ Operator",
      SUPERVISOR: "🔰 Supervisor",
      KEPALA_DESA: "🏛️ Kepala Desa",
      ADMIN: "🔧 Administrator",
    };

    const roleCount = roleCounts.length;

    if (mode === "COUNT") {
      return (
        `Terdapat **${roleCount} jenis role** dalam Sistem Pelayanan Desa Perum saat ini.\n\n` +
        `💡 *Ketik "Apa saja rolenya?" untuk melihat rincian peran dan jumlah pengguna per role.*`
      );
    }

    const totalUsers = roleCounts.reduce((sum, r) => sum + r._count.id, 0);

    let lines = `📊 **Daftar Role / Peran dalam Sistem Pelayanan Desa:**\n\n`;
    lines += `Sistem memiliki **${roleCount} jenis role** dengan total **${totalUsers} akun** terdaftar:\n\n`;

    for (const r of roleCounts) {
      const label = roleLabels[r.role] || r.role;
      lines += `• **${label}**: ${r._count.id} pengguna\n`;
    }

    lines += `\n📌 Setiap role memiliki hak akses dan wewenang yang berbeda dalam alur pelayanan administrasi desa.`;

    return lines;
  } catch (error) {
    console.error("Error fetching role counts:", error);
    return "Mohon maaf, terjadi kesalahan saat mengambil data role dari database.";
  }
}

/**
 * 2. MEMAHAMI SELURUH ANTREAN PELAYANAN (Pemeriksaan & Alur Berkas)
 */
export async function handleAntreanPelayananAnswer(role: ChatRole): Promise<string> {
  const [activeItems, statusGroup, totalActive] = await Promise.all([
    prisma.pengajuanLayanan.findMany({
      where: {
        status: { in: ["DIAJUKAN", "DIPERIKSA", "PERLU_PERBAIKAN", "MENUNGGU_VALIDASI"] },
      },
      include: {
        pemohon: { select: { nama: true } },
        jenisLayanan: { select: { nama: true, estimasiWaktu: true } },
      },
      orderBy: { tanggalPengajuan: "asc" },
      take: 10,
    }),
    prisma.pengajuanLayanan.groupBy({
      by: ["status"],
      where: {
        status: { in: ["DIAJUKAN", "DIPERIKSA", "PERLU_PERBAIKAN", "MENUNGGU_VALIDASI"] },
      },
      _count: { id: true },
    }),
    prisma.pengajuanLayanan.count({
      where: {
        status: { in: ["DIAJUKAN", "DIPERIKSA", "PERLU_PERBAIKAN", "MENUNGGU_VALIDASI"] },
      },
    }),
  ]);

  const mapCount: Record<string, number> = {};
  for (const s of statusGroup) {
    mapCount[s.status] = s._count.id;
  }

  if (totalActive === 0) {
    return (
      `🎉 **Antrean Pelayanan Bersih!**\n\n` +
      `Saat ini tidak ada berkas pengajuan yang tertunda diproses. Seluruh permohonan masuk telah ditindaklanjuti dengan baik.`
    );
  }

  let text = `📋 **Ringkasan Antrean Pengajuan Pelayanan (${totalActive} Berkas Perlu Diproses):**\n\n`;
  text += `• ✉️ **Baru Masuk (DIAJUKAN):** **${mapCount["DIAJUKAN"] || 0} berkas** *(perlu pemeriksaan berkas)*\n`;
  text += `• 🔍 **Sedang Diverifikasi (DIPERIKSA):** **${mapCount["DIPERIKSA"] || 0} berkas** *(dalam penelitian operator)*\n`;
  text += `• ⚠️ **Perlu Perbaikan (PERLU_PERBAIKAN):** **${mapCount["PERLU_PERBAIKAN"] || 0} berkas** *(menunggu warga melengkapi)*\n`;
  text += `• 📑 **Menunggu Validasi Supervisor:** **${mapCount["MENUNGGU_VALIDASI"] || 0} berkas**\n\n`;

  text += `📝 **Daftar Berkas Teratas dalam Antrean:**\n`;
  activeItems.forEach((item, idx) => {
    const tgl = new Date(item.tanggalPengajuan).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    text += `${idx + 1}. **[${item.nomorPengajuan}]** — ${item.jenisLayanan.nama}\n`;
    text += `   • Pemohon: **${item.pemohon.nama}**\n`;
    text += `   • Status: \`${item.status}\` | Tanggal Masuk: ${tgl}\n`;
    if (item.catatan) {
      text += `   • Catatan: *${item.catatan}*\n`;
    }
  });

  if (totalActive > 10) {
    text += `\n*...dan ${totalActive - 10} berkas lainnya di dalam antrean.*`;
  }

  return text;
}

/**
 * 3. MEMAHAMI PENGAJUAN BARU MASUK (DIAJUKAN)
 */
export async function handlePengajuanBaruAnswer(): Promise<string> {
  const baruMasuk = await prisma.pengajuanLayanan.findMany({
    where: { status: "DIAJUKAN" },
    include: {
      pemohon: { select: { nama: true } },
      jenisLayanan: { select: { nama: true, estimasiWaktu: true } },
    },
    orderBy: { tanggalPengajuan: "asc" },
  });

  if (baruMasuk.length === 0) {
    return "Saat ini **tidak ada pengajuan baru yang berstatus DIAJUKAN**. Semua berkas masuk telah ditindaklanjuti oleh petugas.";
  }

  let text = `📬 **Terdapat ${baruMasuk.length} Pengajuan Baru Masuk (Perlu Pemeriksaan Berkas):**\n\n`;
  baruMasuk.forEach((b, idx) => {
    const tgl = new Date(b.tanggalPengajuan).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    text += `${idx + 1}. **[${b.nomorPengajuan}]** ${b.jenisLayanan.nama}\n`;
    text += `   • Pemohon: **${b.pemohon.nama}**\n`;
    text += `   • Waktu Masuk: ${tgl} WIB\n`;
    text += `   • Target Pengerjaan: ${b.jenisLayanan.estimasiWaktu} hari kerja\n`;
  });

  text += `\n👉 *Petugas dapat membuka menu [Verifikasi Pengajuan](/staf) untuk mengubah status menjadi 'DIPERIKSA' dan meneliti berkas persyaratannya.*`;
  return text;
}

/**
 * 4. MEMAHAMI SELURUH MASTER DATA LAYANAN DESA (Catalog & SLA)
 */
export async function handleDaftarLayananAnswer(): Promise<string> {
  const activeLayanan = await prisma.jenisLayanan.findMany({
    where: { isActive: true },
    orderBy: { nama: "asc" },
  });

  if (activeLayanan.length === 0) {
    return "Saat ini belum ada data jenis layanan surat yang aktif di sistem.";
  }

  let text = `🏛️ **Daftar Layanan Administrasi Surat Desa Perum (${activeLayanan.length} Layanan Aktif):**\n\n`;

  activeLayanan.forEach((l, idx) => {
    let reqs: string[] = [];
    try {
      reqs = JSON.parse(l.persyaratan);
    } catch {
      reqs = [l.persyaratan];
    }

    text += `### ${idx + 1}. ${l.nama} (\`${l.kode}\`)\n`;
    text += `• **Estimasi Waktu Proses:** ${l.estimasiWaktu} hari kerja\n`;
    text += `• **Biaya:** **GRATIS (Rp 0)**\n`;
    text += `• **Deskripsi:** ${l.deskripsi || "Pelayanan administrasi persuratan desa"}\n`;
    text += `• **Persyaratan Dokumen:**\n`;
    reqs.forEach((r) => {
      text += `  - ${r}\n`;
    });
    text += `\n`;
  });

  text += `💡 *Seluruh pengajuan surat dapat diajukan secara daring oleh warga melalui menu [Pengajuan Surat](/warga/pengajuan).*`;
  return text;
}

/**
 * 5. MEMAHAMI STANDARD OPERATING PROCEDURE (SOP) & ALUR VERIFIKASI DESA
 */
export function handleSopPelayananAnswer(role: ChatRole): string {
  return (
    `📋 **Standard Operating Procedure (SOP) Alur Pelayanan Desa Perum:**\n\n` +
    `Alur pelayanan persuratan desa menerapkan verifikasi berjenjang 6 tahap:\n\n` +
    `1️⃣ **Tahap 1 — Pengajuan Mandiri oleh Warga (\`DIAJUKAN\`):**\n` +
    `   • Warga login, memilih jenis surat, mengisi keperluan, dan mengunggah dokumen persyaratan (KTP, KK, dokumen pendukung).\n\n` +
    `2️⃣ **Tahap 2 — Pemeriksaan oleh Operator / Staf Desa (\`DIPERIKSA\`):**\n` +
    `   • Staf memeriksa keabsahan dan kelengkapan berkas fisik/unggah.\n` +
    `   • **Jika berkas kurang/salah:** Staf memberi catatan dan mengubah status menjadi **PERLU PERBAIKAN**.\n` +
    `   • **Jika berkas lengkap:** Staf memvalidasi dan mengirim ke Supervisor dengan status **MENUNGGU VALIDASI**.\n\n` +
    `3️⃣ **Tahap 3 — Validasi Supervisor Pelayanan (\`DISETUJUI_SUPERVISOR\`):**\n` +
    `   • Supervisor melakukan quality control dan verifikasi kepatuhan data sebelum diajukan ke Kepala Desa (**MENUNGGU APPROVAL KEPALA DESA**).\n\n` +
    `4️⃣ **Tahap 4 — Pengesahan Kepala Desa (\`DISETUJUI\`):**\n` +
    `   • Bapak/Ibu Kepala Desa meninjau draft surat sah dan memberikan persetujuan / TTD resmi.\n\n` +
    `5️⃣ **Tahap 5 — Penerbitan Dokumen Resmi (\`SELESAI\`):**\n` +
    `   • Sistem menerbitkan nomor surat resmi secara otomatis dan membangkitkan dokumen surat bertanda tangan sah.\n\n` +
    `6️⃣ **Tahap 6 — Pengambilan / Unduh Mandiri:**\n` +
    `   • Warga menerima notifikasi via Email / WhatsApp dan dapat langsung mengunduh/mencetak PDF surat dari akun warga.`
  );
}

/**
 * 6. MEMAHAMI INFORMASI KANTOR DESA & JAM OPERASIONAL
 */
export function handleJamDanKontakDesaAnswer(): string {
  return (
    `🏛️ **Informasi Kantor & Jam Pelayanan Desa Perum:**\n\n` +
    `📍 **Alamat Kantor:**\n` +
    `Kantor Pelayanan Terpadu Desa Perum, Kecamatan Harjamukti, Kota Cirebon, Jawa Barat.\n\n` +
    `🕒 **Jam Operasional Pelayanan:**\n` +
    `• **Senin s/d Kamis:** 08.00 - 15.00 WIB (Istirahat: 12.00 - 13.00 WIB)\n` +
    `• **Jumat:** 08.00 - 14.30 WIB (Istirahat: 11.30 - 13.00 WIB)\n` +
    `• **Sabtu, Minggu & Hari Libur Nasional:** Tutup (Pelayanan tatap muka libur)\n\n` +
    `🌐 **Layanan Daring (Online):**\n` +
    `• Sistem pengajuan surat melalui aplikasi ini dapat diakses **24 Jam Setiap Hari**.\n` +
    `• Seluruh berkas yang masuk di luar jam kerja akan diproses pada hari kerja berikutnya.\n\n` +
    `💰 **Biaya Pelayanan:**\n` +
    `• **GRATIS (Rp 0)** — Seluruh pengurusan administrasi surat desa tidak dipungut biaya apapun.`
  );
}

/**
 * 7. MEMAHAMI STATUS & LOG NOTIFIKASI SISTEM
 */
export async function handleStatusNotifikasiAnswer(role: ChatRole): Promise<string> {
  const [totalLogs, sentLogs, failedLogs, emailSent, waSent] = await Promise.all([
    prisma.notificationLog.count(),
    prisma.notificationLog.count({ where: { status: "SENT" } }),
    prisma.notificationLog.count({ where: { status: { in: ["FAILED", "PENDING"] } } }),
    prisma.notificationLog.count({ where: { channel: "EMAIL", status: "SENT" } }),
    prisma.notificationLog.count({ where: { channel: "WHATSAPP", status: "SENT" } }),
  ]);

  if (role === "WARGA" || role === "GUEST") {
    return (
      `🔔 **Informasi Saluran Notifikasi Warga:**\n\n` +
      `Sistem Pelayanan Desa Perum secara otomatis mengirimkan notifikasi perkembangan berkas permohonan Anda melalui dua saluran:\n` +
      `1. 📱 **WhatsApp:** Notifikasi pesan instan ke nomor WhatsApp yang terdaftar pada profil akun Anda.\n` +
      `2. 📧 **Email:** Surat elektronik otomatis yang dikirimkan ke alamat email akun Anda.\n\n` +
      `*Pastikan nomor WhatsApp dan email pada profil akun Anda selalu aktif.*`
    );
  }

  return (
    `🔔 **Status Saluran Notifikasi Sistem Pelayanan Desa:**\n\n` +
    `• 📧 **Saluran Email (Gmail SMTP):** **Aktif** (${emailSent} notifikasi terkirim ke warga)\n` +
    `• 📱 **Saluran WhatsApp (Fonnte):** **Aktif** (${waSent} pesan terkirim ke perangkat pemohon)\n` +
    `• 📊 **Total Riwayat Pengiriman:** **${totalLogs} log**\n` +
    `• ✅ **Berhasil Terkirim:** **${sentLogs} notifikasi**\n` +
    `• ⚠️ **Gagal / Pending:** **${failedLogs} notifikasi**\n\n` +
    `*Sistem secara otomatis mengirimkan pembaruan status setiap kali berkas diverifikasi, perlu perbaikan, atau selesai disahkan.*`
  );
}

/**
 * 8. PENCARIAN DATA WARGA (Hanya untuk Staf, Supervisor, Kepala Desa)
 */
export async function handleCariWargaAnswer(query: string, role: ChatRole): Promise<string> {
  if (role === "WARGA" || role === "GUEST") {
    return "🛡️ **Akses Terbatas**: Demi perlindungan privasi data kependudukan, pencarian data warga lain hanya dapat dilakukan oleh aparatur desa yang berwenang.";
  }

  const cleanTerm = query
    .toLowerCase()
    .replace(/(cari|data|warga|atas|nama|penduduk|tentang|cek|informasi|profil)/g, "")
    .trim();

  if (!cleanTerm || cleanTerm.length < 2) {
    const stats = await getActualUserStats();
    return (
      `🔍 **Data Kependudukan Desa Perum:**\n` +
      `• Total Akun Warga Terdaftar: **${stats.wargaCount} orang**\n` +
      `• Warga Status Aktif: **${stats.wargaAktif} orang**\n` +
      `• Warga Status Pindah: **${stats.wargaPindah} orang**\n` +
      `• Warga Status Meninggal: **${stats.wargaMeninggal} orang**\n\n` +
      `Untuk mencari warga tertentu, ketik misalnya: *"Cari warga Budi"* atau *"Cari data warga Siti"*`
    );
  }

  const results = await prisma.profilWarga.findMany({
    where: {
      OR: [
        { namaLengkap: { contains: cleanTerm, mode: "insensitive" } },
        { nik: { contains: cleanTerm } },
      ],
    },
    include: {
      user: { select: { email: true, createdAt: true } },
    },
    take: 5,
  });

  if (results.length === 0) {
    return `🔍 Tidak ditemukan data warga dengan kata kunci **"${cleanTerm}"** dalam database profil kependudukan.`;
  }

  let text = `🔍 **Ditemukan ${results.length} Data Warga untuk "${cleanTerm}":**\n\n`;
  results.forEach((w, idx) => {
    const nikMasked = `${w.nik.slice(0, 6)}******${w.nik.slice(-4)}`;
    text += `${idx + 1}. **${w.namaLengkap}**\n`;
    text += `   • NIK: \`${nikMasked}\` | Status: **${w.status}**\n`;
    text += `   • Alamat: ${w.alamat}, RT ${w.rt}/RW ${w.rw}\n`;
    text += `   • No. Telepon: ${w.noTelepon || "-"}\n`;
  });

  return text;
}

/**
 * 9. MEMAHAMI SELURUH FITUR & MODUL SISTEM PELAYANAN DESA
 */
export async function handleFiturSistemAnswer(role: ChatRole): Promise<string> {
  const [totalLayanan, totalPengajuan, userStats] = await Promise.all([
    prisma.jenisLayanan.count({ where: { isActive: true } }),
    prisma.pengajuanLayanan.count(),
    getActualUserStats(),
  ]);

  let text = `🚀 **Fitur & Modul Utama Sistem Pelayanan Desa Perum:**\n\n`;

  text += `1. 📊 **Dashboard Administrasi & Monitoring Real-time**\n`;
  text += `   • Memantau kartu indikator: Total Pengajuan (${totalPengajuan}), Baru Masuk, Diverifikasi, Perbaikan, dan Selesai.\n`;
  text += `   • Menampilkan daftar antrean berkas terbaru yang memerlukan tindakan.\n\n`;

  text += `2. 📝 **Alur Verifikasi Pengajuan Berjenjang (Multi-level Approval)**\n`;
  text += `   • **Staf Desa:** Memeriksa kelengkapan berkas (\`DIAJUKAN\` ➔ \`DIPERIKSA\`) dan memvalidasi ke Supervisor (\`MENUNGGU_VALIDASI\`).\n`;
  text += `   • **Supervisor:** Melakukan quality control (\`DISETUJUI_SUPERVISOR\`) dan meneruskan ke Kepala Desa.\n`;
  text += `   • **Kepala Desa:** Memberikan persetujuan akhir & pengesahan tanda tangan dokumen (\`DISETUJUI\` ➔ \`SELESAI\`).\n\n`;

  text += `3. 📑 **Katalog Master Layanan Persuratan (${totalLayanan} Layanan Aktif)**\n`;
  text += `   • Pengelolaan jenis layanan, persyaratan dokumen JSON, dan estimasi waktu proses (SLA).\n`;
  text += `   • Layanan tersedia: Surat Keterangan Tidak Mampu (SKTM), Domisili (SKD), Usaha (SKU), dan Pengantar Kependudukan (SPK).\n\n`;

  text += `4. 👥 **Manajemen Data Pengguna & Kependudukan (${userStats.totalAkun} Akun)**\n`;
  text += `   • Pengelolaan akun berjenjang (Warga: ${userStats.wargaCount}, Staf: ${userStats.stafCount}, Supervisor: ${userStats.supervisorCount}, Kades: ${userStats.kadesCount}).\n`;
  text += `   • Pencatatan profil kependudukan (NIK, KK, alamat domisili, status aktif/pindah).\n\n`;

  text += `5. 🔔 **Notifikasi Otomatis Multi-Saluran (WhatsApp & Email)**\n`;
  text += `   • Notifikasi otomatis ke WhatsApp warga (via Gateway Fonnte) & Email (Gmail SMTP) setiap ada perubahan status berkas.\n`;
  text += `   • Dilengkapi audit log pengiriman notifikasi dan pelacakan status terkirim.\n\n`;

  text += `6. 🖨️ **Penerbitan Dokumen Surat Resmi & Cetak PDF**\n`;
  text += `   • Pembuatan dokumen surat otomatis dengan nomor surat sah, format resmi desa, dan verifikasi QR Code.\n\n`;

  text += `7. 🤖 **Asisten AI Interaktif Terpadu (Chatbot)**\n`;
  text += `   • Mengenali identitas & wewenang pengguna yang sedang login.\n`;
  text += `   • Menjawab pertanyaan statistik database secara akurat.\n`;
  text += `   • Membimbing warga mengajukan surat dan memeriksa status secara instan.\n\n`;

  text += `*Semua fitur di atas telah aktif dan terhubung penuh dengan database operasional desa.*`;
  return text;
}

/**
 * 10. MEMAHAMI KESELURUHAN STRUKTUR DATABASE SISTEM
 */
export async function handleStrukturDatabaseAnswer(role: ChatRole): Promise<string> {
  const [
    userCount,
    profilCount,
    layananCount,
    pengajuanCount,
    dokumenCount,
    notifLogCount,
    auditLogCount,
    aiChatCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.profilWarga.count(),
    prisma.jenisLayanan.count(),
    prisma.pengajuanLayanan.count(),
    prisma.dokumenHasil.count(),
    prisma.notificationLog.count(),
    prisma.systemLog.count(),
    prisma.aiChatLog.count(),
  ]);

  let text = `🗄️ **Arsitektur & Keseluruhan Data Database Sistem Pelayanan Desa:**\n\n`;
  text += `Database **PostgreSQL** (\`sistem_pelayanan_desa\`) dirancang secara relasional dan terintegrasi penuh melalui ORM Prisma:\n\n`;

  text += `1. 👤 **Tabel Pengguna & Kependudukan:**\n`;
  text += `   • \`User\` (**${userCount} baris**): Menyimpan kredensial, email, bcrypt password hash, dan Role (\`WARGA\`, \`STAF_DESA\`, \`SUPERVISOR\`, \`KEPALA_DESA\`).\n`;
  text += `   • \`ProfilWarga\` (**${profilCount} baris**): Relasi 1-ke-1 dengan User, menyimpan NIK unik, Nomor KK, nama lengkap, tempat/tgl lahir, alamat, RT/RW, dan status (\`AKTIF\`, \`PINDAH\`, \`MENINGGAL\`).\n\n`;

  text += `2. 🏛️ **Tabel Master Layanan:**\n`;
  text += `   • \`JenisLayanan\` (**${layananCount} baris**): Katalog layanan surat, kode unik (SKTM-01, SKD-01, SKU-01, SPK-01), estimasi waktu SLA, dan persyaratan berkas format JSON.\n\n`;

  text += `3. 📋 **Tabel Pengajuan & Persuratan:**\n`;
  text += `   • \`PengajuanLayanan\` (**${pengajuanCount} baris**): Menyimpan nomor registrasi pengajuan, relasi ke pemohon (\`User\`) dan \`JenisLayanan\`, status alur kerja, tanggal pengajuan, serta catatan telaah operator.\n`;
  text += `   • \`DokumenHasil\` (**${dokumenCount} baris**): Berkas surat resmi yang telah disahkan Kades, nomor surat definitif, file URL PDF, dan timestamp penerbitan.\n\n`;

  text += `4. 🔔 **Tabel Notifikasi & Log Pengiriman:**\n`;
  text += `   • \`Notification\` & \`NotificationLog\` (**${notifLogCount} baris**): Riwayat pengiriman status permohonan ke WhatsApp pemohon (Fonnte API) dan Email (Gmail SMTP).\n`;
  text += `   • \`NotificationConfig\`: Konfigurasi provider notifikasi (WhatsApp Cloud API Meta & Fonnte).\n\n`;

  text += `5. 🛡️ **Tabel Keamanan & Jejak Audit:**\n`;
  text += `   • \`SystemLog\` (**${auditLogCount} baris**): Jejak log audit aktivitas sistem untuk kepatuhan dan akuntabilitas aparatur.\n`;
  text += `   • \`AiChatLog\` (**${aiChatCount} baris**): Riwayat percakapan pengguna dengan Asisten Chatbot.\n\n`;

  text += `*Seluruh tabel di atas aktif dan data disinkronkan secara langsung (real-time).*`;
  return text;
}
