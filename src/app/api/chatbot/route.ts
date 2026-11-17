import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ChatRole, getRoleConfig } from "@/lib/chatbot/roles";
import { getAuthorizedChatbotContext, ChatbotContextData } from "@/lib/chatbot/context";
import { checkSecurityGuardrails, postProcessResponse } from "@/lib/chatbot/guardrails";
import { generateSystemPrompt } from "@/lib/chatbot/prompts";
import { detectQuestionIntent } from "@/lib/chatbot/intents";
import { checkStatisticPermission } from "@/lib/chatbot/permissions";
import { getActualUserStats, getActualPelayananStats } from "@/lib/chatbot/stats";
import { formatStatisticAnswer } from "@/lib/chatbot/answers";
import { logChatbotActivity } from "@/lib/chatbot/logger";
import {
  handleBuatSurat,
  handleKonfirmasiBuatSurat,
  handleStatusSurat,
  handleSyaratSurat,
  handlePanduanCetak,
} from "@/lib/chatbot/surat-answers";
import {
  handleUserProfileAnswer,
  handleAntreanPelayananAnswer,
  handlePengajuanBaruAnswer,
  handleDaftarLayananAnswer,
  handleSopPelayananAnswer,
  handleJamDanKontakDesaAnswer,
  handleStatusNotifikasiAnswer,
  handleCariWargaAnswer,
  handleJumlahRoleAnswer,
} from "@/lib/chatbot/knowledge-answers";
import { getSessionState, updateSessionState, clearSessionState } from "@/lib/chatbot/memory";
import { resolveContextualQuestion } from "@/lib/chatbot/context-resolver";
import { AiService } from "@/lib/ai/service";
import { AiProviderType, AiMessage } from "@/lib/ai/types";

