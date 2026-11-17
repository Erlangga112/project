import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { AiService } from "@/lib/ai/service";
import { AiProviderType } from "@/lib/ai/types";

export async function GET(request: NextRequest) {
  try {
    let isSupervisor = false;
    try {
      const session = await getServerSession(authOptions);
      isSupervisor = session?.user?.role === "SUPERVISOR";
    } catch {
      // Abaikan jika dipanggil di luar session context
    }

    const { searchParams } = new URL(request.url);
    const providerParam = searchParams.get("provider") as AiProviderType | null;

    // Hanya uji provider tertentu jika dispesifikasikan agar respons cepat
    if (providerParam) {
      const status = await AiService.testConnection(providerParam);
      return NextResponse.json({
        provider: providerParam,
        status,
        timestamp: new Date().toISOString(),
      });
    }

    // Jika tidak dispesifikasikan, periksa seluruh provider (berguna untuk supervisor)
    const [geminiStatus, openAiStatus, deepseekStatus, groqStatus] =
      await Promise.all([
        AiService.testConnection("gemini"),
        AiService.testConnection("openai"),
        AiService.testConnection("deepseek"),
        AiService.testConnection("groq"),
      ]);

    return NextResponse.json({
      providers: {
        gemini: geminiStatus,
        openai: openAiStatus,
        deepseek: deepseekStatus,
        groq: groqStatus,
      },
      availableList: AiService.getAvailableProviders(),
      isSupervisor: session?.user?.role === "SUPERVISOR",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Provider status error:", error);
    return NextResponse.json(
      { error: "Gagal memeriksa status provider AI" },
      { status: 500 }
    );
  }
}

