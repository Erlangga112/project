import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  const logs = await prisma.notificationLog.findMany({
    where: { channel: "WHATSAPP" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  console.log(`=== AUDIT WHATSAPP LOGS (Found ${logs.length}) ===`);
  for (const l of logs) {
    console.log(`[${l.createdAt.toISOString()}] Event: ${l.event} | Status: ${l.status}`);
    console.log(`  Recipient: ${l.recipient} (${l.recipientName || "No Name"})`);
    console.log(`  Error: ${l.errorMessage || "None"}`);
    console.log(`  MsgId: ${l.providerMessageId || "None"}`);
    console.log(`  IdempotencyKey: ${l.idempotencyKey}`);
    console.log("------------------------------------------------");
  }

  // Also check ProfilWarga and their phone numbers
  const wargaList = await prisma.user.findMany({
    where: { role: "WARGA" },
    include: { profilWarga: true },
    take: 5,
  });
  console.log(`\n=== SAMPLE WARGA USERS (Total: ${wargaList.length}) ===`);
  for (const w of wargaList) {
    console.log(`- User: ${w.nama} (${w.email}), noTelepon: "${w.profilWarga?.noTelepon || ""}"`);
  }

  // Check Staff contacts
  const contacts = await prisma.petugasContact.findMany();
  console.log(`\n=== PETUGAS CONTACTS (Total: ${contacts.length}) ===`);
  for (const c of contacts) {
    console.log(`- [${c.role}] ${c.namaPetugas}: "${c.noWhatsapp}"`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

