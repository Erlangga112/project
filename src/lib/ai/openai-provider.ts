import {
  AiMessage,
  AiProviderResponse,
  IAiProvider,
  ProviderConnectionStatus,
} from "./types";

export class OpenAiProvider implements IAiProvider {
  readonly providerType = "openai" as const;

  get defaultModel(): string {
    return process.env.OPENAI_API_KEY
      ? (process.env.OPENAI_MODEL || "gpt-4o-mini")
      : (process.env.NVIDIA_MODEL || "meta/llama-3.2-90b-vision-instruct");
  }

  private get apiUrl(): string {
    if (process.env.OPENAI_API_KEY) {
      return "https://api.openai.com/v1/chat/completions";
    }
    return "https://integrate.api.nvidia.com/v1/chat/completions";
  }

  private get apiKey(): string {
    return process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY || "";
  }

  private get isOpenAiDirect(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async generateChat(
    messages: AiMessage[],
    systemPrompt: string
  ): Promise<AiProviderResponse> {
    const startTime = performance.now();

    if (!this.apiKey) {
      return {
        text: "⚠️ Kunci API OpenAI belum dikonfigurasi di server. Silakan tambahkan OPENAI_API_KEY di file environment server atau gunakan provider Google Gemini.",
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
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages: formattedMessages,
          temperature: 0.15,
          top_p: 0.8,
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

      // Handle specific HTTP errors from OpenAI/NIM
      const errorText = await res.text().catch(() => "");
      let userMsg = "⚠️ Terjadi kendala saat memproses jawaban melalui OpenAI.";
      if (res.status === 401 || res.status === 403) {
        userMsg = "⚠️ Kunci API OpenAI tidak valid atau izin ditolak. Silakan beralih ke provider Google Gemini.";
      } else if (res.status === 429) {
        userMsg = "⏳ Batas kuota atau rate-limit OpenAI tercapai. Silakan coba kembali sesaat lagi atau beralih ke Google Gemini.";
      } else if (res.status === 410 || res.status === 404) {
        userMsg = "⚠️ Model OpenAI yang diminta sedang tidak tersedia. Silakan gunakan Google Gemini sebagai alternatif aktif.";
      }

      // Intelligent fallback using context data if upstream model is down
      const lastUserMsg = messages[messages.length - 1]?.content || "";
      const fallbackText = `${userMsg}\n\n💡 *Catatan Asisten Desa:* Anda dapat memilih **Google Gemini** pada dropdown model di atas untuk respons AI langsung, atau melanjutkan percakapan terkait data dashboard.`;

      return {
        text: fallbackText,
        provider: this.providerType,
        model: this.defaultModel,
        status: "fallback",
        error: `HTTP_${res.status}: ${errorText.slice(0, 100)}`,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err: unknown) {
      return {
        text: "📡 Gagal terhubung ke layanan OpenAI. Silakan gunakan pilihan model Google Gemini yang terhubung aktif di atas.",
        provider: this.providerType,
        model: this.defaultModel,
        status: "error",
        error: "CONNECTION_FAILED",
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
        name: this.isOpenAiDirect ? "OpenAI" : "OpenAI (NVIDIA NIM)",
        model: this.defaultModel,
        message: "API Key belum dikonfigurasi.",
        latencyMs: 0,
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

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

      if (res.ok) {
        return {
          ok: true,
          provider: this.providerType,
          name: this.isOpenAiDirect ? "OpenAI" : "OpenAI (NVIDIA NIM)",
          model: this.defaultModel,
          message: `Terhubung aktif ke ${this.defaultModel}`,
          latencyMs: Math.round(performance.now() - start),
        };
      }

      return {
        ok: false,
        provider: this.providerType,
        name: this.isOpenAiDirect ? "OpenAI" : "OpenAI (NVIDIA NIM)",
        model: this.defaultModel,
        message: `Status ${res.status}: Model ${this.defaultModel} tidak merespons`,
        latencyMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      return {
        ok: false,
        provider: this.providerType,
        name: this.isOpenAiDirect ? "OpenAI" : "OpenAI (NVIDIA NIM)",
        model: this.defaultModel,
        message: "Koneksi ke endpoint OpenAI sedang bermasalah.",
        latencyMs: Math.round(performance.now() - start),
      };
    }
  }
}
