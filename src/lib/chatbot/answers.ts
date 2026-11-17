import { UserStatsResult, PelayananStatsResult } from "./stats";
import { ChatbotIntent } from "./intents";

/**
 * Menyusun jawaban akurat berbasis data aktual database untuk intent statistik.
 */
export function formatStatisticAnswer(
  intent: ChatbotIntent,
  userStats: UserStatsResult,
  pelayananStats: PelayananStatsResult
): string {
  switch (intent) {
    case "JUMLAH_WARGA": {
      const { wargaCount, totalAkun, wargaAktif, wargaPindah, wargaMeninggal } = userStats;
      if (wargaCount === 0) {
        return "Berdasarkan data sistem saat ini, belum ada akun Warga yang terdaftar dalam sistem manajemen pengguna.";
      }

      let text = `Berdasarkan database saat ini, terdapat **${wargaCount} warga yang terdaftar** dalam sistem pelayanan desa (dari total **${totalAkun} akun pengguna** secara keseluruhan).\n\n`;
      text += `📋 **Rincian Status Kependudukan Warga:**\n`;
      text += `• Warga Aktif: **${wargaAktif} orang**\n`;
      text += `• Warga Pindah: **${wargaPindah} orang**\n`;
      if (wargaMeninggal > 0) {
        text += `• Warga Meninggal: **${wargaMeninggal} orang**\n`;
      }
      text += `\n*Catatan: Akun staf pelayanan, supervisor, dan kepala desa tidak dihitung ke dalam kelompok akun Warga.*\n\n💡 *Anda dapat bertanya "Siapa saja?" untuk melihat daftar nama warga, atau "Tampilkan datanya" untuk tabel lengkap.*`;
      return text;
    }

    case "WARGA_AKTIF": {
      const { wargaAktif, wargaCount } = userStats;
      if (wargaAktif === 0) {
        return "Berdasarkan data kependudukan sistem, saat ini belum ada warga yang berstatus Aktif.";
      }
      return `Berdasarkan data kependudukan sistem, saat ini tercatat **${wargaAktif} warga dengan status Aktif** (dari total **${wargaCount} akun Warga** yang terdaftar).`;
    }

    case "WARGA_PINDAH": {
      const { wargaPindah, wargaCount } = userStats;
      if (wargaPindah === 0) {
        return "Berdasarkan data kependudukan sistem, saat ini **tidak ada warga yang berstatus Pindah** (0 orang).";
      }
      return `Berdasarkan data kependudukan sistem, tercatat **${wargaPindah} warga dengan status Pindah** dari total **${wargaCount} akun Warga** yang terdaftar.`;
    }

    case "TOTAL_AKUN": {
      const { totalAkun, wargaCount, stafCount, supervisorCount, kadesCount } = userStats;
      if (totalAkun === 0) {
        return "Berdasarkan data sistem saat ini, belum ada akun pengguna yang terdaftar.";
      }
      let text = `👥 **Data Pengguna Sistem Pelayanan Desa:**\n\n`;
      text += `Total seluruh data pengguna yang terdaftar di sistem adalah **${totalAkun} akun/pengguna**.\n\n`;
      text += `📊 **Rincian Data Pengguna Berdasarkan Peran (Role):**\n`;
      text += `• Warga / Masyarakat: **${wargaCount} akun**\n`;
      text += `• Operator / Staf Pelayanan Desa: **${stafCount} akun**\n`;
      text += `• Supervisor Pelayanan: **${supervisorCount} akun**\n`;
      text += `• Kepala Desa: **${kadesCount} akun**\n\n`;
      text += `*Semua data di atas diambil langsung secara real-time dari database manajemen pengguna.*`;
      return text;
    }

    case "JUMLAH_STAF": {
      const { stafCount } = userStats;
      if (stafCount === 0) {
        return "Berdasarkan data sistem, saat ini belum ada akun Staf atau Operator Pelayanan Desa yang terdaftar.";
      }
      return `Berdasarkan data sistem, terdapat **${stafCount} akun Staf / Operator Pelayanan Desa** yang bertugas melayani permohonan masyarakat.`;
    }

    case "JUMLAH_SUPERVISOR": {
      const { supervisorCount } = userStats;
      return `Berdasarkan data sistem, terdapat **${supervisorCount} akun Supervisor Pelayanan** terdaftar.`;
    }

    case "JUMLAH_KADES": {
      const { kadesCount } = userStats;
      return `Berdasarkan data sistem, terdapat **${kadesCount} akun Kepala Desa / Pejabat Berwenang** terdaftar.`;
    }

    case "PENGAJUAN_BELUM_SELESAI": {
      const { pengajuanBelumSelesai, totalPengajuan, statusCounts } = pelayananStats;
      if (pengajuanBelumSelesai === 0) {
        return "Saat ini tidak ada permohonan pengajuan yang belum selesai. Seluruh berkas dalam antrean telah terselesaikan atau ditutup. ✨";
      }
      let text = `Saat ini terdapat **${pengajuanBelumSelesai} permohonan pengajuan yang belum selesai** (dalam proses pelayanan) dari total **${totalPengajuan} pengajuan** yang pernah masuk.\n\n`;
      text += `🔍 **Rincian Status Berjalan Saat Ini:**\n`;
      if (statusCounts["DIAJUKAN"]) text += `• Menunggu Pemeriksaan Berkas (DIAJUKAN): **${statusCounts["DIAJUKAN"]}**\n`;
      if (statusCounts["DIPERIKSA"]) text += `• Sedang Diteliti Operator (DIPERIKSA): **${statusCounts["DIPERIKSA"]}**\n`;
      if (statusCounts["PERLU_PERBAIKAN"]) text += `• Menunggu Perbaikan Warga (PERLU_PERBAIKAN): **${statusCounts["PERLU_PERBAIKAN"]}**\n`;
      if (statusCounts["MENUNGGU_VALIDASI"]) text += `• Menunggu Validasi Supervisor: **${statusCounts["MENUNGGU_VALIDASI"]}**\n`;
      if (statusCounts["DISETUJUI_SUPERVISOR"]) text += `• Telah Disetujui Supervisor: **${statusCounts["DISETUJUI_SUPERVISOR"]}**\n`;
      if (statusCounts["MENUNGGU_APPROVAL_KEPALA_DESA"]) text += `• Menunggu Pengesahan Kades: **${statusCounts["MENUNGGU_APPROVAL_KEPALA_DESA"]}**\n`;
      if (statusCounts["DISETUJUI"]) text += `• Disetujui Kades (Menunggu Penerbitan): **${statusCounts["DISETUJUI"]}**\n`;
      return text;
    }

    case "RINGKASAN_BULAN_INI": {
      const { bulanIni, statusCounts, layananBreakdown } = pelayananStats;
      let text = `📊 **Ringkasan Pelayanan Bulan ${bulanIni.bulanNama}:**\n\n`;
      text += `• Total Pengajuan Masuk Bulan Ini: **${bulanIni.total} berkas**\n`;
      text += `• Pengajuan Berhasil Diselesaikan: **${bulanIni.selesai} berkas**\n\n`;
      if (layananBreakdown.length > 0) {
        text += `📑 **Rincian Pengajuan Berdasarkan Jenis Surat:**\n`;
        layananBreakdown.forEach((l) => {
          text += `• ${l.nama}: **${l.count} permohonan**\n`;
        });
      }
      return text;
    }

    case "STATISTIK_PENGAJUAN": {
      const { totalPengajuan, statusCounts } = pelayananStats;
      if (totalPengajuan === 0) {
        return "Berdasarkan data sistem saat ini, belum ada pengajuan surat yang tercatat.";
      }
      const baru = statusCounts["DIAJUKAN"] || 0;
      const diverifikasi = statusCounts["DIPERIKSA"] || 0;
      const ditolak = statusCounts["DITOLAK"] || 0;
      const selesai = (statusCounts["SELESAI"] || 0) + (statusCounts["DISETUJUI"] || 0);

      let text = `📊 **Statistik Seluruh Pengajuan Pelayanan Desa:**\n\n`;
      text += `• **Total Pengajuan:** **${totalPengajuan} permohonan**\n`;
      text += `• **Baru Masuk (Perlu Diproses):** **${baru} berkas**\n`;
      text += `• **Sedang Diverifikasi / Diperiksa:** **${diverifikasi} berkas**\n`;
      text += `• **Ditolak:** **${ditolak} berkas**\n`;
      text += `• **Selesai / Diterbitkan:** **${selesai} berkas**\n\n`;
      text += `*Data ini selaras dengan angka ringkasan kartu statistik di Dashboard Administrasi Staf.*`;
      return text;
    }

    case "STATISTIK_SISTEM": {
      const { totalAkun, wargaCount, stafCount, supervisorCount, kadesCount, wargaAktif, wargaPindah } = userStats;
      const { totalPengajuan, statusCounts } = pelayananStats;
      const baru = statusCounts["DIAJUKAN"] || 0;
      const diverifikasi = statusCounts["DIPERIKSA"] || 0;
      const ditolak = statusCounts["DITOLAK"] || 0;
      const selesai = (statusCounts["SELESAI"] || 0) + (statusCounts["DISETUJUI"] || 0);

      let text = `🏛️ **Ringkasan Lengkap Seluruh Data Sistem Desa Perum:**\n\n`;
      text += `👥 **1. Data Pengguna (${totalAkun} Akun Terdaftar):**\n`;
      text += `   • Warga: **${wargaCount} akun** (Aktif: ${wargaAktif}, Pindah: ${wargaPindah})\n`;
      text += `   • Staf / Operator: **${stafCount} akun**\n`;
      text += `   • Supervisor: **${supervisorCount} akun**\n`;
      text += `   • Kepala Desa: **${kadesCount} akun**\n\n`;
      text += `📋 **2. Data Pengajuan Pelayanan (${totalPengajuan} Berkas):**\n`;
      text += `   • Baru Masuk: **${baru} berkas**\n`;
      text += `   • Diverifikasi: **${diverifikasi} berkas**\n`;
      text += `   • Ditolak: **${ditolak} berkas**\n`;
      text += `   • Selesai: **${selesai} berkas**\n\n`;
      text += `📑 **3. Master Layanan:** Tersedia **4 jenis layanan persuratan aktif** (SKTM, Domisili, SKU, Surat Pengantar Kependudukan).\n\n`;
      text += `*Semua data di atas diambil langsung secara real-time dari database aplikasi.*`;
      return text;
    }

    case "PENGAJUAN_TOTAL": {
      const { totalPengajuan, statusCounts } = pelayananStats;
      if (totalPengajuan === 0) {
        return "Berdasarkan data sistem saat ini, belum ada pengajuan surat yang tercatat.";
      }
      let text = `📊 **Total Pengajuan Pelayanan Desa:** **${totalPengajuan} permohonan**\n\n`;
      text += `**Rincian berdasarkan status:**\n`;
      if (statusCounts["DIAJUKAN"])                      text += `• Baru Masuk (Menunggu Pemeriksaan): **${statusCounts["DIAJUKAN"]}**\n`;
      if (statusCounts["DIPERIKSA"])                     text += `• Sedang Diperiksa Operator: **${statusCounts["DIPERIKSA"]}**\n`;
      if (statusCounts["PERLU_PERBAIKAN"])               text += `• Perlu Perbaikan oleh Warga: **${statusCounts["PERLU_PERBAIKAN"]}**\n`;
      if (statusCounts["MENUNGGU_VALIDASI"])             text += `• Menunggu Validasi Supervisor: **${statusCounts["MENUNGGU_VALIDASI"]}**\n`;
      if (statusCounts["DISETUJUI_SUPERVISOR"])          text += `• Disetujui Supervisor: **${statusCounts["DISETUJUI_SUPERVISOR"]}**\n`;
      if (statusCounts["MENUNGGU_APPROVAL_KEPALA_DESA"]) text += `• Menunggu Pengesahan Kepala Desa: **${statusCounts["MENUNGGU_APPROVAL_KEPALA_DESA"]}**\n`;
      if (statusCounts["DISETUJUI"])                     text += `• Disetujui Kepala Desa: **${statusCounts["DISETUJUI"]}**\n`;
      if (statusCounts["SELESAI"])                       text += `• Selesai / Surat Diterbitkan: **${statusCounts["SELESAI"]}**\n`;
      if (statusCounts["DITOLAK"])                       text += `• Ditolak: **${statusCounts["DITOLAK"]}**\n`;
      return text;
    }

    case "PENGAJUAN_DISETUJUI": {
      // Definisi "disetujui" identik dengan widget Dashboard Supervisor:
      // DISETUJUI_SUPERVISOR + MENUNGGU_APPROVAL_KEPALA_DESA + DISETUJUI + SELESAI
      const { disetujui, statusCounts } = pelayananStats;
      if (disetujui === 0) {
        return "Berdasarkan data Dashboard Supervisor, **belum ada pengajuan yang disetujui** saat ini.";
      }
      let text = `Berdasarkan data Dashboard Supervisor, terdapat **${disetujui} pengajuan yang disetujui**.\n\n`;
      text += `📋 **Rincian status berkas yang termasuk disetujui:**\n`;
      if (statusCounts["DISETUJUI_SUPERVISOR"])          text += `• Disetujui Supervisor: **${statusCounts["DISETUJUI_SUPERVISOR"]}**\n`;
      if (statusCounts["MENUNGGU_APPROVAL_KEPALA_DESA"]) text += `• Menunggu Pengesahan Kepala Desa: **${statusCounts["MENUNGGU_APPROVAL_KEPALA_DESA"]}**\n`;
      if (statusCounts["DISETUJUI"])                     text += `• Disetujui Kepala Desa: **${statusCounts["DISETUJUI"]}**\n`;
      if (statusCounts["SELESAI"])                       text += `• Selesai / Dokumen Terbit: **${statusCounts["SELESAI"]}**\n`;
      text += `\n💡 *Ketik "Apa saja?" atau "Tampilkan daftarnya" untuk melihat daftar pengajuan yang disetujui.*`;
      return text;
    }

    case "PENGAJUAN_SELESAI": {
      const count = pelayananStats.statusCounts["SELESAI"] || 0;
      if (count === 0) {
        return "Berdasarkan database aktual, **belum ada pengajuan yang telah selesai** (surat diterbitkan) saat ini.";
      }
      return `Berdasarkan database aktual, terdapat **${count} pengajuan yang telah selesai** ✅ — surat berhasil diterbitkan dan dapat diunduh oleh warga melalui website.`;
    }

    case "PENGAJUAN_DITOLAK": {
      const count = pelayananStats.statusCounts["DITOLAK"] || 0;
      if (count === 0) {
        return "Berdasarkan data sistem, saat ini **tidak ada pengajuan yang ditolak** (0 permohonan).";
      }
      return `Berdasarkan database aktual, terdapat **${count} pengajuan yang ditolak** ❌. Warga terkait telah diberitahu mengenai alasan penolakan.`;
    }

    case "PENGAJUAN_DIPROSES": {
      const { pengajuanBelumSelesai, statusCounts } = pelayananStats;
      if (pengajuanBelumSelesai === 0) {
        return "Saat ini **tidak ada pengajuan yang sedang diproses** ✨ — seluruh berkas telah selesai atau ditolak.";
      }
      let text = `Saat ini terdapat **${pengajuanBelumSelesai} pengajuan yang masih dalam proses** (belum selesai).\n\n`;
      text += `**Rincian status berjalan:**\n`;
      if (statusCounts["DIAJUKAN"])                      text += `• Menunggu Pemeriksaan: **${statusCounts["DIAJUKAN"]}**\n`;
      if (statusCounts["DIPERIKSA"])                     text += `• Sedang Diperiksa: **${statusCounts["DIPERIKSA"]}**\n`;
      if (statusCounts["PERLU_PERBAIKAN"])               text += `• Perlu Perbaikan Warga: **${statusCounts["PERLU_PERBAIKAN"]}**\n`;
      if (statusCounts["MENUNGGU_VALIDASI"])             text += `• Menunggu Validasi Supervisor: **${statusCounts["MENUNGGU_VALIDASI"]}**\n`;
      if (statusCounts["DISETUJUI_SUPERVISOR"])          text += `• Disetujui Supervisor: **${statusCounts["DISETUJUI_SUPERVISOR"]}**\n`;
      if (statusCounts["MENUNGGU_APPROVAL_KEPALA_DESA"]) text += `• Menunggu Pengesahan Kades: **${statusCounts["MENUNGGU_APPROVAL_KEPALA_DESA"]}**\n`;
      if (statusCounts["DISETUJUI"])                     text += `• Disetujui Kades: **${statusCounts["DISETUJUI"]}**\n`;
      return text;
    }

    case "PENGAJUAN_MENUNGGU_VALIDASI": {
      const count = pelayananStats.statusCounts["MENUNGGU_VALIDASI"] || 0;
      if (count === 0) {
        return "Saat ini **tidak ada pengajuan yang menunggu validasi Supervisor** (0 berkas). 🎉";
      }
      return `Saat ini terdapat **${count} pengajuan yang menunggu validasi Supervisor** 📋. Silakan periksa melalui menu Validasi Pengajuan di dashboard.`;
    }

    default:
      return "Berdasarkan data sistem, informasi statistik telah diperbarui sesuai kondisi database terkini.";
  }
}
