export type AiProviderType = "openai" | "gemini" | "deepseek" | "groq" | "custom" | string;

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiProviderResponse {
  text: string;
  provider: AiProviderType;
  model: string;
  status: "success" | "fallback" | "error";
  error?: string;
  durationMs?: number;
}

export interface ProviderConnectionStatus {
  ok: boolean;
  provider: AiProviderType;
  name: string;
  model: string;
  message: string;
  latencyMs?: number;
}

export interface IAiProvider {
  readonly providerType: AiProviderType;
  readonly defaultModel: string;
  generateChat(
    messages: AiMessage[],
    systemPrompt: string
  ): Promise<AiProviderResponse>;
  testConnection(): Promise<ProviderConnectionStatus>;
}

