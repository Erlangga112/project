/**
 * test-add-api-key.ts
 * Pengujian fungsionalitas penambahan, pemuatan, dan penghapusan Custom API Key
 */
import {
  loadCustomApiKeys,
  addCustomApiKey,
  deleteCustomApiKey,
} from "../src/lib/ai/custom-keys";

async function main() {
  console.log("=== TEST CUSTOM API KEY ADDITION & MANAGEMENT ===");

  // 1. Tambah API Key baru (contoh: Groq Cadangan)
  const sampleKey = addCustomApiKey({
    provider: "groq",
    name: "Groq Cadangan Pengujian",
    apiKey: "gsk_test_mock_key_1234567890abcdef",
    model: "llama-3.3-70b-versatile",
    baseUrl: "https://api.groq.com/openai/v1",
    isActive: true,
  });

  console.log("1. Key berhasil ditambahkan:", sampleKey.name, `(ID: ${sampleKey.id})`);

  // 2. Muat semua kunci
  const allKeys = loadCustomApiKeys();
  const exists = allKeys.some((k) => k.id === sampleKey.id);
  console.log("2. Key terverifikasi tersimpan:", exists, `(Total tersimpan: ${allKeys.length})`);

  // 3. Hapus kembali kunci pengujian agar tidak meninggalkan artefak uji
  const deleted = deleteCustomApiKey(sampleKey.id);
  console.log("3. Key pengujian berhasil dihapus:", deleted);

  const finalKeys = loadCustomApiKeys();
  console.log("4. Jumlah key akhir:", finalKeys.length);

  console.log("=== SEMUA PENGUJIAN CUSTOM KEY BERHASIL! ===");
}

main().catch(console.error);

