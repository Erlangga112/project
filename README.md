# Sistem Pelayanan Desa Perum

Sistem informasi dan pelayanan untuk warga Desa Perum, Kota Cirebon.

## Tech Stack
- Frontend: Next.js + TypeScript
- UI: Tailwind CSS
- Backend/API: Next.js API Routes
- Database: PostgreSQL
- ORM: Prisma
- Authentication: NextAuth.js
- Validation: Zod

## Prasyarat
- Node.js (v18+)
- PostgreSQL yang berjalan

## Cara Menjalankan Project

1. **Clone repository ini** (jika belum).
2. **Install dependensi**:
   ```bash
   npm install
   ```
3. **Konfigurasi Environment**:
   - Atur `.env` (pastikan file `.env` sudah sesuai).
   - Ubah `DATABASE_URL` sesuai dengan kredensial PostgreSQL Anda.
   - Ubah `NEXTAUTH_SECRET` untuk production.

4. **Migrasi Database**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```
   Atau jika menggunakan migrate:
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Jalankan Server Development**:
   ```bash
   npm run dev
   ```
6. Buka [http://localhost:3000](http://localhost:3000) di browser.

## Struktur Project

- `/src/app`: Konfigurasi Next.js App Router (Pages, Layouts, API Routes).
- `/src/app/(auth)`: Rute untuk autentikasi (login, register).
- `/src/app/(dashboard)`: Rute untuk halaman dashboard tiap role (warga, staf, supervisor, kades).
- `/src/components`: Komponen UI modular yang dapat digunakan ulang.
- `/src/lib`: Utility functions, instance Prisma.
- `/src/types`: Definisi global type untuk TypeScript.
- `/prisma`: Skema database Prisma.
