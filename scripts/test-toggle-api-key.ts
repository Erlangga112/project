/**
 * test-toggle-api-key.ts
 * Pengujian fungsionalitas menyalakan (aktif) dan menonaktifkan (mati) API Key
 */
import {
  loadCustomApiKeys,
  addCustomApiKey,
  deleteCustomApiKey,
  toggleCustomApiKeyStatus,
} from "../src/lib/ai/custom-keys";
import { AiService } from "../src/lib/ai/service";

async function main() {
  console.log("=== TEST TOGGLE API KEY (NYALAKAN / NONAKTIFKAN) ===");

  // 1. Buat API key uji
  const key = addCustomApiKey({
    provider: "groq",
    name: "Toggle Test Key",
    apiKey: "gsk_test_toggle_12345",
    model: "llama-3.3-70b-versatile",
    isActive: true,
  });
  console.log("1. Key dibuat dengan isActive = true");

  // 2. Periksa apakah muncul di daftar provider aktif
  let providers = AiService.getAvailableProviders();
  let found = providers.some((p) => p.id === key.id);
  console.log("2. Key muncul di provider aktif Chatbot:", found);
  if (!found) throw new Error("Key harusnya muncul saat aktif!");

  // 3. Matikan (Nonaktifkan) Key
  toggleCustomApiKeyStatus(key.id, false);
  console.log("3. Status diubah menjadi isActive = false");

  // 4. Periksa apakah key HILANG dari daftar provider aktif Chatbot
  providers = AiService.getAvailableProviders();
  found = providers.some((p) => p.id === key.id);
  console.log("4. Key hilang dari provider aktif Chatbot saat dimatikan:", !found);
  if (found) throw new Error("Key yang nonaktif tidak boleh muncul di Chatbot!");

  // 5. Nyalakan kembali Key
  toggleCustomApiKeyStatus(key.id, true);
  console.log("5. Status diubah kembali menjadi isActive = true");

  providers = AiService.getAvailableProviders();
  found = providers.some((p) => p.id === key.id);
  console.log("6. Key kembali muncul di provider aktif Chatbot saat dinyalakan:", found);
  if (!found) throw new Error("Key harusnya muncul kembali saat dinyalakan!");

  // Cleanup
  deleteCustomApiKey(key.id);
  console.log("7. Data uji dibersihkan.");

  console.log("=== SEMUA TEST TOGGLE AKTIF/NONAKTIF LULUS 100%! ===");
}

main().catch(console.error);

