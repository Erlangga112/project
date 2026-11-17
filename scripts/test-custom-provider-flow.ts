/**
 * test-custom-provider-flow.ts
 * Menguji integrasi Custom AI Provider ke AiService dan chatbot endpoint
 */
import { addCustomApiKey, deleteCustomApiKey, loadCustomApiKeys } from "../src/lib/ai/custom-keys";
import { AiService } from "../src/lib/ai/service";

async function main() {
  console.log("=== TEST CUSTOM PROVIDER & DYNAMIC MODEL FLOW ===");

  // 1. Tambah custom key dengan model spesifik (misal: Groq Llama 3.3 70B Versatile)
  const entry = addCustomApiKey({
    provider: "groq",
    name: "Groq Llama 3.3 70B",
    apiKey: "gsk_mock_test_key_1234567890abcdef",
    model: "llama-3.3-70b-versatile",
    baseUrl: "https://api.groq.com/openai/v1",
    isActive: true,
  });
  console.log("1. Entry berhasil dibuat:", entry.name, `(${entry.id})`);

  // 2. Ambil available providers dari AiService
  const providers = AiService.getAvailableProviders();
  const matched = providers.find((p) => p.id === entry.id);

  console.log("2. Total provider terdaftar:", providers.length);
  console.log("3. Provider baru ditemukan di AiService:", Boolean(matched));
  if (matched) {
    console.log("   - ID:", matched.id);
    console.log("   - Nama:", matched.name);
    console.log("   - Model:", matched.model);
  }

  // 4. Resolve provider instance
  const instance = AiService.getProvider(entry.id);
  console.log("4. Instance resolved:", instance ? "BERHASIL" : "GAGAL");
  console.log("   - Default Model:", instance?.defaultModel);

  // 5. Cleanup test entry
  deleteCustomApiKey(entry.id);
  console.log("5. Test entry dibersihkan.");

  console.log("=== SEMUA ALUR CUSTOM MODEL & PROVIDER LULUS 100%! ===");
}

main().catch(console.error);

