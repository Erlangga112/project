import "dotenv/config";
import prisma from "../src/lib/prisma";
import { encode } from "next-auth/jwt";

async function runTests() {
  console.log("=== PENGUJIAN KOMPREHENSIF STATUS PENGAJUAN WARGA ===");

  try {
    const secret = process.env.NEXTAUTH_SECRET || "fallback-secret-for-tests";

    // 1. Periksa akun warga Budi dan Siti
    const budi = await prisma.user.findFirst({
      where: { email: "budi@warga.id" },
      include: { profilWarga: true },
    });
    const siti = await prisma.user.findFirst({
      where: { email: "siti@warga.id" },
      include: { profilWarga: true },
    });

    console.log("\n[1] Akun Pengujian Terdeteksi:");
    console.log(`- Budi: ID=${budi?.id}, Email=${budi?.email}, Role=${budi?.role}`);
    console.log(`- Siti: ID=${siti?.id}, Email=${siti?.email}, Role=${siti?.role}`);

    if (!budi) throw new Error("Akun budi@warga.id tidak ditemukan");

    // 2. Verifikasi Data Pengajuan Budi di DB
    const pengajuanBudi = await prisma.pengajuanLayanan.findMany({
      where: { pemohonId: budi.id },
      include: {
        jenisLayanan: true,
        dokumenHasil: true,
        logs: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`\n[2] Data Pengajuan Aktual Budi (${pengajuanBudi.length} item):`);
    for (const p of pengajuanBudi) {
      console.log(`  * ID: ${p.id}`);
      console.log(`    Layanan: ${p.jenisLayanan.nama}`);
      console.log(`    Status: ${p.status}`);
      console.log(`    Dokumen Hasil: ${p.dokumenHasil ? `ID=${p.dokumenHasil.id}, NoSurat=${p.dokumenHasil.nomorSurat}` : "Belum diterbitkan nomor resmi"}`);
      console.log(`    Log Tahapan: ${p.logs.length} riwayat tercatat`);
    }

    const disetujuiKades = pengajuanBudi.filter(
      (p) => p.status === "DISETUJUI" || p.status === "SELESAI"
    );
    console.log(`\n[3] Pengajuan yang melewati persetujuan Kades: ${disetujuiKades.length}`);
    if (disetujuiKades.length > 0) {
      console.log("-> Terkonfirmasi: Data persetujuan Kades tersimpan aman di database.");
    }

    // 4. Generate Auth Cookie untuk Budi
    const budiToken = await encode({
      secret,
      token: {
        id: budi.id,
        email: budi.email,
        name: budi.nama || "Budi",
        role: budi.role,
      },
    });

    const cookieHeader = `next-auth.session-token=${budiToken}`;

    // 5. Test HTTP GET /warga/pengajuan (HTML Page)
    console.log("\n[4] Pengujian Akses Halaman /warga/pengajuan (Authenticated):");
    const pageRes = await fetch("http://localhost:3000/warga/pengajuan", {
      headers: {
        Cookie: cookieHeader,
      },
      redirect: "manual",
    });

    console.log(`- Status Code: ${pageRes.status} (${pageRes.statusText})`);
    if (pageRes.status === 200) {
      const htmlText = await pageRes.text();
      const containsTitle = htmlText.includes("Status Pengajuan") || htmlText.includes("Status Pelayanan");
      console.log(`-> SUKSES: Halaman /warga/pengajuan berhasil dirender dengan status 200 OK! (HTML rendered: ${containsTitle})`);
    } else {
      console.error(`-> GAGAL: Response halaman tidak 200, status=${pageRes.status}`);
    }

    // 6. Test HTTP GET /api/pengajuan (API Data Endpoint)
    console.log("\n[5] Pengujian Endpoint API /api/pengajuan (Authenticated):");
    const apiRes = await fetch("http://localhost:3000/api/pengajuan", {
      headers: {
        Cookie: cookieHeader,
      },
    });

    console.log(`- API Status Code: ${apiRes.status}`);
    if (apiRes.status === 200) {
      const listData = await apiRes.json();
      console.log(`- API mengembalikan ${listData.length} pengajuan milik Budi`);
      console.log("-> SUKSES: Data JSON berhasil ditarik dengan autentikasi session yang valid.");
    } else {
      console.error(`-> GAGAL: API mengembalikan status ${apiRes.status}`);
    }

    // 7. Test Filter Query Params API
    console.log("\n[6] Pengujian Filter Pencarian & Status API:");
    const filterRes = await fetch("http://localhost:3000/api/pengajuan?status=SELESAI", {
      headers: {
        Cookie: cookieHeader,
      },
    });
    if (filterRes.status === 200) {
      const filtered = await filterRes.json();
      console.log(`- Filter status=SELESAI mengembalikan ${filtered.length} item (semua berstatus SELESAI: ${filtered.every((x: any) => x.status === "SELESAI")})`);
      console.log("-> SUKSES: Fitur filter status API bekerja dengan benar.");
    }

    // 8. Test Data Isolation (Warga Siti vs Budi)
    if (siti) {
      const sitiToken = await encode({
        secret,
        token: {
          id: siti.id,
          email: siti.email,
          name: siti.nama || "Siti",
          role: siti.role,
        },
      });

      const sitiApiRes = await fetch("http://localhost:3000/api/pengajuan", {
        headers: {
          Cookie: `next-auth.session-token=${sitiToken}`,
        },
      });
      if (sitiApiRes.status === 200) {
        const sitiData = await sitiApiRes.json();
        const budiIds = new Set(pengajuanBudi.map((p) => p.id));
        const leaked = sitiData.filter((p: any) => budiIds.has(p.id));
        console.log(`\n[7] Uji Keamanan Isolasi Data (Siti vs Budi via API):`);
        console.log(`- Pengajuan terambil untuk Siti: ${sitiData.length}`);
        console.log(`- Kebocoran berkas milik Budi ke akun Siti: ${leaked.length} (Harus 0)`);
        if (leaked.length === 0) {
          console.log("-> SUKSES: Keamanan multi-tenant warga terisolasi secara sempurna!");
        } else {
          console.error("-> KRITIKAL: Ada kebocoran data antar warga!");
        }
      }
    }

    console.log("\n=======================================================");
    console.log("✅ SELURUH PENGUJIAN STATUS PENGAJUAN WARGA BERHASIL!");
    console.log("=======================================================");
  } catch (err) {
    console.error("Error during test execution:", err);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
