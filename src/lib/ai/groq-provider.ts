import {
  AiMessage,
  AiProviderResponse,
  IAiProvider,
  ProviderConnectionStatus,
} from "./types";

/**
 * Groq AI Provider Implementation
 * Menggunakan API resmi Groq (https://api.groq.com/openai/v1) dengan model qwen/qwen3.8-27b
 */
export class GroqProvider implements IAiProvider {
  readonly providerType = "groq" as const;

  get defaultModel(): string {
    return process.env.GROQ_MODEL?.trim() || "qwen/qwen3.8-27b";
  }

  private get apiUrl(): string {
    const baseUrl = (
      process.env.GROQ_BASE_URL?.trim() || "https://api.groq.com/openai/v1"
    ).replace(/\/+$/, "");
    return `${baseUrl}/chat/completions`;
  }

  private get apiKey(): string {
    return process.env.GROQ_API_KEY?.trim() || "";
  }

  /**
   * Helper sanitasi error agar API key tidak pernah bocor ke log, respons, atau console
   */
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
        text: "⚠️ Kunci API Groq belum dikonfigurasi di server. Silakan hubungi administrator atau pilih provider Google Gemini / OpenAI pada dropdown di atas.",
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

    for (const msg of messages) {
      if (msg.role !== "system" && msg.content?.trim()) {
        formattedMessages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content.trim(),
        });
      }
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

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
          top_p: 0.9,
          max_tokens: 1024,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "";

        if (content.trim()) {
          return {
            text: content.trim(),
            provider: this.providerType,
            model: this.defaultModel,
            status: "success",
            durationMs: Math.round(performance.now() - startTime),
          };
        }
      }

      const errorText = await res.text().catch(() => "");
      let userMsg = "⚠️ Terjadi kendala saat memproses jawaban melalui Groq AI.";

      if (res.status === 401 || res.status === 403) {
        userMsg =
          "⚠️ Kunci API Groq tidak valid atau izin akses ditolak. Silakan beralih ke provider Google Gemini atau OpenAI.";
      } else if (res.status === 429) {
        userMsg =
          "⏳ Batas kuota permintaan (rate limit) Groq tercapai. Silakan coba sesaat lagi atau beralih ke Google Gemini.";
      } else if (res.status >= 500) {
        userMsg =
          "📡 Server Groq sedang mengalami lonjakan beban. Anda dapat menggunakan Google Gemini sebagai alternatif aktif.";
      }

      return {
        text: userMsg,
        provider: this.providerType,
        model: this.defaultModel,
        status: "fallback",
        error: `HTTP_${res.status}: ${this.sanitizeError(errorText.slice(0, 100))}`,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isTimeout = errMsg.includes("abort") || errMsg.includes("timeout");

      return {
        text: isTimeout
          ? "⏱️ Waktu respons Groq habis. Silakan gunakan Google Gemini sebagai alternatif cepat di atas."
          : "📡 Gagal terhubung ke server Groq. Silakan periksa koneksi internet atau beralih ke Google Gemini.",
        provider: this.providerType,
        model: this.defaultModel,
        status: "error",
        error: this.sanitizeError(errMsg),
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  async testConnection(): Promise<ProviderConnectionStatus> {
    const start = performance.now();

    if (!this.apiKey) {
      return {
        ok: false,
        provider: this.providerType,
        name: "Groq",
        model: this.defaultModel,
        message: "API Key belum dikonfigurasi di file environment.",
        latencyMs: 0,
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

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
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const latencyMs = Math.round(performance.now() - start);

      if (res.ok) {
        return {
          ok: true,
          provider: this.providerType,
          name: "Groq",
          model: this.defaultModel,
          message: "Terhubung secara aktif ke Groq Cloud API",
          latencyMs,
        };
      }

      const errText = await res.text().catch(() => "");
      let safeMsg = `Gagal terhubung (HTTP ${res.status})`;
      if (res.status === 401) safeMsg = "API Key Groq tidak valid";
      if (res.status === 429) safeMsg = "Rate limit kuota Groq tercapai";

      return {
        ok: false,
        provider: this.providerType,
        name: "Groq",
        model: this.defaultModel,
        message: `${safeMsg}: ${this.sanitizeError(errText.slice(0, 80))}`,
        latencyMs,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        provider: this.providerType,
        name: "Groq",
        model: this.defaultModel,
        message: `Koneksi gagal: ${this.sanitizeError(errMsg)}`,
        latencyMs: Math.round(performance.now() - start),
      };
    }
  }
}
