import { DeepSeekProvider } from "./deepseek-provider";
import { GeminiProvider } from "./gemini-provider";
import { GroqProvider } from "./groq-provider";
import { OpenAiProvider } from "./openai-provider";
import { CustomAiProvider } from "./custom-provider";
import { loadCustomApiKeys, loadCoreProvidersStatus } from "./custom-keys";
import {
  AiMessage,
  AiProviderResponse,
  AiProviderType,
  IAiProvider,
  ProviderConnectionStatus,
} from "./types";

export interface AiProvider {
  generateResponse(query: string, systemPrompt: string): Promise<string>;
}

export class NvidiaProvider implements AiProvider {
  private openAiProvider = new OpenAiProvider();

  async generateResponse(query: string, systemPrompt: string): Promise<string> {
    const res = await this.openAiProvider.generateChat(
      [{ role: "user", content: query }],
      systemPrompt
    );
    return res.text;
  }
}

/**
 * Unified AI Service Manager
 * Supports multiple providers: Google Gemini & OpenAI (with NVIDIA NIM OpenAI-compatible fallback)
 */
export class AiService {
  private static geminiProvider: IAiProvider = new GeminiProvider();
  private static openAiProvider: IAiProvider = new OpenAiProvider();
  private static deepSeekProvider: IAiProvider = new DeepSeekProvider();
  private static groqProvider: IAiProvider = new GroqProvider();
  private static legacyProvider: AiProvider = new NvidiaProvider();

  /**
   * Resolve provider instance by type
   */
  static getProvider(type: AiProviderType = "openai"): IAiProvider {
    if (type === "gemini") {
      return this.geminiProvider;
    }
    if (type === "deepseek") {
      return this.deepSeekProvider;
    }
    if (type === "groq") {
      return this.groqProvider;
    }

    // Check if type matches custom key ID (e.g. "key_173000_abc")
    if (type.startsWith("key_") || type.startsWith("custom_")) {
      const customKeys = loadCustomApiKeys();
      const matched = customKeys.find((k) => k.id === type);
      if (matched) {
        return new CustomAiProvider(matched);
      }
    }

    return this.openAiProvider;
  }

  /**
   * Main multi-turn chat generation for chatbot
   */
  static async generateChat(
    messages: AiMessage[],
    systemPrompt: string,
    preferredProvider: AiProviderType = "openai"
  ): Promise<AiProviderResponse> {
    const provider = this.getProvider(preferredProvider);
    return provider.generateChat(messages, systemPrompt);
  }

  /**
   * Test live connection to a provider
   */
  static async testConnection(
    providerType: AiProviderType
  ): Promise<ProviderConnectionStatus> {
    const provider = this.getProvider(providerType);
    return provider.testConnection();
  }

  /**
   * Get metadata of available providers
   */
  static getAvailableProviders(): Array<{
    id: AiProviderType;
    name: string;
    model: string;
    isConfigured: boolean;
  }> {
    const coreStatus = loadCoreProvidersStatus();
    const list: Array<{
      id: AiProviderType;
      name: string;
      model: string;
      isConfigured: boolean;
    }> = [];

    if (coreStatus.openai !== false) {
      list.push({
        id: "openai",
        name: "OpenAI",
        model: process.env.OPENAI_API_KEY
          ? process.env.OPENAI_MODEL || "gpt-4o-mini"
          : "meta/llama-3.2-11b-vision-instruct",
        isConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY),
      });
    }

    if (coreStatus.gemini !== false) {
      list.push({
        id: "gemini",
        name: "Google Gemini",
        model: "gemini-3.5-flash",
        isConfigured: Boolean(process.env.GEMINI_API_KEY),
      });
    }

    if (coreStatus.deepseek !== false) {
      list.push({
        id: "deepseek",
        name: "DeepSeek",
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        isConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
      });
    }

    if (coreStatus.groq !== false) {
      list.push({
        id: "groq",
        name: "Groq",
        model: process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
        isConfigured: Boolean(process.env.GROQ_API_KEY),
      });
    }

    // Sertakan semua custom API Key yang ditambahkan oleh Supervisor
    const customKeys = loadCustomApiKeys().filter((k) => k.isActive !== false);
    for (const c of customKeys) {
      list.push({
        id: c.id,
        name: `${c.name} (${c.provider.toUpperCase()})`,
        model: c.model || "Custom Model",
        isConfigured: Boolean(c.apiKey),
      });
    }

    return list;
  }

  // --- Legacy Compatibility Methods ---
  static setProvider(provider: AiProvider) {
    this.legacyProvider = provider;
  }

  static async ask(query: string, systemPrompt: string): Promise<string> {
    return this.legacyProvider.generateResponse(query, systemPrompt);
  }
}
