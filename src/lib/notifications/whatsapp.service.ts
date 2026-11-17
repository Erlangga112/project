import { validateAndNormalizeIndonesianPhone } from "./phone-utils";
import { SendWhatsAppPayload, SendWhatsAppResult } from "./types";

/**
 * Mendapatkan konfigurasi WhatsApp (Fonnte API atau Meta Cloud API) dari Environment Variables
 */
export function getWhatsAppConfig() {
  const fonnteToken =
    process.env.FOONTE_API_TOKEN?.trim() ||
    process.env.FONNTE_TOKEN?.trim() ||
    process.env.FOONTE_TOKEN?.trim() ||
    process.env.FONNTE_API_TOKEN?.trim() ||
    null;
  const fonnteApiUrl =
    process.env.FONNTE_API_URL?.trim() ||
    process.env.FOONTE_API_URL?.trim() ||
    "https://api.fonnte.com/send";
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() || null;
  const apiVersion = process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";

  const isFonnteConfigured = Boolean(fonnteToken);
  const isMetaConfigured = Boolean(accessToken && phoneNumberId);
  const isConfigured = isFonnteConfigured || isMetaConfigured;
  const activeProvider = isFonnteConfigured ? "FONNTE" : isMetaConfigured ? "META" : "NONE";

  return {
    isConfigured,
    activeProvider,
    fonnteToken,
    fonnteApiUrl,
    accessToken,
    phoneNumberId,
    businessAccountId,
    apiVersion,
  };
}

/**
 * Periksa koneksi dan validitas kredensial WhatsApp (Fonnte atau Meta)
 */
export async function verifyWhatsAppConfig(): Promise<{
  isConfigured: boolean;
  activeProvider: "FONNTE" | "META" | "NONE";
  phoneNumberId: string | null;
  businessAccountId: string | null;
  apiVersion: string;
  hasAccessToken: boolean;
  hasFonnteToken: boolean;
  verifiedName?: string;
  displayPhoneNumber?: string;
  error?: string;
}> {
  const config = getWhatsAppConfig();

  // 1. Cek jika menggunakan provider FONNTE
  if (config.fonnteToken) {
    try {
      const fonnteDeviceUrl = config.fonnteApiUrl.replace(/\/send$/, "/device");
      const fonnteRes = await fetch(fonnteDeviceUrl, {
        method: "POST",
        headers: {
          Authorization: config.fonnteToken,
        },
        signal: AbortSignal.timeout(10000),
      });

      const data = await fonnteRes.json();
      if (data.status === true || data.status === "success" || data.device) {
        return {
          isConfigured: true,
          activeProvider: "FONNTE",
          phoneNumberId: config.phoneNumberId || null,
          businessAccountId: config.businessAccountId,
          apiVersion: config.apiVersion,
          hasAccessToken: Boolean(config.accessToken),
          hasFonnteToken: true,
          verifiedName: data.name || data.device || "Akun Fonnte WhatsApp Terhubung",
          displayPhoneNumber: data.device || undefined,
        };
      } else {
        const safeReason = data.reason || data.message || "Token Fonnte tidak valid atau perangkat terputus";
        return {
          isConfigured: false,
          activeProvider: "FONNTE",
          phoneNumberId: config.phoneNumberId || null,
          businessAccountId: config.businessAccountId,
          apiVersion: config.apiVersion,
          hasAccessToken: Boolean(config.accessToken),
          hasFonnteToken: true,
          error: `Fonnte Error: ${safeReason}`,
        };
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        isConfigured: false,
        activeProvider: "FONNTE",
        phoneNumberId: config.phoneNumberId || null,
        businessAccountId: config.businessAccountId,
        apiVersion: config.apiVersion,
        hasAccessToken: Boolean(config.accessToken),
        hasFonnteToken: true,
        error: `Koneksi ke Fonnte API gagal: ${errMsg}`,
      };
    }
  }

  // 2. Cek jika menggunakan provider META Cloud API
  if (config.accessToken && config.phoneNumberId) {
    try {
      const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg = data?.error?.message || response.statusText;
        return {
          isConfigured: false,
          activeProvider: "META",
          phoneNumberId: config.phoneNumberId,
          businessAccountId: config.businessAccountId,
          apiVersion: config.apiVersion,
          hasAccessToken: true,
          hasFonnteToken: false,
          error: `Meta Cloud API Error (${data?.error?.code || response.status}): ${errMsg}`,
        };
      }

      return {
        isConfigured: true,
        activeProvider: "META",
        phoneNumberId: config.phoneNumberId,
        businessAccountId: config.businessAccountId,
        apiVersion: config.apiVersion,
        hasAccessToken: true,
        hasFonnteToken: false,
        verifiedName: data?.verified_name,
        displayPhoneNumber: data?.display_phone_number,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        isConfigured: false,
        activeProvider: "META",
        phoneNumberId: config.phoneNumberId,
        businessAccountId: config.businessAccountId,
        apiVersion: config.apiVersion,
        hasAccessToken: true,
        hasFonnteToken: false,
        error: `Koneksi ke Meta WhatsApp API gagal: ${errMsg}`,
      };
    }
  }

  // 3. Belum ada provider yang dikonfigurasi
  return {
    isConfigured: false,
    activeProvider: "NONE",
    phoneNumberId: null,
    businessAccountId: null,
    apiVersion: config.apiVersion,
    hasAccessToken: false,
    hasFonnteToken: false,
    error: "FONNTE_TOKEN atau Kredensial Meta WhatsApp Cloud API belum dikonfigurasi di file .env",
  };
}

