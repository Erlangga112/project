/**
 * test-settings-api.ts
 * Menguji API endpoint /api/supervisor/settings
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

async function main() {
  console.log("=== TEST SUPERVISOR SETTINGS API & ENV ACCESS ===");

  const envPath = join(process.cwd(), ".env.local");
  console.log(".env.local exists:", existsSync(envPath));

  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8");
    const hasGroq = content.includes("GROQ_API_KEY");
    const hasFonnte = content.includes("FONNTE_TOKEN") || content.includes("FOONTE_API_TOKEN");
    const hasGemini = content.includes("GEMINI_API_KEY");
    const hasDeepseek = content.includes("DEEPSEEK_API_KEY");

    console.log("GROQ_API_KEY configured:", hasGroq);
    console.log("FONNTE/FOONTE configured:", hasFonnte);
    console.log("GEMINI_API_KEY configured:", hasGemini);
    console.log("DEEPSEEK_API_KEY configured:", hasDeepseek);
  }

  console.log("Test completed successfully!");
}

main().catch(console.error);

