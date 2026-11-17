"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actionType?: "CONFIRM_SUBMISSION" | "VIEW_SUBMISSION" | "PRINT_READY";
  serviceCode?: string;
  pengajuanId?: string;
  previewUrl?: string;
  provider?: "openai" | "gemini" | "deepseek" | "groq";
  model?: string;
}

interface AvailableProvider {
  id: string;
  name: string;
  model: string;
  isConfigured?: boolean;
  isDefault?: boolean;
}

interface ChatbotSessionState {
  authenticated: boolean;
  user: {
    id: string;
    name: string | null;
    role: string;
  } | null;
  roleTitle: string;
  roleBadge: string;
  welcomeMessage: string;
  suggestions: string[];
  availableProviders?: AvailableProvider[];
}

export default function ChatBot() {
  const pathname = usePathname() || "/";
  const [isOpen, setIsOpen] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<ChatbotSessionState>({
    authenticated: false,
    user: null,
    roleTitle: "Asisten Desa Perum",
    roleBadge: "Informasi Publik",
    welcomeMessage:
      "Halo! 👋 Saya **Asisten Desa Perum**. Ada yang bisa saya bantu seputar layanan administrasi desa?",
    suggestions: [
      "Apa saja layanan surat yang ada?",
      "Syarat Surat Keterangan Usaha (SKU)",
      "Syarat Surat Keterangan Tidak Mampu (SKTM)",
      "Jam pelayanan kantor desa",
    ],
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Halo! 👋 Saya **Asisten Desa Perum**. Ada yang bisa saya bantu seputar layanan administrasi desa?",
      timestamp: new Date(),
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("openai");
  const [providerStatus, setProviderStatus] = useState<{
    ok: boolean;
    message: string;
    model?: string;
  }>({ ok: true, message: "Terhubung aktif" });
  const [isTestingProvider, setIsTestingProvider] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Check connection status for a provider
  const checkProviderStatus = useCallback(
    async (prov: string) => {
      setIsTestingProvider(true);
      try {
        const res = await fetch(`/api/chatbot/provider/status?provider=${encodeURIComponent(prov)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status) {
            setProviderStatus({
              ok: data.status.ok,
              message:
                data.status.message ||
                (data.status.ok ? "Terhubung aktif" : "Koneksi bermasalah"),
              model: data.status.model,
            });
          }
        }
      } catch {
        setProviderStatus({ ok: false, message: "Gagal memeriksa status koneksi" });
      } finally {
        setIsTestingProvider(false);
      }
    },
    []
  );

  const handleProviderChange = (newProvider: string) => {
    setSelectedProvider(newProvider);
    checkProviderStatus(newProvider);
  };

  // Fetch session on load
  const loadSession = useCallback(async () => {
    try {
      const query = pathname ? `?path=${encodeURIComponent(pathname)}` : "";
      const res = await fetch(`/api/chatbot/session${query}`, { cache: "no-store" });
      if (res.ok) {
        const data: ChatbotSessionState = await res.json();
        setSessionInfo(data);

        // Auto-select first available provider if current selection is not in the list
        if (data.availableProviders && data.availableProviders.length > 0) {
          setSelectedProvider((current) => {
            const isCurrentAvailable = data.availableProviders!.some(
              (p) => p.id === current
            );
            if (!isCurrentAvailable) {
              const firstConfigured = data.availableProviders!.find((p) => p.isConfigured);
              return firstConfigured?.id || data.availableProviders![0].id;
            }
            return current;
          });
        }

        // Set custom role welcome message if conversation is fresh
        setMessages((prev) => {
          if (prev.length <= 1 && prev[0]?.id === "welcome") {
            return [
              {
                id: "welcome",
                role: "assistant",
                content: data.welcomeMessage,
                timestamp: new Date(),
              },
            ];
          }
          return prev;
        });
      }
    } catch (err) {
      console.warn("Could not load chatbot session:", err);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      loadSession();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, loadSession]);

  const sendMessage = async (messageText?: string) => {
    const textToSend = (messageText || input).trim();
    if (!textToSend || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const historyForApi = [...messages, userMsg]
        .filter((m) => m.id !== "welcome")
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyForApi,
          provider: selectedProvider,
          pageContext: {
            pathname,
            pageTitle: typeof document !== "undefined" ? document.title : undefined,
          },
        }),
      });

      const data = await res.json();

      if (data.roleTitle && data.roleTitle !== sessionInfo.roleTitle) {
        setSessionInfo((prev) => ({ ...prev, roleTitle: data.roleTitle }));
      }

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message || data.error || "Maaf, terjadi kendala saat memproses jawaban.",
        timestamp: new Date(),
        actionType: data.actionType,
        serviceCode: data.serviceCode,
        pengajuanId: data.pengajuanId,
        previewUrl: data.previewUrl,
        provider: data.provider || selectedProvider,
        model: data.model,
      };

      setMessages((prev) => [...prev, botMsg]);

      if (!isOpen) setHasUnread(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Maaf, koneksi terputus. Silakan coba kembali beberapa saat lagi. 🔄",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    // Reset server-side conversation memory
    fetch("/api/chatbot/session", { method: "DELETE" }).catch(() => {});
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: sessionInfo.welcomeMessage,
        timestamp: new Date(),
      },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatContent = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code class='chatbot-code'>$1</code>")
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="chatbot-link">$1 ↗</a>')
      .replace(/\n/g, "<br/>");
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        id="chatbot-toggle"
        onClick={() => setIsOpen(!isOpen)}
        className="chatbot-fab"
        aria-label="Buka chat asisten desa"
        title="Buka Asisten Desa Perum"
      >
        {hasUnread && <span className="chatbot-unread-dot" />}
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-window" role="dialog" aria-label={sessionInfo.roleTitle}>
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <div className="chatbot-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8V4H8" />
                  <rect x="2" y="2" width="20" height="20" rx="2" />
                  <path d="M2 12h20" />
                  <path d="M12 2v20" />
                  <circle cx="7" cy="17" r="1.5" fill="currentColor" />
                  <circle cx="17" cy="17" r="1.5" fill="currentColor" />
                  <path d="M8 7h.01" />
                </svg>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <h3 className="chatbot-title">{sessionInfo.roleTitle}</h3>
                </div>
                <div className="chatbot-header-sub">
                  <span className="chatbot-role-badge">{sessionInfo.roleBadge}</span>
                  <span className="chatbot-status">
                    <span className="chatbot-status-dot" />
                    Online
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={resetChat}
                className="chatbot-close-btn"
                aria-label="Reset chat"
                title="Mulai Ulang Percakapan"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="chatbot-close-btn"
                aria-label="Tutup chat"
                title="Tutup Chat"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Model Selector Bar (Khusus Role Supervisor) */}
          {sessionInfo.user?.role === "SUPERVISOR" && (
            <div className="chatbot-supervisor-model-bar">
              <div className="chatbot-provider-selector">
                <span className="chatbot-provider-label">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Model:
                </span>
                <select
                  id="supervisor-ai-provider"
                  value={selectedProvider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="chatbot-provider-select"
                  aria-label="Pilih Provider Model AI"
                  disabled={isLoading}
                >
                  {sessionInfo.availableProviders && sessionInfo.availableProviders.length > 0 ? (
                    sessionInfo.availableProviders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.model})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="openai">OpenAI (Default / NIM)</option>
                      <option value="gemini">Google Gemini (3.5 Flash)</option>
                      <option value="deepseek">DeepSeek (V3 / Chat)</option>
                      <option value="groq">Groq (Qwen 3.8 27B / LPU)</option>
                    </>
                  )}
                </select>
              </div>
              <div
                className="chatbot-provider-status-badge"
                title={providerStatus.message}
              >
                <span
                  className={`chatbot-provider-dot ${
                    isTestingProvider
                      ? "idle"
                      : providerStatus.ok
                      ? "connected"
                      : "idle"
                  }`}
                />
                <span>
                  {isTestingProvider
                    ? "Memeriksa..."
                    : providerStatus.model
                    ? providerStatus.model
                    : selectedProvider === "gemini"
                    ? "Gemini 3.5 Flash"
                    : selectedProvider === "deepseek"
                    ? "DeepSeek V3"
                    : selectedProvider === "groq"
                    ? "Groq Qwen 27B"
                    : "OpenAI Active"}
                </span>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="chatbot-messages" ref={chatContainerRef}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chatbot-msg ${msg.role === "user" ? "chatbot-msg-user" : "chatbot-msg-bot"}`}
              >
                {msg.role === "assistant" && (
                  <div className="chatbot-msg-avatar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                  </div>
                )}
                <div className={`chatbot-bubble ${msg.role === "user" ? "chatbot-bubble-user" : "chatbot-bubble-bot"}`}>
                  <div
                    dangerouslySetInnerHTML={{
                      __html: formatContent(msg.content),
                    }}
                  />

                  {/* Tombol Aksi Nyata Pelayanan Surat */}
                  {msg.actionType === "CONFIRM_SUBMISSION" && (
                    <div className="chatbot-action-container">
                      <button
                        type="button"
                        onClick={() => sendMessage("Ya, ajukan sekarang")}
                        className="chatbot-action-btn"
                        disabled={isLoading}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Konfirmasi & Ajukan Permohonan
                      </button>
                    </div>
                  )}

                  {msg.actionType === "VIEW_SUBMISSION" && msg.previewUrl && (
                    <div className="chatbot-action-container">
                      <a
                        href={msg.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="chatbot-action-btn"
                        style={{ textDecoration: "none", background: "#17365D" }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        Buka Pratinjau Draft A4 ↗
                      </a>
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginTop: "4px" }}>
                    {sessionInfo.user?.role === "SUPERVISOR" && msg.role === "assistant" ? (
                      <span className={`chatbot-msg-provider-tag ${msg.provider || selectedProvider}`}>
                        {(msg.provider || selectedProvider) === "gemini"
                          ? "✨ Gemini"
                          : (msg.provider || selectedProvider) === "deepseek"
                          ? "🐋 DeepSeek"
                          : (msg.provider || selectedProvider) === "groq"
                          ? "⚡ Groq"
                          : "🤖 OpenAI"}
                      </span>
                    ) : <span />}
                    <span className="chatbot-time">
                      {msg.timestamp.toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="chatbot-msg chatbot-msg-bot">
                <div className="chatbot-msg-avatar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                </div>
                <div className="chatbot-bubble chatbot-bubble-bot">
                  <div className="chatbot-typing">
                    <span className="chatbot-typing-dot" />
                    <span className="chatbot-typing-dot" />
                    <span className="chatbot-typing-dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          {sessionInfo.suggestions && sessionInfo.suggestions.length > 0 && (
            <div className="chatbot-suggestions">
              {sessionInfo.suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="chatbot-chip"
                  onClick={() => sendMessage(suggestion)}
                  disabled={isLoading}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="chatbot-input-area">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik pertanyaan seputar layanan desa..."
              disabled={isLoading}
              className="chatbot-input"
              id="chatbot-input"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="chatbot-send-btn"
              aria-label="Kirim pesan"
              title="Kirim Pesan"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