export async function POST(request: NextRequest) {
  const startTime = performance.now();

  try {
    // 1. STRICT SERVER-SIDE SESSION & ROLE VALIDATION
    // Never trust role from frontend request!
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role: ChatRole = session?.user?.role
      ? (session.user.role as ChatRole)
      : "GUEST";

    const roleConfig = getRoleConfig(role);

    // Parse body
    const body = await request.json();
    const { messages, pageContext, provider } = body;
    // Determine target AI provider: use frontend selection for SUPERVISOR,
    // otherwise fall back to first available configured provider
    let targetProvider: AiProviderType = "openai";
    if (role === "SUPERVISOR" && provider) {
      targetProvider = provider;
    } else {
      const availableProviders = AiService.getAvailableProviders();
      const firstConfigured = availableProviders.find((p) => p.isConfigured);
      if (firstConfigured) {
        targetProvider = firstConfigured.id;
      } else if (availableProviders.length > 0) {
        targetProvider = availableProviders[0].id;
      }
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Pesan tidak boleh kosong" },
        { status: 400 }
      );
    }

    const lastMessage = messages[messages.length - 1]?.content || "";
    const cleanQuery = typeof lastMessage === "string" ? lastMessage.trim() : "";

    if (!cleanQuery) {
      return NextResponse.json(
        { error: "Pesan tidak boleh kosong" },
        { status: 400 }
      );
    }

    // 2. RUN SECURITY GUARDRAILS (Secrets, Cross-user privacy, Chat approval, Off-topic)
    const guardrail = checkSecurityGuardrails(
      cleanQuery,
      role,
      session?.user?.name || undefined
    );

    if (guardrail.blocked && guardrail.authoritativeResponse) {
      logChatbotActivity({
        userId,
        role,
        intent: "GUARDRAIL_BLOCKED",
        backendFunction: "checkSecurityGuardrails",
        durationMs: Math.round(performance.now() - startTime),
        status: "BLOCKED",
        errorCategory: guardrail.reason,
        querySnippet: cleanQuery,
      });

      // Record blocked attempt in AiChatLog for audit trail
      try {
        await prisma.aiChatLog.create({
          data: {
            userId: userId || null,
            query: cleanQuery,
            response: guardrail.authoritativeResponse,
          },
        });
      } catch (logErr) {
        console.error("Failed to write aiChatLog:", logErr);
      }

      return NextResponse.json({
        message: guardrail.authoritativeResponse,
        role,
        roleTitle: roleConfig.title,
      });
    }

    // 2b. CONVERSATION CONTEXT & MULTI-TURN MEMORY
    const sessionKey = body.sessionKey || (userId ? `user:${userId}` : `guest:${request.headers.get("x-forwarded-for") || "unknown"}`);

    if (body.clearContext || messages.length <= 1) {
      clearSessionState(sessionKey);
    }

    const sessionState = getSessionState(sessionKey, messages);

    // Evaluasi apakah pertanyaan saat ini merupakan pertanyaan lanjutan / kontekstual
    const contextualResult = await resolveContextualQuestion(
      cleanQuery,
      sessionState,
      role,
      userId,
      sessionKey,
      pageContext
    );

    if (contextualResult.handled && contextualResult.response) {
      const durationMs = Math.round(performance.now() - startTime);
      logChatbotActivity({
        userId,
        role,
        intent: contextualResult.updatedState?.entity || sessionState.entity || "CONTEXTUAL_FOLLOWUP",
        backendFunction: "resolveContextualQuestion",
        durationMs,
        status: "SUCCESS",
        querySnippet: cleanQuery,
      });

      try {
        await prisma.aiChatLog.create({
          data: {
            userId: userId || null,
            query: cleanQuery,
            response: contextualResult.response,
          },
        });
      } catch (logErr) {
        console.error("Failed to write aiChatLog:", logErr);
      }

      return NextResponse.json({
        message: contextualResult.response,
        role,
        roleTitle: roleConfig.title,
        provider: targetProvider,
      });
    }

    // 3. INTENT DETECTION FOR SYSTEM & USER STATISTICS
    const intentResult = detectQuestionIntent(cleanQuery);

    if (intentResult.intent !== "UNKNOWN") {
      // 3a. CHECK ROLE PERMISSION FOR THIS INTENT
      const permCheck = checkStatisticPermission(role, intentResult.intent);

      if (!permCheck.allowed) {
        const refusalMessage =
          permCheck.refusalMessage ||
          "Mohon maaf, Anda tidak memiliki izin untuk mengakses data statistik ini.";

        logChatbotActivity({
          userId,
          role,
          intent: intentResult.intent,
          backendFunction: "checkStatisticPermission",
          durationMs: Math.round(performance.now() - startTime),
          status: "BLOCKED",
          errorCategory: permCheck.reason,
          querySnippet: cleanQuery,
        });

        try {
          await prisma.aiChatLog.create({
            data: {
              userId: userId || null,
              query: cleanQuery,
              response: refusalMessage,
            },
          });
        } catch (logErr) {
          console.error("Failed to write aiChatLog:", logErr);
        }

        return NextResponse.json({
          message: refusalMessage,
          role,
          roleTitle: roleConfig.title,
        });
      }

      // 3b. EKSEKUSI INTENT LAYANAN SURAT DESA DENGAN DATA AKTUAL
      const isSuratIntent = [
        "BUAT_SURAT",
        "STATUS_SURAT",
        "SYARAT_SURAT",
        "PANDUAN_CETAK",
        "KONFIRMASI_BUAT_SURAT",
      ].includes(intentResult.intent);

      if (isSuratIntent) {
        let suratResponse = { message: "" };

        if (intentResult.intent === "BUAT_SURAT") {
          suratResponse = await handleBuatSurat(userId, role, intentResult.serviceCode, cleanQuery);
        } else if (intentResult.intent === "KONFIRMASI_BUAT_SURAT") {
          suratResponse = await handleKonfirmasiBuatSurat(userId, role, intentResult.serviceCode, cleanQuery);
        } else if (intentResult.intent === "STATUS_SURAT") {
          suratResponse = await handleStatusSurat(userId, role);
        } else if (intentResult.intent === "SYARAT_SURAT") {
          suratResponse = await handleSyaratSurat(intentResult.serviceCode, cleanQuery);
        } else if (intentResult.intent === "PANDUAN_CETAK") {
          suratResponse = await handlePanduanCetak(userId, role);
        }

        const durationMs = Math.round(performance.now() - startTime);
        logChatbotActivity({
          userId,
          role,
          intent: intentResult.intent,
          backendFunction: `surat:${intentResult.intent}`,
          durationMs,
          status: "SUCCESS",
          querySnippet: cleanQuery,
        });

        try {
          await prisma.aiChatLog.create({
            data: {
              userId: userId || null,
              query: cleanQuery,
              response: suratResponse.message,
            },
          });
        } catch (logErr) {
          console.error("Failed to write aiChatLog:", logErr);
        }

        if (intentResult.serviceCode) {
          updateSessionState(sessionKey, {
            entity: "SURAT",
            serviceCode: intentResult.serviceCode,
            serviceName: intentResult.serviceName,
            lastIntent: intentResult.intent,
            lastQuery: cleanQuery,
          });
        }

        return NextResponse.json({
          role,
          roleTitle: roleConfig.title,
          provider: targetProvider,
          ...suratResponse,
        });
      }

      // 3c. EKSEKUSI INTENT MENGENALI PENGGUNA & MASTER DATA SISTEM
      const isKnowledgeIntent = [
        "PROFIL_PENGGUNA",
        "ANTREAN_PELAYANAN",
        "PENGAJUAN_BARU",
        "DAFTAR_LAYANAN",
        "SOP_PELAYANAN",
        "JAM_PELAYANAN",
        "STATUS_NOTIFIKASI",
        "CARI_WARGA",
        "JUMLAH_ROLE",
      ].includes(intentResult.intent);

      if (isKnowledgeIntent) {
        let answerText = "";

        if (intentResult.intent === "PROFIL_PENGGUNA") {
          answerText = await handleUserProfileAnswer(userId, role);
        } else if (intentResult.intent === "ANTREAN_PELAYANAN") {
          answerText = await handleAntreanPelayananAnswer(role);
        } else if (intentResult.intent === "PENGAJUAN_BARU") {
          answerText = await handlePengajuanBaruAnswer();
        } else if (intentResult.intent === "DAFTAR_LAYANAN") {
          answerText = await handleDaftarLayananAnswer();
        } else if (intentResult.intent === "SOP_PELAYANAN") {
          answerText = handleSopPelayananAnswer(role);
        } else if (intentResult.intent === "JAM_PELAYANAN") {
          answerText = handleJamDanKontakDesaAnswer();
        } else if (intentResult.intent === "STATUS_NOTIFIKASI") {
          answerText = await handleStatusNotifikasiAnswer(role);
        } else if (intentResult.intent === "CARI_WARGA") {
          answerText = await handleCariWargaAnswer(cleanQuery, role);
        } else if (intentResult.intent === "JUMLAH_ROLE") {
          const isAskingSpecificCount =
            cleanQuery.toLowerCase().includes("berapa") ||
            cleanQuery.toLowerCase().includes("jumlah") ||
            cleanQuery.toLowerCase().includes("total");
          answerText = await handleJumlahRoleAnswer(role, isAskingSpecificCount ? "COUNT" : "LIST");
        }

        const durationMs = Math.round(performance.now() - startTime);
        logChatbotActivity({
          userId,
          role,
          intent: intentResult.intent,
          backendFunction: `knowledge:${intentResult.intent}`,
          durationMs,
          status: "SUCCESS",
          querySnippet: cleanQuery,
        });

        try {
          await prisma.aiChatLog.create({
            data: {
              userId: userId || null,
              query: cleanQuery,
              response: answerText,
            },
          });
        } catch (logErr) {
          console.error("Failed to write aiChatLog:", logErr);
        }

        if (intentResult.intent === "ANTREAN_PELAYANAN" || intentResult.intent === "PENGAJUAN_BARU") {
          updateSessionState(sessionKey, {
            entity: "PENGAJUAN",
            statusFilter: ["DIAJUKAN", "DIPERIKSA"],
            statusLabel: "menunggu verifikasi",
            lastIntent: intentResult.intent,
            lastQuery: cleanQuery,
          });
        } else if (intentResult.intent === "CARI_WARGA") {
          updateSessionState(sessionKey, {
            entity: "WARGA",
            lastIntent: "CARI_WARGA",
            lastQuery: cleanQuery,
          });
        }

        return NextResponse.json({
          message: answerText,
          role,
          roleTitle: roleConfig.title,
          provider: targetProvider,
        });
      }

      // 3d. EXECUTE ACTUAL STATISTIC DATABASE QUERIES SAFELY
      try {
        const [userStats, pelayananStats] = await Promise.all([
          getActualUserStats(),
          getActualPelayananStats(),
        ]);

        const answer = formatStatisticAnswer(
          intentResult.intent,
          userStats,
          pelayananStats
        );

        const durationMs = Math.round(performance.now() - startTime);
        logChatbotActivity({
          userId,
          role,
          intent: intentResult.intent,
          backendFunction: `formatStatisticAnswer:${intentResult.intent}`,
          durationMs,
          status: "SUCCESS",
          querySnippet: cleanQuery,
        });

        try {
          await prisma.aiChatLog.create({
            data: {
              userId: userId || null,
              query: cleanQuery,
              response: answer,
            },
          });
        } catch (logErr) {
          console.error("Failed to write aiChatLog:", logErr);
        }

        if (["JUMLAH_WARGA", "WARGA_AKTIF", "WARGA_PINDAH"].includes(intentResult.intent)) {
          updateSessionState(sessionKey, {
            entity: "WARGA",
            lastIntent: intentResult.intent,
            lastQuery: cleanQuery,
          });
        } else if (intentResult.intent === "JUMLAH_STAF") {
          updateSessionState(sessionKey, {
            entity: "STAF",
            lastIntent: "JUMLAH_STAF",
            lastQuery: cleanQuery,
          });
        } else if (intentResult.intent === "JUMLAH_KADES") {
          updateSessionState(sessionKey, {
            entity: "KADES",
            lastIntent: "JUMLAH_KADES",
            lastQuery: cleanQuery,
          });
        } else if (
          [
            "PENGAJUAN_TOTAL",
            "PENGAJUAN_DISETUJUI",
            "PENGAJUAN_SELESAI",
            "PENGAJUAN_DITOLAK",
            "PENGAJUAN_DIPROSES",
            "PENGAJUAN_MENUNGGU_VALIDASI",
            "PENGAJUAN_BELUM_SELESAI",
            "STATISTIK_PENGAJUAN",
          ].includes(intentResult.intent)
        ) {
          let statusFilter: string[] | undefined;
          let statusLabel: string | undefined;
          if (intentResult.intent === "PENGAJUAN_DISETUJUI") {
            // Definisi identik dengan Widget 3 Dashboard Supervisor
            statusFilter = ["DISETUJUI_SUPERVISOR", "MENUNGGU_APPROVAL_KEPALA_DESA", "DISETUJUI", "SELESAI"];
            statusLabel = "disetujui";
          } else if (intentResult.intent === "PENGAJUAN_SELESAI") {
            statusFilter = ["SELESAI"];
            statusLabel = "selesai";
          } else if (intentResult.intent === "PENGAJUAN_DITOLAK") {
            statusFilter = ["DITOLAK"];
            statusLabel = "ditolak";
          } else if (
            intentResult.intent === "PENGAJUAN_DIPROSES" ||
            intentResult.intent === "PENGAJUAN_BELUM_SELESAI"
          ) {
            statusFilter = [
              "DIAJUKAN",
              "DIPERIKSA",
              "PERLU_PERBAIKAN",
              "MENUNGGU_VALIDASI",
              "DISETUJUI_SUPERVISOR",
              "MENUNGGU_APPROVAL_KEPALA_DESA",
              "DISETUJUI",
            ];
            statusLabel = "sedang diproses";
          } else if (intentResult.intent === "PENGAJUAN_MENUNGGU_VALIDASI") {
            statusFilter = ["MENUNGGU_VALIDASI"];
            statusLabel = "menunggu validasi";
          }

          updateSessionState(sessionKey, {
            entity: "PENGAJUAN",
            statusFilter,
            statusLabel,
            lastIntent: intentResult.intent,
            lastQuery: cleanQuery,
          });
        } else if (intentResult.intent === "TOTAL_AKUN") {
          updateSessionState(sessionKey, {
            entity: "PENGGUNA",
            lastIntent: "TOTAL_AKUN",
            lastQuery: cleanQuery,
          });
        } else if (intentResult.intent === "JUMLAH_ROLE") {
          updateSessionState(sessionKey, {
            entity: "PENGGUNA",
            lastIntent: "JUMLAH_ROLE",
            lastQuery: cleanQuery,
          });
        } else if (intentResult.intent === "RINGKASAN_BULAN_INI") {
          updateSessionState(sessionKey, {
            entity: "STATISTIK",
            timeFilter: "BULAN_INI",
            lastIntent: "RINGKASAN_BULAN_INI",
            lastQuery: cleanQuery,
          });
        }

        return NextResponse.json({
          message: answer,
          role,
          roleTitle: roleConfig.title,
          provider: targetProvider,
        });
      } catch (dbError) {
        const durationMs = Math.round(performance.now() - startTime);
        logChatbotActivity({
          userId,
          role,
          intent: intentResult.intent,
          backendFunction: "getActualStats",
          durationMs,
          status: "ERROR",
          errorCategory: "DATABASE_QUERY_FAILURE",
          querySnippet: cleanQuery,
        });
        console.error("Statistic DB Query error:", dbError);

        return NextResponse.json({
          message:
            "Mohon maaf, data statistik saat ini sementara tidak dapat diambil dari database sistem karena gangguan koneksi. Silakan coba kembali beberapa saat lagi.",
          role,
          roleTitle: roleConfig.title,
        });
      }
    }

    // 4. FETCH AUTHORIZED DATABASE CONTEXT FOR GENERAL QUERIES
    const contextData = await getAuthorizedChatbotContext(role, userId);

    // 5. GENERATE DYNAMIC SYSTEM PROMPT
    const systemPrompt = generateSystemPrompt(contextData);

    // 6. PREPARE API MESSAGES
    const historyMessages: AiMessage[] = messages
      .slice(-6)
      .map((m: { role: string; content: string }) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      }));

    // 7. CALL AI PROVIDER (Google Gemini or OpenAI)
    const aiResult = await AiService.generateChat(
      historyMessages,
      systemPrompt,
      targetProvider
    );

    let assistantMessage = aiResult.text;
    const activeProvider = aiResult.provider;
    const activeModel = aiResult.model;

    // Fallback if AI call failed completely
    if (!assistantMessage) {
      assistantMessage = getSmartFallback(cleanQuery, role, contextData);
    }

    // 8. POST-PROCESS RESPONSE
    assistantMessage = postProcessResponse(assistantMessage);

    const durationMs = Math.round(performance.now() - startTime);
    logChatbotActivity({
      userId,
      role,
      intent: "GENERAL_CONVERSATION",
      backendFunction: `${activeProvider}:${activeModel}`,
      durationMs,
      status: aiResult.status === "error" ? "ERROR" : "SUCCESS",
      errorCategory: aiResult.error,
      querySnippet: cleanQuery,
    });

    // 9. LOG TO DATABASE (AiChatLog)
    try {
      await prisma.aiChatLog.create({
        data: {
          userId: userId || null,
          query: cleanQuery,
          response: assistantMessage,
        },
      });
    } catch (logErr) {
      console.error("AiChatLog create error:", logErr);
    }

    return NextResponse.json({
      message: assistantMessage,
      role,
      roleTitle: roleConfig.title,
      provider: activeProvider,
      model: activeModel,
      status: aiResult.status,
    });
  } catch (error) {
    const durationMs = Math.round(performance.now() - startTime);
    logChatbotActivity({
      role: "UNKNOWN",
      intent: "UNKNOWN",
      backendFunction: "POST",
      durationMs,
      status: "ERROR",
      errorCategory: "UNHANDLED_EXCEPTION",
    });
    console.error("Chatbot POST error:", error);
    return NextResponse.json({
      message:
        "Mohon maaf, layanan asisten sedang mengalami gangguan sesaat. Silakan coba kembali beberapa saat lagi.",
    });
  }
}

