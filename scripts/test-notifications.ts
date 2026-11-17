import "dotenv/config";
import { validateAndNormalizeIndonesianPhone } from "../src/lib/notifications/phone-utils";
import { generateEmailHtml, sendGmail, verifyGmailConnection } from "../src/lib/notifications/email.service";
import { sendWhatsAppMessage, verifyWhatsAppConfig } from "../src/lib/notifications/whatsapp.service";
import { NotificationOrchestrator } from "../src/lib/notifications/notification.service";
import prisma from "../src/lib/prisma";

async function runTests() {
  console.log("=== STARTING NOTIFICATION SYSTEM AUDIT & UNIT TESTS ===\n");

  // 1. Test Phone Validation & Normalization
  console.log("[TEST 1] Testing Indonesian Phone Validation & Normalization...");
  const phoneCases = [
    { input: "081234567890", expectedValid: true, expectedE164: "6281234567890" },
    { input: "+6281234567890", expectedValid: true, expectedE164: "6281234567890" },
    { input: "62812-3456-7890", expectedValid: true, expectedE164: "6281234567890" },
    { input: "0819 8765 4321", expectedValid: true, expectedE164: "6281987654321" },
    { input: "021-1234567", expectedValid: false }, // Landline (bukan seluler 08)
    { input: "12345", expectedValid: false }, // Terlalu pendek
    { input: "+1 555-1234567", expectedValid: false }, // Bukan Indonesia
  ];

  for (const tc of phoneCases) {
    const res = validateAndNormalizeIndonesianPhone(tc.input);
    if (res.isValid === tc.expectedValid && (!tc.expectedE164 || res.formattedE164 === tc.expectedE164)) {
      console.log(`  ✓ PASSED: "${tc.input}" -> isValid=${res.isValid}, formatted="${res.formattedE164}"`);
    } else {
      console.error(`  ✗ FAILED: "${tc.input}" -> got isValid=${res.isValid}, expected ${tc.expectedValid}`);
      process.exit(1);
    }
  }

  // 2. Test Email HTML Generation
  console.log("\n[TEST 2] Testing Email HTML Template Generator...");
  const html = generateEmailHtml({
    wargaNama: "Budi Santoso",
    nomorPengajuan: "REQ-261020-0001",
    jenisLayanan: "Surat Keterangan Usaha",
    statusBadgeText: "DIPERIKSA",
    statusBadgeColor: "#0D9488",
    pesanUtama: "Pengajuan Anda sedang diperiksa oleh staf.",
    langkahBerikutnya: "Tunggu hasil verifikasi.",
    waktuPembaruan: "Senin, 20 Oktober 2026",
  });

  if (
    html.includes("Budi Santoso") &&
    html.includes("REQ-261020-0001") &&
    html.includes("Surat Keterangan Usaha") &&
    !html.includes("undefined")
  ) {
    console.log("  ✓ PASSED: Email HTML generated with required metadata and clean styling.");
  } else {
    console.error("  ✗ FAILED: Email HTML template is missing required content.");
    process.exit(1);
  }

  // 3. Test Service Configuration Checks (When env vars are empty/placeholder)
  console.log("\n[TEST 3] Testing Configuration Verifiers (Safe Fallback)...");
  const gmailCheck = await verifyGmailConnection();
  console.log(`  Gmail Config Check: isConfigured=${gmailCheck.isConfigured}, status="${gmailCheck.error || 'Connected'}"`);

  const waCheck = await verifyWhatsAppConfig();
  console.log(`  WhatsApp Config Check: isConfigured=${waCheck.isConfigured}, status="${waCheck.error || 'Connected'}"`);

  // 4. Test Notification Dispatch Handling & RFC 2606 Interception
  console.log("\n[TEST 4] Testing Interception of Placeholder Domains & Missing Email...");
  const placeholderRes = await sendGmail({
    to: "test@example.com",
    subject: "Test Subject",
    html: "<p>Test</p>",
    event: "TEST_SIMULASI",
  });
  console.log(`  sendGmail placeholder result: status=${placeholderRes.status}, error="${placeholderRes.error}"`);
  if (placeholderRes.status === "SKIPPED") {
    console.log("  ✓ PASSED: Placeholder domain test@example.com was safely intercepted before SMTP!");
  } else {
    console.error("  ✗ FAILED: Placeholder domain was not intercepted!");
    process.exit(1);
  }

  const emptyRes = await sendGmail({
    to: "",
    subject: "Empty Email Test",
    html: "<p>Test</p>",
    event: "TEST_SIMULASI",
  });
  if (emptyRes.status === "FAILED") {
    console.log("  ✓ PASSED: Empty email was rejected safely without leaking data.");
  } else {
    console.error("  ✗ FAILED: Empty email was not rejected!");
    process.exit(1);
  }

  const waRes = await sendWhatsAppMessage({
    to: "081234567890",
    message: "Test WA Message",
    event: "TEST_SIMULASI",
  });
  console.log(`  sendWhatsAppMessage result status: ${waRes.status} (expected: SKIPPED when token is empty)`);

  // 5. Test Database NotificationLog & Idempotency
  console.log("\n[TEST 5] Testing Database NotificationLog & Idempotency Key...");
  const testerEmail = process.env.TEST_RECIPIENT_EMAIL?.trim() || "michitaka455@gmail.com";
  const testIdempotencyKey = `TEST_IDEMP_${Date.now()}`;
  
  // First attempt: should create log
  const log1 = await NotificationOrchestrator.dispatchEmail({
    to: testerEmail,
    recipientName: "Penguji Sistem",
    subject: "Uji Coba Idempotensi",
    html: "<p>Uji Coba Idempotensi</p>",
    text: "Uji Coba Idempotensi",
    event: "TEST_SIMULASI",
    idempotencyKey: testIdempotencyKey,
  });
  console.log(`  First dispatch log ID: ${log1.id}, status: ${log1.status}`);

  // Simulasikan status log menjadi SENT untuk menguji idempotensi
  await prisma.notificationLog.update({
    where: { id: log1.id },
    data: { status: "SENT", providerMessageId: "MOCK-MSG-ID-123" },
  });

  // Second attempt with same key: should be idempotent and return existing without duplicating
  const log2 = await NotificationOrchestrator.dispatchEmail({
    to: testerEmail,
    recipientName: "Penguji Sistem",
    subject: "Uji Coba Idempotensi",
    html: "<p>Uji Coba Idempotensi</p>",
    text: "Uji Coba Idempotensi",
    event: "TEST_SIMULASI",
    idempotencyKey: testIdempotencyKey,
  });

  if (log1.id === log2.id && log2.status === "SENT") {
    console.log("  ✓ PASSED: Idempotency check prevented duplicate notification successfully!");
  } else {
    console.error("  ✗ FAILED: Idempotency failed.");
    process.exit(1);
  }

  // Cleanup test log
  await prisma.notificationLog.delete({ where: { id: log1.id } });
  console.log("  ✓ Test log cleaned up.");

  console.log("\n=== ALL NOTIFICATION SYSTEM TESTS PASSED SUCCESSFULLY! ===");
}

runTests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
