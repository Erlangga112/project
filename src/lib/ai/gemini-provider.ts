import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  AiMessage,
  AiProviderResponse,
  IAiProvider,
  ProviderConnectionStatus,
} from "./types";

export class GeminiProvider implements IAiProvider {
  readonly providerType = "gemini" as const;
  readonly defaultModel = "gemini-3.5-flash";
  private readonly fallbackModel = "gemini-3.5-flash-lite";

  private getClient(): GoogleGenerativeAI {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY_NOT_CONFIGURED");
    }
    return new GoogleGenerativeAI(apiKey);
  }

  /**
   * Helper to format error into user-friendly Indonesian messages
   */
  private parseGeminiError(err: unknown): { message: string; category: string } {
    const errString = err instanceof Error ? err.message : String(err);
    const lower = errString.toLowerCase();

    if (lower.includes("not_configured") || !process.env.GEMINI_API_KEY) {
      return {
        message:
          "⚠️ API Key Google Gemini belum dikonfigurasi di server. Silakan hubungi administrator sistem.",
        category: "API_KEY_MISSING",
      };
    }
    if (
      lower.includes("api_key_invalid") ||
      lower.includes("api key not valid") ||
      lower.includes("invalid api key") ||
      lower.includes("unauthenticated")
    ) {
      return {
        message:
          "⚠️ Kunci API Google Gemini tidak valid atau izin ditolak. Periksa kembali konfigurasi GEMINI_API_KEY di server.",
        category: "INVALID_API_KEY",
      };
    }
    if (
      lower.includes("resource_exhausted") ||
      lower.includes("quota") ||
      lower.includes("rate limit") ||
      lower.includes("429") ||
      lower.includes("high demand")
    ) {
      return {
        message:
          "⏳ Batas kuota atau batas frekuensi permintaan Google Gemini sedang tercapai. Silakan coba lagi beberapa saat lagi atau beralih ke provider OpenAI.",
        category: "QUOTA_EXHAUSTED",
      };
    }
    if (lower.includes("not found") || lower.includes("404")) {
      return {
        message:
          "⚠️ Model Google Gemini yang dipilih tidak tersedia untuk project API ini. Sistem akan beralih ke model cadangan.",
        category: "MODEL_NOT_FOUND",
      };
    }
    if (
      lower.includes("econnrefused") ||
      lower.includes("etimedout") ||
      lower.includes("fetch failed") ||
      lower.includes("abort") ||
      lower.includes("network")
    ) {
      return {
        message:
          "📡 Gagal terhubung ke server Google Gemini. Periksa koneksi jaringan server.",
        category: "CONNECTION_FAILED",
      };
    }

    return {
      message:
        "⚠️ Terjadi kendala saat memproses permintaan melalui Google Gemini. Silakan coba lagi.",
      category: "UNKNOWN_GEMINI_ERROR",
    };
  }

  /**
   * Formats chat messages into Gemini contents structure
   * Enforces alternating user/model roles required by Gemini API
   */
  private formatContents(messages: AiMessage[]) {
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    // Filter out system messages (handled via systemInstruction)
    const chatOnly = messages.filter((m) => m.role !== "system");

    for (const msg of chatOnly) {
      const geminiRole = msg.role === "assistant" ? ("model" as const) : ("user" as const);
      const text = msg.content?.trim() || "";
      if (!text) continue;

      // Ensure no two consecutive messages have the same role
      const prev = contents[contents.length - 1];
      if (prev && prev.role === geminiRole) {
        prev.parts[0].text += `\n\n${text}`;
      } else {
        contents.push({
          role: geminiRole,
          parts: [{ text }],
        });
      }
    }

    // Ensure the last message is from 'user'
    if (contents.length > 0 && contents[contents.length - 1].role !== "user") {
      // If the last message is model, append a user prompt so Gemini can respond
      contents.push({
        role: "user",
        parts: [{ text: "Lanjutkan penjelasan Anda." }],
      });
    }

    return contents;
  }

  async generateChat(
    messages: AiMessage[],
    systemPrompt: string
  ): Promise<AiProviderResponse> {
    const startTime = performance.now();

    if (!process.env.GEMINI_API_KEY) {
      const err = this.parseGeminiError(new Error("GEMINI_API_KEY_NOT_CONFIGURED"));
      return {
        text: err.message,
        provider: this.providerType,
        model: this.defaultModel,
        status: "error",
        error: err.category,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    const contents = this.formatContents(messages);
    if (contents.length === 0) {
      return {
        text: "Pesan tidak boleh kosong.",
        provider: this.providerType,
        model: this.defaultModel,
        status: "error",
        error: "EMPTY_MESSAGES",
        durationMs: 0,
      };
    }

    const modelsToTry = [this.defaultModel, this.fallbackModel, "gemini-3.8-flash"];
    let lastError: unknown = null;

    for (const modelName of modelsToTry) {
      try {
        const client = this.getClient();
        const model = client.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt || undefined,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
          },
        });

        const result = await model.generateContent({ contents });
        const responseText = result.response?.text();

        if (responseText && responseText.trim().length > 0) {
          return {
            text: responseText.trim(),
            provider: this.providerType,
            model: modelName,
            status: "success",
            durationMs: Math.round(performance.now() - startTime),
          };
        } else {
          throw new Error("EMPTY_GEMINI_RESPONSE");
        }
      } catch (err) {
        lastError = err;
        // If it's a quota or temporary model issue, continue to fallback model
        continue;
      }
    }

    const parsed = this.parseGeminiError(lastError);
    return {
      text: parsed.message,
      provider: this.providerType,
      model: this.defaultModel,
      status: "error",
      error: parsed.category,
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  async testConnection(): Promise<ProviderConnectionStatus> {
    const start = performance.now();

    if (!process.env.GEMINI_API_KEY) {
      return {
        ok: false,
        provider: this.providerType,
        name: "Google Gemini",
        model: this.defaultModel,
        message: "API Key belum dikonfigurasi pada server.",
        latencyMs: 0,
      };
    }

    const modelsToTest = [this.defaultModel, this.fallbackModel];

    for (const modelName of modelsToTest) {
      try {
        const client = this.getClient();
        const model = client.getGenerativeModel({ model: modelName });
        const res = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: "ping" }] }],
        });
        const text = res.response?.text();
        if (text) {
          return {
            ok: true,
            provider: this.providerType,
            name: "Google Gemini",
            model: modelName,
            message: `Terhubung aktif ke ${modelName}`,
            latencyMs: Math.round(performance.now() - start),
          };
        }
      } catch (err) {
        // Try fallback
        continue;
      }
    }

    return {
      ok: false,
      provider: this.providerType,
      name: "Google Gemini",
      model: this.defaultModel,
      message: "Gagal terhubung ke model Gemini.",
      latencyMs: Math.round(performance.now() - start),
    };
  }
}

