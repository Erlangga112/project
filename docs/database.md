# Struktur Database Sistem Pelayanan Desa

Berikut adalah dokumentasi mengenai struktur database (berbasis Prisma ORM) yang disiapkan untuk aplikasi Sistem Pelayanan Desa Perum.

## Daftar Tabel / Model

### 1. Model `User`
Digunakan untuk keperluan autentikasi dan menyimpan role pengguna.
- `id` (CUID)
- `name` (String, opsional)
- `email` (String, unique)
- `password` (String, di-hash menggunakan bcrypt)
- `role` (Enum `Role`: `WARGA`, `STAF_DESA`, `SUPERVISOR`, `KEPALA_DESA`)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

### 2. Model `ProfilWarga`
Menyimpan profil detail untuk pengguna dengan role `WARGA`. Memiliki relasi one-to-one dengan model `User`.
- `id` (CUID)
- `userId` (String, relasi ke `User`)
- `nik` (String, unique, di-index)
- `noKk` (String, di-index)
- `namaLengkap` (String, di-index)
- `tempatLahir` (String)
- `tanggalLahir` (DateTime)
- `alamat` (Text)
- `rt` / `rw` (String, max 5 karakter)
- `noTelepon` (String, opsional)
- `status` (Enum `StatusWarga`: `AKTIF`, `PINDAH`, `MENINGGAL`)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

### 3. Model `JenisLayanan`
Menyimpan master data untuk jenis-jenis pelayanan/surat yang dapat diajukan (contoh: Surat Keterangan Domisili, Surat Keterangan Tidak Mampu, dll).
- `id` (CUID)
- `nama` (String)
- `deskripsi` (Text, opsional)
- `syaratLayanan` (Text JSON Array, menyimpan syarat-syarat dokumen yang dibutuhkan)
- `isActive` (Boolean, default true)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

### 4. Model `PengajuanLayanan`
Menyimpan log atau histori pengajuan yang dilakukan oleh warga.
- `id` (CUID)
- `pemohonId` (String, relasi ke `User` warga yang mengajukan, di-index)
- `jenisLayananId` (String, relasi ke `JenisLayanan`, di-index)
- `status` (Enum `StatusPengajuan`: `MENUNGGU`, `DIPROSES`, `SELESAI`, `DITOLAK`, di-index)
- `catatan` (Text, catatan dari staf/kades terkait pengajuan)
- `dokumenPendukung` (Text JSON, URL/path dari dokumen yang diunggah pemohon)
- `diprosesOlehId` (String, relasi ke `User` staf/kades yang melakukan persetujuan)
- `tanggalPengajuan` (DateTime)
- `tanggalSelesai` (DateTime, ketika status menjadi SELESAI/DITOLAK)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

### Model Pendukung (NextAuth)
- `Account`: Konfigurasi provider login eksternal (OAuth).
- `Session`: Token session.
- `VerificationToken`: Token keamanan standar.

## Indexing & Keamanan
- **Index**: Telah ditambahkan index pada field `nik`, `noKk`, `namaLengkap` di profil warga, dan `pemohonId`, `status`, `jenisLayananId` pada pengajuan untuk mempercepat operasi read.
- **Passwords**: Password pada tabel `User` tidak pernah disimpan dalam plaintext. Saat proses seeding/registrasi, digunakan hashing bcrypt.
- **Relasi**: Dikonfigurasikan menggunakan `onDelete: Cascade` pada parent (seperti User ke ProfilWarga) untuk mencegah database orphaned data.
