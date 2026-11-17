import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export interface CustomApiKeyEntry {
  id: string; // unique identifier e.g. "key_1700000000"
  provider: "openai" | "gemini" | "deepseek" | "groq" | "custom";
  name: string; // e.g. "Groq Backup Key", "OpenAI Secondary"
  apiKey: string; // the actual raw key
  baseUrl?: string;
  model?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CoreProvidersStatus {
  openai: boolean;
  gemini: boolean;
  deepseek: boolean;
  groq: boolean;
}

const CORE_STATUS_PATH = join(process.cwd(), ".core-providers-status.json");

export function loadCoreProvidersStatus(): CoreProvidersStatus {
  const defaultStatus: CoreProvidersStatus = {
    openai: true,
    gemini: true,
    deepseek: true,
    groq: true,
  };
  try {
    if (!existsSync(CORE_STATUS_PATH)) {
      return defaultStatus;
    }
    const raw = readFileSync(CORE_STATUS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      openai: typeof parsed?.openai === "boolean" ? parsed.openai : true,
      gemini: typeof parsed?.gemini === "boolean" ? parsed.gemini : true,
      deepseek: typeof parsed?.deepseek === "boolean" ? parsed.deepseek : true,
      groq: typeof parsed?.groq === "boolean" ? parsed.groq : true,
    };
  } catch (err) {
    console.error("Gagal membaca .core-providers-status.json:", err);
    return defaultStatus;
  }
}

export function saveCoreProvidersStatus(status: CoreProvidersStatus): void {
  try {
    writeFileSync(CORE_STATUS_PATH, JSON.stringify(status, null, 2), "utf-8");
  } catch (err) {
    console.error("Gagal menyimpan .core-providers-status.json:", err);
    throw err;
  }
}

export function toggleCoreProviderStatus(provider: "openai" | "gemini" | "deepseek" | "groq", isActive: boolean): CoreProvidersStatus {
  const current = loadCoreProvidersStatus();
  current[provider] = isActive;
  saveCoreProvidersStatus(current);
  return current;
}

const STORAGE_PATH = join(process.cwd(), ".custom-ai-keys.json");

export function loadCustomApiKeys(): CustomApiKeyEntry[] {
  try {
    if (!existsSync(STORAGE_PATH)) {
      return [];
    }
    const raw = readFileSync(STORAGE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Gagal membaca .custom-ai-keys.json:", err);
    return [];
  }
}

export function saveCustomApiKeys(keys: CustomApiKeyEntry[]): void {
  try {
    writeFileSync(STORAGE_PATH, JSON.stringify(keys, null, 2), "utf-8");
  } catch (err) {
    console.error("Gagal menyimpan .custom-ai-keys.json:", err);
    throw err;
  }
}

export function addCustomApiKey(entry: Omit<CustomApiKeyEntry, "id" | "createdAt">): CustomApiKeyEntry {
  const keys = loadCustomApiKeys();
  const newEntry: CustomApiKeyEntry = {
    ...entry,
    id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  keys.push(newEntry);
  saveCustomApiKeys(keys);
  return newEntry;
}

export function deleteCustomApiKey(id: string): boolean {
  const keys = loadCustomApiKeys();
  const filtered = keys.filter((k) => k.id !== id);
  if (filtered.length !== keys.length) {
    saveCustomApiKeys(filtered);
    return true;
  }
  return false;
}

export function toggleCustomApiKeyStatus(id: string, isActive: boolean): boolean {
  const keys = loadCustomApiKeys();
  const target = keys.find((k) => k.id !== id);
  const found = keys.find((k) => k.id === id);
  if (found) {
    found.isActive = isActive;
    saveCustomApiKeys(keys);
    return true;
  }
  return false;
}

