import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import { verifyGmailConnection } from "@/lib/notifications/email.service";
import { verifyWhatsAppConfig } from "@/lib/notifications/whatsapp.service";
import { validateAndNormalizeIndonesianPhone } from "@/lib/notifications/phone-utils";

/**
 * GET: Mengambil status konfigurasi Gmail, WhatsApp Cloud API, dan daftar kontak petugas
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (
    !session ||
    (session.user.role !== "STAF_DESA" &&
      session.user.role !== "SUPERVISOR" &&
      session.user.role !== "ADMIN")
  ) {
    return NextResponse.json({ error: "Forbidden. Hanya Staf/Supervisor/Admin yang dapat mengakses konfigurasi." }, { status: 403 });
  }

  try {
    // 1. Periksa Gmail
    const gmailStatus = await verifyGmailConnection();

    // 2. Periksa WhatsApp Cloud API / Foonte
    const whatsappStatus = await verifyWhatsAppConfig();

    // 3. Ambil daftar petugas (STAF_DESA, SUPERVISOR, KEPALA_DESA) beserta kontak WhatsApp mereka
    const staffUsers = await prisma.user.findMany({
      where: {
        role: {
          in: [Role.STAF_DESA, Role.SUPERVISOR, Role.KEPALA_DESA],
        },
      },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        petugasContact: true,
      },
      orderBy: {
        role: "asc",
      },
    });

    const staffContacts = staffUsers.map((u) => ({
      userId: u.id,
      nama: u.nama || "Tanpa Nama",
      email: u.email || "-",
      role: u.role,
      noWhatsapp: u.petugasContact?.noWhatsapp || null,
      isActive: u.petugasContact?.isActive ?? true,
      isVerified: u.petugasContact?.isVerified ?? false,
      notifyNewSubmission: u.petugasContact?.notifyNewSubmission ?? true,
      notifyPendingValidation: u.petugasContact?.notifyPendingValidation ?? true,
      notifyPendingApproval: u.petugasContact?.notifyPendingApproval ?? true,
    }));

    return NextResponse.json({
      gmail: {
        isConfigured: gmailStatus.isConfigured,
        user: gmailStatus.user,
        from: gmailStatus.from,
        error: gmailStatus.error || null,
      },
      whatsapp: {
        isConfigured: whatsappStatus.isConfigured,
        activeProvider: whatsappStatus.activeProvider,
        phoneNumberId: whatsappStatus.phoneNumberId,
        businessAccountId: whatsappStatus.businessAccountId,
        apiVersion: whatsappStatus.apiVersion,
        hasAccessToken: whatsappStatus.hasAccessToken,
        verifiedName: whatsappStatus.verifiedName || null,
        displayPhoneNumber: whatsappStatus.displayPhoneNumber || null,
        error: whatsappStatus.error || null,
      },
      staffContacts,
    });
  } catch (error) {
    console.error("GET /api/admin/notifications/config error:", error);
    return NextResponse.json({ error: "Gagal memuat status konfigurasi notifikasi" }, { status: 500 });
  }
}

/**
 * PUT: Memperbarui kontak WhatsApp staf atau kepala desa
 */
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "STAF_DESA" && session.user.role !== "SUPERVISOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId, noWhatsapp, isActive, isVerified, notifyNewSubmission, notifyPendingValidation, notifyPendingApproval } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId wajib diisi" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    let normalizedPhone: string | null = null;
    if (noWhatsapp && typeof noWhatsapp === "string" && noWhatsapp.trim()) {
      const validation = validateAndNormalizeIndonesianPhone(noWhatsapp);
      if (!validation.isValid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      normalizedPhone = validation.formattedE164;
    }

    const updatedContact = await prisma.petugasContact.upsert({
      where: { userId },
      update: {
        noWhatsapp: normalizedPhone || "",
        namaPetugas: user.nama || user.email || user.role,
        role: user.role,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        isVerified: isVerified !== undefined ? Boolean(isVerified) : false,
        notifyNewSubmission: notifyNewSubmission !== undefined ? Boolean(notifyNewSubmission) : true,
        notifyPendingValidation: notifyPendingValidation !== undefined ? Boolean(notifyPendingValidation) : true,
        notifyPendingApproval: notifyPendingApproval !== undefined ? Boolean(notifyPendingApproval) : true,
      },
      create: {
        userId,
        noWhatsapp: normalizedPhone || "",
        namaPetugas: user.nama || user.email || user.role,
        role: user.role,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        isVerified: isVerified !== undefined ? Boolean(isVerified) : false,
        notifyNewSubmission: notifyNewSubmission !== undefined ? Boolean(notifyNewSubmission) : true,
        notifyPendingValidation: notifyPendingValidation !== undefined ? Boolean(notifyPendingValidation) : true,
        notifyPendingApproval: notifyPendingApproval !== undefined ? Boolean(notifyPendingApproval) : true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Kontak WhatsApp petugas berhasil diperbarui",
      contact: updatedContact,
    });
  } catch (error) {
    console.error("PUT /api/admin/notifications/config error:", error);
    return NextResponse.json({ error: "Gagal menyimpan konfigurasi kontak" }, { status: 500 });
  }
}