/**
 * Kirim pesan WhatsApp melalui Fonnte API atau Meta WhatsApp Cloud API
 */
export async function sendWhatsAppMessage(payload: SendWhatsAppPayload): Promise<SendWhatsAppResult> {
  const { to, message, templateName, templateLanguage } = payload;

  // 1. Validasi nomor telepon
  const phoneValidation = validateAndNormalizeIndonesianPhone(to);
  if (!phoneValidation.isValid) {
    return {
      success: false,
      status: "FAILED",
      error: phoneValidation.error || "Nomor WhatsApp tidak valid",
    };
  }

  const recipientE164 = phoneValidation.formattedE164;
  const config = getWhatsAppConfig();

  // 2. Periksa kelengkapan konfigurasi
  if (!config.isConfigured) {
    return {
      success: false,
      status: "SKIPPED",
      error: "WhatsApp API belum aktif: FONNTE_TOKEN atau WHATSAPP_ACCESS_TOKEN belum dikonfigurasi pada environment variables.",
    };
  }

  // 3. JIKA FONNTE DIKONFIGURASI: Kirim melalui FONNTE API
  if (config.fonnteToken) {
    try {
      const res = await fetch(config.fonnteApiUrl, {
        method: "POST",
        headers: {
          Authorization: config.fonnteToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: recipientE164,
          message: message,
          countryCode: "62",
        }),
        signal: AbortSignal.timeout(15000),
      });

      const data = await res.json();
      if (data.status === true || data.status === "success" || data.status === 200) {
        const messageId = Array.isArray(data.id) ? data.id[0] : (data.id || `FONNTE-${Date.now()}`);
        return {
          success: true,
          status: "SENT",
          messageId: String(messageId),
        };
      } else {
        const errMsg = data.reason || data.message || "Fonnte API menolak pengiriman pesan";
        return {
          success: false,
          status: "FAILED",
          error: `Fonnte Error: ${errMsg}`,
        };
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        status: "FAILED",
        error: `Pengiriman Fonnte ke ${recipientE164} gagal: ${errMsg}`,
      };
    }
  }

  // 4. JIKA META CLOUD API DIKONFIGURASI: Kirim melalui Meta Cloud API resmi
  if (config.accessToken && config.phoneNumberId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let bodyPayload: any;

    if (templateName) {
      bodyPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipientE164,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: templateLanguage || "id",
          },
        },
      };
    } else {
      bodyPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipientE164,
        type: "text",
        text: {
          preview_url: false,
          body: message,
        },
      };
    }

    const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg = data?.error?.message || response.statusText;
        const errCode = data?.error?.code || response.status;
        return {
          success: false,
          status: "FAILED",
          error: `Meta Cloud API Error [${errCode}]: ${errMsg}`,
        };
      }

      const messageId = data?.messages?.[0]?.id;
      if (messageId) {
        return {
          success: true,
          status: "SENT",
          messageId,
        };
      }

      return {
        success: false,
        status: "FAILED",
        error: "Meta API tidak mengembalikan ID pesan yang valid.",
      };
    } catch (err: unknown) {
      const rawError = err instanceof Error ? err.message : String(err);
      const safeError = config.accessToken ? rawError.replace(new RegExp(config.accessToken, "gi"), "******") : rawError;

      return {
        success: false,
        status: "FAILED",
        error: `Pengiriman WhatsApp ke ${recipientE164} gagal: ${safeError}`,
      };
    }
  }

  return {
    success: false,
    status: "SKIPPED",
    error: "Provider WhatsApp tidak ditemukan.",
  };
}
