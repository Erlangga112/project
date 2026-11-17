import { NotificationChannel, NotificationDeliveryStatus, Role } from "@prisma/client";

export type NotificationEventType =
  | "PENGAJUAN_BARU"
  | "DIPERIKSA"
  | "PERLU_PERBAIKAN"
  | "MENUNGGU_VALIDASI"
  | "MENUNGGU_APPROVAL_KADES"
  | "DISETUJUI"
  | "DITOLAK"
  | "SELESAI"
  | "PENDAFTARAN_WARGA"
  | "TEST_SIMULASI";

export interface SendEmailPayload {
  to: string;
  recipientName?: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
  pengajuanId?: string;
  userId?: string;
  event: NotificationEventType;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  response?: string;
  accepted?: string[];
  rejected?: string[];
  error?: string;
  status: NotificationDeliveryStatus;
}

export interface SendWhatsAppPayload {
  to: string; // phone number in Indonesian format (+62 or 62)
  recipientName?: string;
  message: string;
  templateName?: string;
  templateLanguage?: string;
  idempotencyKey?: string;
  pengajuanId?: string;
  userId?: string;
  role?: Role;
  event: NotificationEventType;
}

export interface SendWhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
  status: NotificationDeliveryStatus;
}

export interface ConfigStatusResponse {
  gmail: {
    isConfigured: boolean;
    user: string | null;
    from: string | null;
    error?: string;
  };
  whatsapp: {
    isConfigured: boolean;
    activeProvider?: "FONNTE" | "META" | "NONE";
    phoneNumberId: string | null;
    businessAccountId: string | null;
    apiVersion: string;
    hasAccessToken: boolean;
    verifiedName?: string | null;
    displayPhoneNumber?: string | null;
    error?: string;
  };
  staffContacts: Array<{
    id: string;
    userId: string;
    nama: string;
    email: string;
    role: Role;
    noWhatsapp: string | null;
    isVerified: boolean;
    isActive: boolean;
    notifyNewSubmission: boolean;
    notifyPendingValidation: boolean;
    notifyPendingApproval: boolean;
  }>;
}
