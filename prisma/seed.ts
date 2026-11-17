import 'dotenv/config'
import { Role, StatusWarga } from '@prisma/client'
import bcrypt from 'bcryptjs'

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  // Clean existing data
  await prisma.pengajuanLayanan.deleteMany()
  await prisma.jenisLayanan.deleteMany()
  await prisma.profilWarga.deleteMany()
  await prisma.user.deleteMany()

  const passwordHash = await bcrypt.hash('password123', 10)

  // 1. Create Kepala Desa
  const kades = await prisma.user.create({
    data: {
      nama: 'Bapak Kepala Desa',
      email: 'kades@desa.id',
      password: passwordHash,
      role: Role.KEPALA_DESA,
    },
  })
  console.log(`Created Kepala Desa: ${kades.email}`)

  // 2. Create Supervisor
  const supervisor = await prisma.user.create({
    data: {
      nama: 'Bapak Supervisor',
      email: 'supervisor@desa.id',
      password: passwordHash,
      role: Role.SUPERVISOR,
    },
  })
  console.log(`Created Supervisor: ${supervisor.email}`)

  // 3. Create Staf Desa
  const staf = await prisma.user.create({
    data: {
      nama: 'Admin Staf Desa',
      email: 'staf@desa.id',
      password: passwordHash,
      role: Role.STAF_DESA,
    },
  })
  console.log(`Created Staf Desa: ${staf.email}`)

  // 4. Create Warga 1 (Aktif)
  const warga1 = await prisma.user.create({
    data: {
      nama: 'Budi Santoso',
      email: 'budi@warga.id',
      password: passwordHash,
      role: Role.WARGA,
      profilWarga: {
        create: {
          nik: '3201010101900001',
          noKk: '3201010101900000',
          namaLengkap: 'Budi Santoso',
          tempatLahir: 'Bandung',
          tanggalLahir: new Date('1990-01-01'),
          alamat: 'Jl. Merdeka No. 1, Desa Makmur',
          rt: '001',
          rw: '002',
          noTelepon: '081234567890',
          status: StatusWarga.AKTIF,
        },
      },
    },
  })
  console.log(`Created Warga 1: ${warga1.email}`)

  // 5. Create Warga 2 (Pindah)
  const warga2 = await prisma.user.create({
    data: {
      nama: 'Siti Aminah',
      email: 'siti@warga.id',
      password: passwordHash,
      role: Role.WARGA,
      profilWarga: {
        create: {
          nik: '3201010101920002',
          noKk: '3201010101920000',
          namaLengkap: 'Siti Aminah',
          tempatLahir: 'Jakarta',
          tanggalLahir: new Date('1992-02-02'),
          alamat: 'Jl. Mawar No. 5, Desa Makmur',
          rt: '003',
          rw: '002',
          noTelepon: '081987654321',
          status: StatusWarga.PINDAH,
        },
      },
    },
  })
  console.log(`Created Warga 2: ${warga2.email}`)

  // 6. Create Default Jenis Layanan
  const layanan1 = await prisma.jenisLayanan.upsert({
    where: { kode: 'SKU-01' },
    update: {},
    create: {
      kode: 'SKU-01',
      nama: 'Surat Keterangan Usaha (SKU)',
      deskripsi: 'Surat pengantar dari desa untuk pembuatan izin usaha.',
      persyaratan: JSON.stringify(['Fotokopi KTP', 'Fotokopi KK', 'Surat Pengantar RT/RW']),
      estimasiWaktu: 2,
      templateSurat: `<div style="text-align: center; font-family: 'Times New Roman', serif;">
  <h3>PEMERINTAH KABUPATEN DEMO</h3>
  <h4>KECAMATAN CONTOH, DESA MAKMUR</h4>
  <hr style="border-top: 3px solid black; border-bottom: 1px solid black; height: 2px; margin-bottom: 20px;" />
  <h4 style="text-decoration: underline; margin-bottom: 0;">SURAT KETERANGAN USAHA</h4>
  <p style="margin-top: 0;">Nomor: {{nomor_surat}}</p>
</div>
<div style="font-family: 'Times New Roman', serif; text-align: justify; line-height: 1.5; margin-top: 30px;">
  <p>Yang bertanda tangan di bawah ini Kepala Desa Makmur, menerangkan dengan sesungguhnya bahwa:</p>
  <table style="margin-left: 20px; margin-bottom: 20px;">
    <tr><td width="150">Nama</td><td>: <strong>{{nama}}</strong></td></tr>
    <tr><td>NIK</td><td>: {{nik}}</td></tr>
    <tr><td>Alamat</td><td>: {{alamat}}</td></tr>
  </table>
  <p>Orang tersebut di atas benar-benar memiliki usaha dan berdomisili di Desa Makmur pada saat surat ini dikeluarkan.</p>
  <p>Demikian surat keterangan ini dibuat agar dapat dipergunakan sebagaimana mestinya.</p>
  <div style="margin-top: 50px; text-align: right;">
    <p>Desa Makmur, {{tanggal}}</p>
    <p style="margin-bottom: 60px;">Kepala Desa Makmur</p>
    <p><strong>( ______________________ )</strong></p>
  </div>
</div>`
    }
  })

  const layanan2 = await prisma.jenisLayanan.upsert({
    where: { kode: 'SKTM-01' },
    update: {},
    create: {
      kode: 'SKTM-01',
      nama: 'Surat Keterangan Tidak Mampu (SKTM)',
      deskripsi: 'Surat keterangan bagi warga kurang mampu.',
      persyaratan: JSON.stringify(['Fotokopi KTP', 'Fotokopi KK', 'Surat Pengantar RT/RW', 'Foto Rumah']),
      estimasiWaktu: 3,
      templateSurat: `<div style="text-align: center; font-family: 'Times New Roman', serif;">
  <h3>PEMERINTAH KABUPATEN DEMO</h3>
  <h4>KECAMATAN CONTOH, DESA MAKMUR</h4>
  <hr style="border-top: 3px solid black; border-bottom: 1px solid black; height: 2px; margin-bottom: 20px;" />
  <h4 style="text-decoration: underline; margin-bottom: 0;">SURAT KETERANGAN TIDAK MAMPU</h4>
  <p style="margin-top: 0;">Nomor: {{nomor_surat}}</p>
</div>
<div style="font-family: 'Times New Roman', serif; text-align: justify; line-height: 1.5; margin-top: 30px;">
  <p>Yang bertanda tangan di bawah ini Kepala Desa Makmur, menerangkan dengan sesungguhnya bahwa:</p>
  <table style="margin-left: 20px; margin-bottom: 20px;">
    <tr><td width="150">Nama</td><td>: <strong>{{nama}}</strong></td></tr>
    <tr><td>NIK</td><td>: {{nik}}</td></tr>
    <tr><td>Alamat</td><td>: {{alamat}}</td></tr>
  </table>
  <p>Orang tersebut di atas benar-benar adalah warga yang berdomisili di Desa Makmur dan tergolong keluarga kurang mampu.</p>
  <p>Demikian surat keterangan ini dibuat agar dapat dipergunakan sebagaimana mestinya.</p>
  <div style="margin-top: 50px; text-align: right;">
    <p>Desa Makmur, {{tanggal}}</p>
    <p style="margin-bottom: 60px;">Kepala Desa Makmur</p>
    <p><strong>( ______________________ )</strong></p>
  </div>
</div>`
    }
  })
  
  console.log('Created Jenis Layanan')

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
