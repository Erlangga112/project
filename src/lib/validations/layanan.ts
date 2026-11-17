import { z } from "zod";

export const jenisLayananSchema = z.object({
  kode: z.string().min(1, "Kode layanan wajib diisi").max(20),
  nama: z.string().min(3, "Nama layanan minimal 3 karakter"),
  deskripsi: z.string().optional(),
  persyaratan: z.array(z.string().min(1, "Persyaratan tidak boleh kosong")).min(1, "Minimal harus ada 1 persyaratan"),
  estimasiWaktu: z.number().min(1, "Estimasi waktu minimal 1 hari"),
  templateSurat: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type JenisLayananPayload = z.infer<typeof jenisLayananSchema>;
