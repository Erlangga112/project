import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  console.log("Menyiapkan template surat resmi prioritas di database...");

  // 1. SKTM-01 (Surat Keterangan Tidak Mampu)
  const sktmTemplate = `<div style="max-width: 650px; margin: 0 auto; font-family: 'Times New Roman', Times, serif; color: #000; line-height: 1.6;">
  <div style="text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 24px;">
    <h3 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px;">PEMERINTAH KABUPATEN CIREBON</h3>
    <h4 style="margin: 2px 0; font-size: 16px; text-transform: uppercase;">KECAMATAN HARJAMUKTI - DESA PERUM</h4>
    <p style="margin: 0; font-size: 11px; color: #333;">Alamat: Jl. Flamboyan Raya No. 01, Desa Perum, Cirebon 45143 | Email: pelayanan@desa.id</p>
  </div>

  <div style="text-align: center; margin-bottom: 24px;">
    <h4 style="margin: 0; font-size: 16px; text-decoration: underline; text-transform: uppercase; letter-spacing: 0.5px;">SURAT KETERANGAN TIDAK MAMPU</h4>
    <p style="margin: 4px 0 0 0; font-size: 13px;">Nomor: <strong>{{nomor_surat}}</strong></p>
  </div>

  <p style="text-align: justify; margin-bottom: 16px; text-indent: 30px;">
    Yang bertanda tangan di bawah ini Kepala Desa Perum, Kecamatan Harjamukti, Kabupaten Cirebon, menerangkan dengan sebenarnya bahwa:
  </p>

  <table style="width: 100%; margin-left: 20px; margin-bottom: 16px; border-collapse: collapse; font-size: 14px;">
    <tr><td style="width: 160px; padding: 3px 0;">Nama Lengkap</td><td style="width: 15px;">:</td><td><strong>{{nama}}</strong></td></tr>
    <tr><td style="padding: 3px 0;">NIK</td><td>:</td><td>{{nik}}</td></tr>
    <tr><td style="padding: 3px 0;">Alamat / Domisili</td><td>:</td><td>{{alamat}}</td></tr>
    <tr><td style="padding: 3px 0;">Keperluan Surat</td><td>:</td><td>{{keperluan}}</td></tr>
  </table>

  <p style="text-align: justify; margin-bottom: 16px; text-indent: 30px;">
    Menerangkan bahwa nama tersebut di atas adalah benar-benar warga yang berdomisili di Desa Perum dan berdasarkan data kependudukan serta hasil verifikasi lapangan tergolong sebagai <strong>Keluarga Kurang Mampu / Pra-Sejahtera</strong>.
  </p>

  <p style="text-align: justify; margin-bottom: 30px; text-indent: 30px;">
    Demikian Surat Keterangan ini dibuat dengan sebenarnya dan penuh rasa tanggung jawab agar dapat dipergunakan sebagaimana mestinya.
  </p>

  <div style="display: flex; justify-content: flex-end; margin-top: 40px;">
    <div style="text-align: center; width: 220px;">
      <p style="margin: 0 0 4px 0; font-size: 13px;">Desa Perum, {{tanggal}}</p>
      <p style="margin: 0 0 65px 0; font-weight: bold; font-size: 13px;">Kepala Desa Perum</p>
      <p style="margin: 0; font-weight: bold; text-decoration: underline; font-size: 13px;">( BAPAK KEPALA DESA )</p>
      <p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">NIP. 19750817 200212 1 003</p>
    </div>
  </div>
</div>`;

  await prisma.jenisLayanan.upsert({
    where: { kode: "SKTM-01" },
    update: {
      templateSurat: sktmTemplate,
      persyaratan: JSON.stringify(["Fotokopi KTP Pemohon", "Fotokopi Kartu Keluarga", "Surat Pengantar RT/RW", "Foto Kondisi Rumah"]),
      estimasiWaktu: 2,
    },
    create: {
      kode: "SKTM-01",
      nama: "Surat Keterangan Tidak Mampu (SKTM)",
      deskripsi: "Surat keterangan resmi dari pemerintah desa bagi warga kurang mampu untuk keperluan beasiswa, keringanan biaya pendidikan/kesehatan, atau bansos.",
      persyaratan: JSON.stringify(["Fotokopi KTP Pemohon", "Fotokopi Kartu Keluarga", "Surat Pengantar RT/RW", "Foto Kondisi Rumah"]),
      estimasiWaktu: 2,
      templateSurat: sktmTemplate,
      isActive: true,
    },
  });

  // 2. SKD-01 (Surat Keterangan Domisili)
  const skdTemplate = `<div style="max-width: 650px; margin: 0 auto; font-family: 'Times New Roman', Times, serif; color: #000; line-height: 1.6;">
  <div style="text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 24px;">
    <h3 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px;">PEMERINTAH KABUPATEN CIREBON</h3>
    <h4 style="margin: 2px 0; font-size: 16px; text-transform: uppercase;">KECAMATAN HARJAMUKTI - DESA PERUM</h4>
    <p style="margin: 0; font-size: 11px; color: #333;">Alamat: Jl. Flamboyan Raya No. 01, Desa Perum, Cirebon 45143 | Email: pelayanan@desa.id</p>
  </div>

  <div style="text-align: center; margin-bottom: 24px;">
    <h4 style="margin: 0; font-size: 16px; text-decoration: underline; text-transform: uppercase; letter-spacing: 0.5px;">SURAT KETERANGAN DOMISILI</h4>
    <p style="margin: 4px 0 0 0; font-size: 13px;">Nomor: <strong>{{nomor_surat}}</strong></p>
  </div>

  <p style="text-align: justify; margin-bottom: 16px; text-indent: 30px;">
    Yang bertanda tangan di bawah ini Kepala Desa Perum, Kecamatan Harjamukti, Kabupaten Cirebon, menerangkan dengan sesungguhnya bahwa:
  </p>

  <table style="width: 100%; margin-left: 20px; margin-bottom: 16px; border-collapse: collapse; font-size: 14px;">
    <tr><td style="width: 160px; padding: 3px 0;">Nama Lengkap</td><td style="width: 15px;">:</td><td><strong>{{nama}}</strong></td></tr>
    <tr><td style="padding: 3px 0;">NIK</td><td>:</td><td>{{nik}}</td></tr>
    <tr><td style="padding: 3px 0;">Alamat Terdaftar</td><td>:</td><td>{{alamat}}</td></tr>
    <tr><td style="padding: 3px 0;">Keperluan</td><td>:</td><td>{{keperluan}}</td></tr>
  </table>

  <p style="text-align: justify; margin-bottom: 16px; text-indent: 30px;">
    Nama tersebut di atas adalah benar-benar penduduk yang berdomisili dan menetap di lingkungan Desa Perum, Kecamatan Harjamukti, Kabupaten Cirebon hingga saat surat keterangan ini diterbitkan.
  </p>

  <p style="text-align: justify; margin-bottom: 30px; text-indent: 30px;">
    Demikian Surat Keterangan Domisili ini dibuat agar dapat dipergunakan sebagaimana mestinya oleh pihak yang berkepentingan.
  </p>

  <div style="display: flex; justify-content: flex-end; margin-top: 40px;">
    <div style="text-align: center; width: 220px;">
      <p style="margin: 0 0 4px 0; font-size: 13px;">Desa Perum, {{tanggal}}</p>
      <p style="margin: 0 0 65px 0; font-weight: bold; font-size: 13px;">Kepala Desa Perum</p>
      <p style="margin: 0; font-weight: bold; text-decoration: underline; font-size: 13px;">( BAPAK KEPALA DESA )</p>
      <p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">NIP. 19750817 200212 1 003</p>
    </div>
  </div>
</div>`;

  await prisma.jenisLayanan.upsert({
    where: { kode: "SKD-01" },
    update: {
      templateSurat: skdTemplate,
      persyaratan: JSON.stringify(["Fotokopi KTP Pemohon", "Fotokopi Kartu Keluarga", "Surat Pengantar RT/RW Setempat"]),
      estimasiWaktu: 1,
    },
    create: {
      kode: "SKD-01",
      nama: "Surat Keterangan Domisili (SKD)",
      deskripsi: "Surat keterangan bukti tempat tinggal dan domisili sah warga di wilayah Desa Perum untuk keperluan perbankan, pekerjaan, atau instansi resmi.",
      persyaratan: JSON.stringify(["Fotokopi KTP Pemohon", "Fotokopi Kartu Keluarga", "Surat Pengantar RT/RW Setempat"]),
      estimasiWaktu: 1,
      templateSurat: skdTemplate,
      isActive: true,
    },
  });

  // 3. SKU-01 (Surat Keterangan Usaha)
  const skuTemplate = `<div style="max-width: 650px; margin: 0 auto; font-family: 'Times New Roman', Times, serif; color: #000; line-height: 1.6;">
  <div style="text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 24px;">
    <h3 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px;">PEMERINTAH KABUPATEN CIREBON</h3>
    <h4 style="margin: 2px 0; font-size: 16px; text-transform: uppercase;">KECAMATAN HARJAMUKTI - DESA PERUM</h4>
    <p style="margin: 0; font-size: 11px; color: #333;">Alamat: Jl. Flamboyan Raya No. 01, Desa Perum, Cirebon 45143 | Email: pelayanan@desa.id</p>
  </div>

  <div style="text-align: center; margin-bottom: 24px;">
    <h4 style="margin: 0; font-size: 16px; text-decoration: underline; text-transform: uppercase; letter-spacing: 0.5px;">SURAT KETERANGAN USAHA (SKU)</h4>
    <p style="margin: 4px 0 0 0; font-size: 13px;">Nomor: <strong>{{nomor_surat}}</strong></p>
  </div>

  <p style="text-align: justify; margin-bottom: 16px; text-indent: 30px;">
    Yang bertanda tangan di bawah ini Kepala Desa Perum, Kecamatan Harjamukti, Kabupaten Cirebon, menerangkan dengan sebenarnya bahwa:
  </p>

  <table style="width: 100%; margin-left: 20px; margin-bottom: 16px; border-collapse: collapse; font-size: 14px;">
    <tr><td style="width: 160px; padding: 3px 0;">Nama Pemilik Usaha</td><td style="width: 15px;">:</td><td><strong>{{nama}}</strong></td></tr>
    <tr><td style="padding: 3px 0;">NIK</td><td>:</td><td>{{nik}}</td></tr>
    <tr><td style="padding: 3px 0;">Alamat Tempat Tinggal</td><td>:</td><td>{{alamat}}</td></tr>
    <tr><td style="padding: 3px 0;">Keterangan / Keperluan</td><td>:</td><td>{{keperluan}}</td></tr>
  </table>

  <p style="text-align: justify; margin-bottom: 16px; text-indent: 30px;">
    Orang tersebut di atas adalah benar-benar memiliki kegiatan usaha aktif dan bertempat tinggal di wilayah Desa Perum. Surat ini dibuat untuk pengantar pembukaan rekening usaha, pengajuan permodalan UMKM/KUR, atau izin usaha.
  </p>

  <p style="text-align: justify; margin-bottom: 30px; text-indent: 30px;">
    Demikian Surat Keterangan Usaha ini diberikan untuk dapat dipergunakan sebagaimana mestinya.
  </p>

  <div style="display: flex; justify-content: flex-end; margin-top: 40px;">
    <div style="text-align: center; width: 220px;">
      <p style="margin: 0 0 4px 0; font-size: 13px;">Desa Perum, {{tanggal}}</p>
      <p style="margin: 0 0 65px 0; font-weight: bold; font-size: 13px;">Kepala Desa Perum</p>
      <p style="margin: 0; font-weight: bold; text-decoration: underline; font-size: 13px;">( BAPAK KEPALA DESA )</p>
      <p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">NIP. 19750817 200212 1 003</p>
    </div>
  </div>
</div>`;

  await prisma.jenisLayanan.upsert({
    where: { kode: "SKU-01" },
    update: {
      templateSurat: skuTemplate,
      persyaratan: JSON.stringify(["Fotokopi KTP Pemilik Usaha", "Fotokopi Kartu Keluarga", "Surat Pengantar RT/RW", "Foto Kegiatan Usaha"]),
      estimasiWaktu: 2,
    },
    create: {
      kode: "SKU-01",
      nama: "Surat Keterangan Usaha (SKU)",
      deskripsi: "Surat keterangan izin dan legalitas kegiatan usaha warga di Desa Perum untuk keperluan pengajuan permodalan, KUR bank, dan kemitraan.",
      persyaratan: JSON.stringify(["Fotokopi KTP Pemilik Usaha", "Fotokopi Kartu Keluarga", "Surat Pengantar RT/RW", "Foto Kegiatan Usaha"]),
      estimasiWaktu: 2,
      templateSurat: skuTemplate,
      isActive: true,
    },
  });

  // 4. SPK-01 (Surat Pengantar Administrasi Kependudukan)
  const spkTemplate = `<div style="max-width: 650px; margin: 0 auto; font-family: 'Times New Roman', Times, serif; color: #000; line-height: 1.6;">
  <div style="text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 24px;">
    <h3 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px;">PEMERINTAH KABUPATEN CIREBON</h3>
    <h4 style="margin: 2px 0; font-size: 16px; text-transform: uppercase;">KECAMATAN HARJAMUKTI - DESA PERUM</h4>
    <p style="margin: 0; font-size: 11px; color: #333;">Alamat: Jl. Flamboyan Raya No. 01, Desa Perum, Cirebon 45143 | Email: pelayanan@desa.id</p>
  </div>

  <div style="text-align: center; margin-bottom: 24px;">
    <h4 style="margin: 0; font-size: 16px; text-decoration: underline; text-transform: uppercase; letter-spacing: 0.5px;">SURAT PENGANTAR ADMINISTRASI KEPENDUDUKAN</h4>
    <p style="margin: 4px 0 0 0; font-size: 13px;">Nomor: <strong>{{nomor_surat}}</strong></p>
  </div>

  <p style="text-align: justify; margin-bottom: 16px; text-indent: 30px;">
    Yang bertanda tangan di bawah ini Kepala Desa Perum menerangkan bahwa warga di bawah ini bermaksud mengurus administrasi kependudukan di Kantor Kecamatan / Disdukcapil:
  </p>

  <table style="width: 100%; margin-left: 20px; margin-bottom: 16px; border-collapse: collapse; font-size: 14px;">
    <tr><td style="width: 160px; padding: 3px 0;">Nama Lengkap</td><td style="width: 15px;">:</td><td><strong>{{nama}}</strong></td></tr>
    <tr><td style="padding: 3px 0;">NIK</td><td>:</td><td>{{nik}}</td></tr>
    <tr><td style="padding: 3px 0;">Alamat Pemohon</td><td>:</td><td>{{alamat}}</td></tr>
    <tr><td style="padding: 3px 0;">Keperluan Pengurusan</td><td>:</td><td>{{keperluan}}</td></tr>
  </table>

  <p style="text-align: justify; margin-bottom: 16px; text-indent: 30px;">
    Orang yang bersangkutan adalah penduduk terdaftar di Desa Perum dan tidak memiliki catatan pelanggaran administrasi desa. Surat pengantar ini berlaku selama 30 (tiga puluh) hari sejak tanggal dikeluarkan.
  </p>

  <p style="text-align: justify; margin-bottom: 30px; text-indent: 30px;">
    Demikian Surat Pengantar ini diberikan agar dapat dipergunakan sebagaimana mestinya.
  </p>

  <div style="display: flex; justify-content: flex-end; margin-top: 40px;">
    <div style="text-align: center; width: 220px;">
      <p style="margin: 0 0 4px 0; font-size: 13px;">Desa Perum, {{tanggal}}</p>
      <p style="margin: 0 0 65px 0; font-weight: bold; font-size: 13px;">Kepala Desa Perum</p>
      <p style="margin: 0; font-weight: bold; text-decoration: underline; font-size: 13px;">( BAPAK KEPALA DESA )</p>
      <p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">NIP. 19750817 200212 1 003</p>
    </div>
  </div>
</div>`;

  await prisma.jenisLayanan.upsert({
    where: { kode: "SPK-01" },
    update: {
      templateSurat: spkTemplate,
      persyaratan: JSON.stringify(["Fotokopi Kartu Keluarga", "Fotokopi KTP / Akta Kelahiran", "Surat Pengantar RT/RW"]),
      estimasiWaktu: 2,
    },
    create: {
      kode: "SPK-01",
      nama: "Surat Pengantar Administrasi Kependudukan",
      deskripsi: "Surat pengantar resmi dari desa untuk pengurusan KTP, Kartu Keluarga baru/perubahan, Akta Kelahiran, atau perpindahan kependudukan di Disdukcapil.",
      persyaratan: JSON.stringify(["Fotokopi Kartu Keluarga", "Fotokopi KTP / Akta Kelahiran", "Surat Pengantar RT/RW"]),
      estimasiWaktu: 2,
      templateSurat: spkTemplate,
      isActive: true,
    },
  });

  console.log("Template surat resmi SKTM, SKD, SKU, dan SPK berhasil disiapkan!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
