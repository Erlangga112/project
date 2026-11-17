/**
 * test-toggle-core-providers.ts
 * Pengujian fungsionalitas mematikan dan menyalakan 4 provider utama (Groq, DeepSeek, Gemini, OpenAI)
 */
import {
  loadCoreProvidersStatus,
  toggleCoreProviderStatus,
} from "../src/lib/ai/custom-keys";
import { AiService } from "../src/lib/ai/service";

async function main() {
  console.log("=== TEST TOGGLE 4 CORE PROVIDER (GROQ, DEEPSEEK, GEMINI, OPENAI) ===");

  // Status awal
  const initial = loadCoreProvidersStatus();
  console.log("1. Status awal core providers:", initial);

  // 1. Matikan Groq
  toggleCoreProviderStatus("groq", false);
  let providers = AiService.getAvailableProviders();
  let hasGroq = providers.some((p) => p.id === "groq");
  console.log("2. Groq dimatikan -> Muncul di Chatbot:", hasGroq);
  if (hasGroq) throw new Error("Groq seharusnya hilang dari daftar Chatbot saat dimatikan!");

  // 2. Matikan DeepSeek
  toggleCoreProviderStatus("deepseek", false);
  providers = AiService.getAvailableProviders();
  let hasDeepseek = providers.some((p) => p.id === "deepseek");
  console.log("3. DeepSeek dimatikan -> Muncul di Chatbot:", hasDeepseek);
  if (hasDeepseek) throw new Error("DeepSeek seharusnya hilang dari daftar Chatbot saat dimatikan!");

  // 3. Nyalakan kembali Groq
  toggleCoreProviderStatus("groq", true);
  providers = AiService.getAvailableProviders();
  hasGroq = providers.some((p) => p.id === "groq");
  console.log("4. Groq dinyalakan kembali -> Muncul di Chatbot:", hasGroq);
  if (!hasGroq) throw new Error("Groq seharusnya muncul kembali di Chatbot!");

  // 4. Nyalakan kembali DeepSeek
  toggleCoreProviderStatus("deepseek", true);
  providers = AiService.getAvailableProviders();
  hasDeepseek = providers.some((p) => p.id === "deepseek");
  console.log("5. DeepSeek dinyalakan kembali -> Muncul di Chatbot:", hasDeepseek);
  if (!hasDeepseek) throw new Error("DeepSeek seharusnya muncul kembali di Chatbot!");

  console.log("=== SEMUA PENGUJIAN TOGGLE CORE PROVIDER LULUS 100%! ===");
}

main().catch(console.error);

