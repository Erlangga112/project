"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AsistenAIPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Halo! Saya Asisten AI Pelayanan Desa Perum. Ada yang bisa saya bantu terkait persyaratan atau alur layanan hari ini?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setMessages(prev => [...prev, { role: "assistant", content: `Maaf, terjadi kesalahan: ${err.message}` }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-8 w-full lg:w-[95%] max-w-[1400px] mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-4 mb-4 sm:mb-6">
        <Link 
          href="/warga" 
          className="px-3.5 sm:px-4 py-2 bg-white text-[#17365D] border border-[#CBD5E1] hover:bg-[#F1F5F9] rounded-xl font-medium text-xs sm:text-sm transition-colors"
        >
          &larr; Kembali ke Dashboard
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] flex flex-col h-[calc(100dvh-12rem)] min-h-[480px] max-h-[750px] overflow-hidden">
        {/* Chat Header in Navy Blue */}
        <div className="p-5 border-b border-[#17365D] bg-[#17365D] text-white flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white border border-white/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">Asisten AI Pelayanan Desa</h1>
              <span className="w-2 h-2 rounded-full bg-[#15803D]" />
            </div>
            <p className="text-xs text-slate-300">Tanya seputar persyaratan dokumen dan alur pelayanan publik</p>
          </div>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F1F5F9]">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div 
                className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user" 
                    ? "bg-[#0F766E] text-white rounded-tr-none shadow-sm" 
                    : "bg-white text-[#1E293B] shadow-xs border border-[#E2E8F0] rounded-tl-none"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white p-4 rounded-2xl shadow-xs border border-[#E2E8F0] rounded-tl-none flex gap-2 items-center">
                <div className="w-2 h-2 bg-[#0F766E] rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-[#0F766E] rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-2 h-2 bg-[#0F766E] rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-[#E2E8F0]">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-3"
          >
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ketik pertanyaan Anda seputar layanan desa di sini..." 
              className="flex-1 px-4 py-3 bg-[#F1F5F9] border border-[#CBD5E1] rounded-xl focus:outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 text-sm text-[#1E293B] placeholder-slate-400"
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className="px-6 py-3 bg-[#0F766E] hover:bg-[#0d655e] text-white rounded-xl transition-colors disabled:opacity-50 font-semibold text-sm shadow-sm"
            >
              Kirim
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
