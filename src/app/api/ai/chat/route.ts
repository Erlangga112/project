import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { AiService } from "@/lib/ai/service";
import { FAQ_KNOWLEDGE_BASE } from "@/lib/ai/faq";
import { ChatRole } from "@/lib/chatbot/roles";
import { getSessionState } from "@/lib/chatbot/memory";
import { resolveContextualQuestion } from "@/lib/chatbot/context-resolver";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  // Logged-in user is optional for AI, but let's restrict to logged-in users to prevent abuse
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const query = (body.query || body.messages?.[body.messages.length - 1]?.content || "").trim();
    if (!query) return NextResponse.json({ error: "Pertanyaan tidak boleh kosong" }, { status: 400 });

    const messages = Array.isArray(body.messages) ? body.messages : [{ role: "user", content: query }];
    const role: ChatRole = (session.user.role as ChatRole) || "WARGA";
    const sessionKey = `user:${session.user.id}`;
    const sessionState = getSessionState(sessionKey, messages);

    // Cek apakah pertanyaan dapat diselesaikan lewat Context Resolver
    const contextualResult = await resolveContextualQuestion(
      query,
      sessionState,
      role,
      session.user.id,
      sessionKey
    );

    if (contextualResult.handled && contextualResult.response) {
      await prisma.aiChatLog.create({
        data: {
          userId: session.user.id,
          query,
          response: contextualResult.response,
        },
      });
      return NextResponse.json({ response: contextualResult.response });
    }

    // 1. Context Retrieval
    const layananList = await prisma.jenisLayanan.findMany({
      where: { isActive: true },
      select: { nama: true, deskripsi: true, persyaratan: true, estimasiWaktu: true }
    });

    let contextLayanan = "Daftar Layanan yang Tersedia di Sistem:\n";
    for (const layanan of layananList) {
      let reqs = [];
      try { reqs = JSON.parse(layanan.persyaratan); } catch { /* ignore */ }
      contextLayanan += `- ${layanan.nama}\n  Deskripsi: ${layanan.deskripsi || '-'}\n  Syarat: ${reqs.join(', ')}\n  Estimasi: ${layanan.estimasiWaktu} hari\n\n`;
    }

    // 2. Build System Prompt
    const systemPrompt = `[ATURAN MUTLAK DAN TIDAK BOLEH DILANGGAR]: 
1. KAMU DILARANG KERAS MENULIS KODE PEMROGRAMAN (CODING), SCRIPT, ATAU PERINTAH TEKNIS APAPUN.
2. KAMU HANYA BOLEH MENJAWAB PERTANYAAN TENTANG PELAYANAN DAN ADMINISTRASI DESA.
3. JIKA PENGGUNA MEMINTA HAL DI LUAR KONTEKS DESA (SEPERTI CODING, RESEP, MATEMATIKA), TOLAK DENGAN TEGAS: "Mohon maaf, saya hanya Asisten AI yang bertugas melayani informasi terkait layanan dan administrasi desa. Saya tidak dapat menjawab pertanyaan tersebut."

Kamu adalah Asisten AI Pelayanan Desa yang ramah dan membantu.
Tugas utama kamu: menjawab pertanyaan warga terkait persyaratan layanan, alur pengajuan, dan informasi umum pelayanan desa.

Data Knowledge Base (Pelayanan):
${contextLayanan}

FAQ Umum:
${FAQ_KNOWLEDGE_BASE}

Aturan Ketat:
1. JANGAN PERNAH menyetujui, menjanjikan, atau mengubah status pengajuan. Kamu bukan pengambil keputusan.
2. Gunakan bahasa Indonesia yang sopan dan mudah dipahami.
3. KAMU HANYA BOLEH MENJAWAB PERTANYAAN SEPUTAR LAYANAN DESA DAN INFORMASI DESA. Jika ditanya hal di luar konteks ini (seperti matematika, coding, politik, dll) tolak dengan tegas dan sopan: "Mohon maaf, saya hanya Asisten AI yang bertugas melayani informasi terkait layanan dan administrasi desa. Saya tidak dapat menjawab pertanyaan tersebut."
4. Jangan mengarang persyaratan sendiri. Jika informasi tidak ada di konteks, arahkan untuk datang ke kantor desa.`;

    // 3. Ask AI
    const response = await AiService.ask(query, systemPrompt);

    // 4. Log the query
    await prisma.aiChatLog.create({
      data: {
        userId: session.user.id,
        query,
        response
      }
    });

    return NextResponse.json({ response });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
