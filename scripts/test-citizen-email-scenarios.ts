import "dotenv/config";
import prisma from "../src/lib/prisma";
import { NotificationOrchestrator } from "../src/lib/notifications/notification.service";

async function testCitizenEmailScenarios() {
  console.log("=== PENGUJIAN INTEGRITAS ALUR EMAIL WARGA & PENCEGAHAN BOUNCE ===\n");

  const validTesterEmail = process.env.TEST_RECIPIENT_EMAIL?.trim() || "michitaka455@gmail.com";

  // Case 1: Valid Citizen Email
  console.log("[KASUS 1] Pengujian Pengiriman Email Warga yang Valid...");
  const idempotencyKeyValid = `TEST_VALID_CITIZEN_${Date.now()}`;
  const logValid = await NotificationOrchestrator.dispatchEmail({
    to: validTesterEmail,
    recipientName: "Warga Terdaftar",
    subject: "Notifikasi Pelayanan Desa: [UJI COBA] Akun Valid",
    html: "<p>Uji coba akun valid</p>",
    text: "Uji coba akun valid",
    event: "TEST_SIMULASI",
    idempotencyKey: idempotencyKeyValid,
  });
  console.log(`  Hasil Kasus 1: status=${logValid.status}, messageId=${logValid.providerMessageId || "None"}`);
  if (logValid.status === "SENT") {
    console.log("  ✓ PASSED: Email akun valid berhasil diterima relay SMTP.");
  } else {
    console.error("  ✗ FAILED: Kasus 1 gagal.");
    process.exit(1);
  }

  // Case 2: Missing / Empty Citizen Email
  console.log("\n[KASUS 2] Pengujian Warga dengan Alamat Email Kosong di Database...");
  const idempotencyKeyEmpty = `TEST_EMPTY_CITIZEN_${Date.now()}`;
  const logEmpty = await NotificationOrchestrator.dispatchEmail({
    to: "",
    recipientName: "Warga Tanpa Email",
    subject: "Notifikasi Pelayanan Desa: Akun Tanpa Email",
    html: "<p>Uji coba tanpa email</p>",
    text: "Uji coba tanpa email",
    event: "TEST_SIMULASI",
    idempotencyKey: idempotencyKeyEmpty,
  });
  console.log(`  Hasil Kasus 2: status=${logEmpty.status}, error="${logEmpty.errorMessage}"`);
  if (logEmpty.status === "FAILED" && logEmpty.errorMessage?.includes("kosong")) {
    console.log("  ✓ PASSED: Email kosong dicegah dari pengiriman SMTP dan dicatat sebagai FAILED.");
  } else {
    console.error("  ✗ FAILED: Kasus 2 gagal dicegat.");
    process.exit(1);
  }

  // Case 3: Placeholder RFC 2606 Email (e.g. test@example.com)
  console.log("\n[KASUS 3] Pengujian Pencegahan Domain Placeholder (test@example.com)...");
  const idempotencyKeyPlaceholder = `TEST_PLACEHOLDER_${Date.now()}`;
  const logPlaceholder = await NotificationOrchestrator.dispatchEmail({
    to: "test@example.com",
    recipientName: "Akun Placeholder",
    subject: "Notifikasi Pelayanan Desa: Placeholder",
    html: "<p>Uji coba placeholder</p>",
    text: "Uji coba placeholder",
    event: "TEST_SIMULASI",
    idempotencyKey: idempotencyKeyPlaceholder,
  });
  console.log(`  Hasil Kasus 3: status=${logPlaceholder.status}, error="${logPlaceholder.errorMessage}"`);
  if (logPlaceholder.status === "SKIPPED" && logPlaceholder.errorMessage?.includes("Null MX")) {
    console.log("  ✓ PASSED: Domain example.com berhasil dicegat SEBELUM SMTP sehingga TIDAK TERJADI Null MX Bounce!");
  } else {
    console.error("  ✗ FAILED: Kasus 3 gagal dicegat.");
    process.exit(1);
  }

  // Case 4: Invalid Email Syntax (e.g. "budi-tidak-valid")
  console.log("\n[KASUS 4] Pengujian Format Email Rusak/Tidak Valid...");
  const idempotencyKeyInvalid = `TEST_INVALID_SYNTAX_${Date.now()}`;
  const logInvalid = await NotificationOrchestrator.dispatchEmail({
    to: "budi-bukan-email-valid",
    recipientName: "Warga Email Rusak",
    subject: "Notifikasi Pelayanan Desa: Format Rusak",
    html: "<p>Uji coba format rusak</p>",
    text: "Uji coba format rusak",
    event: "TEST_SIMULASI",
    idempotencyKey: idempotencyKeyInvalid,
  });
  console.log(`  Hasil Kasus 4: status=${logInvalid.status}, error="${logInvalid.errorMessage}"`);
  if (logInvalid.status === "FAILED") {
    console.log("  ✓ PASSED: Format tidak valid dicegat dan dicatat aman.");
  } else {
    console.error("  ✗ FAILED: Kasus 4 gagal dicegat.");
    process.exit(1);
  }

  // Cleanup test logs
  await prisma.notificationLog.deleteMany({
    where: {
      idempotencyKey: {
        in: [idempotencyKeyValid, idempotencyKeyEmpty, idempotencyKeyPlaceholder, idempotencyKeyInvalid],
      },
    },
  });
  console.log("\n  ✓ Data log pengujian telah dibersihkan.");

  console.log("\n=== SELURUH PENGUJIAN SKENARIO EMAIL WARGA BERHASIL 100%! ===");
}

testCitizenEmailScenarios()
  .catch((err) => {
    console.error("Pengujian skenario email gagal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
