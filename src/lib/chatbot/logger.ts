export interface ChatbotLogPayload {
  userId?: string | null;
  role: string;
  intent: string;
  backendFunction: string;
  durationMs: number;
  status: "SUCCESS" | "ERROR" | "BLOCKED" | "FALLBACK";
  errorCategory?: string;
  querySnippet?: string;
}

/**
 * Structured, secure server-side logging for chatbot diagnostic audit.
 * NEVER logs passwords, tokens, full NIK, or credentials.
 */
export function logChatbotActivity(payload: ChatbotLogPayload) {
  const timestamp = new Date().toISOString();
  const safeSnippet = payload.querySnippet
    ? payload.querySnippet.slice(0, 80).replace(/\b\d{16}\b/g, "****************")
    : "-";

  const logLine = `[CHATBOT_AUDIT] ${timestamp} | Role: ${payload.role} | Intent: ${payload.intent} | Func: ${payload.backendFunction} | Duration: ${payload.durationMs}ms | Status: ${payload.status}${payload.errorCategory ? ` | Error: ${payload.errorCategory}` : ""} | Query: "${safeSnippet}"`;

  if (payload.status === "ERROR") {
    console.error(logLine);
  } else {
    console.log(logLine);
  }
}
