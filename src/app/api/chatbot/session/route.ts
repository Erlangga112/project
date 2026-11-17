import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getRoleConfig, ChatRole } from "@/lib/chatbot/roles";
import { clearSessionState } from "@/lib/chatbot/memory";
import { resolveActivePage } from "@/lib/chatbot/page-context";
import { AiService } from "@/lib/ai/service";

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const sessionKey = session?.user?.id ? `user:${session.user.id}` : "guest";
    clearSessionState(sessionKey);
    return NextResponse.json({ success: true, message: "Konteks percakapan berhasil direset." });
  } catch (error) {
    console.error("Reset session context error:", error);
    return NextResponse.json({ error: "Gagal mereset konteks" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const rawPath = searchParams.get("path") || undefined;

    if (session && session.user) {
      const userRole = (session.user.role || "WARGA") as ChatRole;
      const config = getRoleConfig(userRole);
      const pageInfo = resolveActivePage(userRole, { pathname: rawPath });

      let personalizedWelcome = config.welcomeMessage;
      const userName = session.user.name;

      if (userName) {
        if (userRole === "STAF_DESA") {
          personalizedWelcome = `Halo, Bapak/Ibu **${userName}**! 📋 Saya **Asisten Operator Pelayanan Desa**. Saya siap membantu Anda memantau seluruh antrean pengajuan yang perlu diproses, menjelaskan SOP verifikasi, dan mengelola data pelayanan desa.`;
        } else if (userRole === "WARGA") {
          personalizedWelcome = `Halo, Bapak/Ibu **${userName}**! 👋 Selamat datang di ruang pelayanan mandiri. Saya **Asisten Pelayanan Desa**. Saya siap membantu Anda membuat surat desa (**SKTM**, **Domisili**, **SKU**), mengecek status berkas Anda, serta panduan cetak surat resmi.`;
        } else if (userRole === "SUPERVISOR") {
          personalizedWelcome = `Selamat bertugas, Bapak/Ibu **${userName}**! 📊 Saya **Asisten Supervisor Pelayanan**. Saya siap menyajikan analisis data pelayanan, deteksi SLA berkas tertunda, dan statistik kependudukan sistem.`;
        } else if (userRole === "KEPALA_DESA") {
          personalizedWelcome = `Selamat datang, Bapak/Ibu **${userName}** (Kepala Desa). 🏛️ Saya **Asisten Kepala Desa**. Saya siap menyajikan ringkasan eksekutif dan dokumen yang menunggu persetujuan / tanda tangan Anda.`;
        }
      }

      // Gabungkan suggestions default dengan pertanyaan kontekstual seputar fitur dashboard
      const contextualSuggestions = [
        "Ada berapa fitur?",
        ...config.suggestions.slice(0, 3),
      ];

      return NextResponse.json(
        {
          authenticated: true,
          user: {
            id: session.user.id,
            name: session.user.name,
            role: userRole,
          },
          roleTitle: config.title,
          roleBadge: config.badge,
          welcomeMessage: personalizedWelcome,
          suggestions: contextualSuggestions,
          availableProviders:
            userRole === "SUPERVISOR"
              ? AiService.getAvailableProviders().map((p) => ({
                  id: p.id,
                  name: p.name,
                  model: p.model,
                  isConfigured: p.isConfigured,
                  isDefault: p.id === "openai",
                }))
              : [],
          activePage: {
            pathname: pageInfo.pathname,
            pageName: pageInfo.pageName,
            dashboardName: pageInfo.dashboardName,
            moduleName: pageInfo.moduleName,
            availableFeatures: pageInfo.features.map((f) => ({
              id: f.id,
              name: f.name,
              route: f.route,
            })),
          },
        },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    const guestConfig = getRoleConfig("GUEST");
    const guestPageInfo = resolveActivePage("GUEST", { pathname: rawPath });

    return NextResponse.json(
      {
        authenticated: false,
        user: null,
        roleTitle: guestConfig.title,
        roleBadge: guestConfig.badge,
        welcomeMessage: guestConfig.welcomeMessage,
        suggestions: [
          "Ada berapa fitur?",
          ...guestConfig.suggestions.slice(0, 3),
        ],
        activePage: {
          pathname: guestPageInfo.pathname,
          pageName: guestPageInfo.pageName,
          dashboardName: guestPageInfo.dashboardName,
          moduleName: guestPageInfo.moduleName,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Chatbot session error:", error);
    const fallbackConfig = getRoleConfig("GUEST");
    return NextResponse.json(
      {
        authenticated: false,
        user: null,
        roleTitle: fallbackConfig.title,
        roleBadge: fallbackConfig.badge,
        welcomeMessage: fallbackConfig.welcomeMessage,
        suggestions: fallbackConfig.suggestions,
      },
      { status: 500 }
    );
  }
}