function getSmartFallback(
  query: string,
  role: ChatRole,
  contextData: ChatbotContextData
): string {
  const lower = query.toLowerCase().trim();

  // 1. Mengenali Pengguna (Identity & Profile Recognition)
  if (
    lower.includes("saya siapa") ||
    lower.includes("siapa saya") ||
    lower.includes("nama saya") ||
    lower.includes("profil saya") ||
    lower.includes("akun saya") ||
    lower.includes("info akun") ||
    lower.includes("data saya") ||
    lower.includes("role saya") ||
    lower.includes("peran saya") ||
    lower.includes("siapa yang login") ||
    lower.includes("siapa yang sedang login")
  ) {
    const config = getRoleConfig(role);
    if (role === "GUEST" || !contextData.userName) {
      return (
        `👤 **Status Pengguna: Tamu / Pengunjung Publik**\n\n` +
        `Anda saat ini belum masuk ke akun. Silakan [masuk / login ke akun Anda](/login) untuk mengakses layanan dan informasi pribadi Anda.`
      );
    }
    return (
      `👤 **Identitas Pengguna Anda:**\n` +
      `• **Nama:** **${contextData.userName}**\n` +
      `• **Peran / Role:** **${config.title}** (\`${role}\` — ${config.badge})\n\n` +
      `Berikut ringkasan data aktual terkait peran dan tugas Anda di sistem:\n\n${contextData.contextText}`
    );
  }

  // 2. Mengenali Chatbot
  if (lower.includes("siapa kamu") || lower.includes("siapa anda") || lower.includes("kamu siapa")) {
    const config = getRoleConfig(role);
    return `Halo! Saya **${config.title}** di Sistem Pelayanan Desa Perum. Saya bertugas mendampingi Anda sesuai wewenang role **${config.badge}**.`;
  }

  // 3. Antrean & Berkas Perlu Diproses
  if (
    lower.includes("antrean") ||
    lower.includes("antrian") ||
    lower.includes("proses") ||
    lower.includes("perlu diproses") ||
    lower.includes("ditindaklanjuti")
  ) {
    if (role === "WARGA") {
      return `Berikut informasi status pengajuan berkas milik Anda:\n\n${contextData.contextText}`;
    }
    return `Berikut pantauan antrean pengajuan pelayanan dari database sistem:\n\n${contextData.contextText}`;
  }

  // 4. Layanan Surat & Persyaratan
  if (
    lower.includes("layanan") ||
    lower.includes("surat") ||
    lower.includes("syarat") ||
    lower.includes("persyaratan") ||
    lower.includes("sktm") ||
    lower.includes("sku") ||
    lower.includes("domisili")
  ) {
    return `Berikut informasi jenis layanan dan persyaratan administrasi desa:\n\n${contextData.contextText}`;
  }

  // 5. Data Pengguna & Kependudukan
  if (
    lower.includes("pengguna") ||
    lower.includes("user") ||
    lower.includes("akun") ||
    lower.includes("warga") ||
    lower.includes("penduduk") ||
    lower.includes("masyarakat") ||
    lower.includes("keseruhan") ||
    lower.includes("keseluruhan") ||
    lower.includes("total") ||
    lower.includes("jumlah") ||
    lower.includes("rekap") ||
    lower.includes("data pengguna")
  ) {
    if (role === "WARGA" || role === "GUEST") {
      return "🛡️ Informasi statistik kependudukan dan data pengguna sistem hanya dapat diakses oleh aparatur atau staf pelayanan desa yang berwenang.";
    }
    return `Berikut data pengguna, antrean pelayanan, dan statistik sistem aktual dari database:\n\n${contextData.contextText}`;
  }

  // 6. Role-specific reports
  if (role === "SUPERVISOR" && (lower.includes("statistik") || lower.includes("ringkasan") || lower.includes("laporan") || lower.includes("sla"))) {
    return `Berikut ringkasan data pengawasan pelayanan aktual dari database:\n\n${contextData.contextText}`;
  }

  if (role === "WARGA" && (lower.includes("status") || lower.includes("pengajuan saya") || lower.includes("berkas saya"))) {
    return `Berikut informasi status berkas pengajuan Anda:\n\n${contextData.contextText}`;
  }

  if (role === "KEPALA_DESA" && (lower.includes("laporan") || lower.includes("eksekutif") || lower.includes("approval") || lower.includes("tanda tangan"))) {
    return `Berikut ringkasan eksekutif untuk Bapak/Ibu Kepala Desa:\n\n${contextData.contextText}`;
  }

  // Default smart guidance — PENTING: Jangan pernah kembalikan pesan sambutan umum (welcome message)
  // sebagai respons terhadap pertanyaan pengguna!
  return (
    `Mohon maaf, saya belum menemukan data spesifik terkait pertanyaan: *"${query}"*.\n\n` +
    `💡 **Anda dapat menanyakan hal-hal berikut seputar data aktual sistem:**\n` +
    `• *"Pengajuan apa saja yang perlu diverifikasi?"* — Menampilkan daftar berkas antrean verifikasi\n` +
    `• *"Berapa jumlah warga yang terdaftar?"* — Rekapitulasi data kependudukan (lanjutkan dengan *"Siapa saja?"*)\n` +
    `• *"Berapa pengajuan SKTM?"* — Statistik surat tertentu (lanjutkan dengan *"Siapa nama pemohonnya?"*)\n` +
    `• *"Mana yang sudah disetujui?"* — Melihat pengajuan berstatus disetujui\n` +
    `• *"Berapa jumlah staf desa?"* — Informasi aparatur pelayanan (lanjutkan dengan *"Apa tugas mereka?"*)\n` +
    `• *"Berapa pengajuan bulan ini?"* — Statistik pelayanan bulanan (lanjutkan dengan *"Bagaimana kalau bulan lalu?"*)`
  );
}
