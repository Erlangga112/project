import {
  AiMessage,
  AiProviderResponse,
  AiProviderType,
  IAiProvider,
  ProviderConnectionStatus,
} from "./types";
import { CustomApiKeyEntry } from "./custom-keys";

/**
 * Custom AI Provider yang dibuat secara dinamis dari API Key / Model yang ditambahkan oleh Supervisor.
 * Menggunakan format OpenAI-compatible API (digunakan oleh Groq, OpenAI, DeepSeek, Together, OpenRouter, vLLM, Ollama, dll.)
 */
export class CustomAiProvider implements IAiProvider {
  readonly providerType: AiProviderType = "custom";
  readonly config: CustomApiKeyEntry;

  constructor(config: CustomApiKeyEntry) {
    this.config = config;
  }

  get defaultModel(): string {
    return this.config.model?.trim() || "default-model";
  }

  private get apiUrl(): string {
    if (this.config.baseUrl && this.config.baseUrl.trim()) {
      const base = this.config.baseUrl.trim().replace(/\/+$/, "");
      if (base.endsWith("/chat/completions")) {
        return base;
      }
      return `${base}/chat/completions`;
    }

    // Default URL berdasarkan provider template
    if (this.config.provider === "groq") {
      return "https://api.groq.com/openai/v1/chat/completions";
    }
    if (this.config.provider === "deepseek") {
      return "https://api.deepseek.com/chat/completions";
    }
    if (this.config.provider === "gemini") {
      return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    }
    return "https://api.openai.com/v1/chat/completions";
  }

  private get apiKey(): string {
    return this.config.apiKey.trim();
  }

  private sanitizeError(raw: string): string {
    const key = this.apiKey;
    if (!key) return raw;
    return raw.split(key).join("******");
  }

  async generateChat(
    messages: AiMessage[],
    systemPrompt: string
  ): Promise<AiProviderResponse> {
    const startTime = performance.now();

    if (!this.apiKey) {
      return {
        text: `⚠️ API Key untuk "${this.config.name}" belum disetel.`,
        provider: this.providerType,
        model: this.defaultModel,
        status: "error",
        error: "API_KEY_MISSING",
        durationMs: 0,
      };
    }

    const formattedMessages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      formattedMessages.push({ role: "system", content: systemPrompt });
    }
    for (const m of messages) {
      formattedMessages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      });
    }

    try {
      const res = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages: formattedMessages,
          temperature: 0.3,
          max_tokens: 1024,
        }),
      });

      const durationMs = Math.round(performance.now() - startTime);

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[${this.config.name}] Error HTTP ${res.status}:`, this.sanitizeError(errorText));
        return {
          text: `⚠️ Terjadi kendala saat menghubungi provider ${this.config.name} (HTTP ${res.status}).`,
          provider: this.providerType,
          model: this.defaultModel,
          status: "error",
          error: `HTTP_${res.status}`,
          durationMs,
        };
      }

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content?.trim() || "";

      return {
        text: reply,
        provider: this.providerType,
        model: data?.model || this.defaultModel,
        status: "success",
        durationMs,
      };
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      return {
        text: `⚠️ Gagal terhubung ke provider ${this.config.name}: ${err?.message || "Koneksi timeout"}`,
        provider: this.providerType,
        model: this.defaultModel,
        status: "error",
        error: "FETCH_ERROR",
        durationMs,
      };
    }
  }

  async testConnection(): Promise<ProviderConnectionStatus> {
    const startTime = performance.now();
    try {
      if (!this.apiKey) {
        return {
          ok: false,
          provider: this.providerType,
          name: this.config.name,
          model: this.defaultModel,
          message: "API Key belum diisi",
        };
      }

      const res = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5,
        }),
      });

      const latencyMs = Math.round(performance.now() - startTime);
      if (res.ok) {
        return {
          ok: true,
          provider: this.providerType,
          name: this.config.name,
          model: this.defaultModel,
          message: `Terhubung aktif (${latencyMs}ms)`,
          latencyMs,
        };
      }

      const errText = await res.text();
      return {
        ok: false,
        provider: this.providerType,
        name: this.config.name,
        model: this.defaultModel,
        message: `HTTP ${res.status}: ${this.sanitizeError(errText).slice(0, 100)}`,
        latencyMs,
      };
    } catch (err: any) {
      return {
        ok: false,
        provider: this.providerType,
        name: this.config.name,
        model: this.defaultModel,
        message: err?.message || "Koneksi gagal",
      };
    }
  }
}

