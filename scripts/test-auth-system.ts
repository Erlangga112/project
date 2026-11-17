import "dotenv/config";
import { authOptions } from "../src/lib/auth";
import prisma from "../src/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

async function runTestSuite() {
  console.log("=================================================");
  console.log("   PENGUJIAN MENYELURUH SISTEM AUTENTIKASI       ");
  console.log("=================================================\n");

  const provider = authOptions.providers[0] as any;
  const authorize = provider.options?.authorize || provider.authorize;

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail: string = "") {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${testName} ${detail ? "-> " + detail : ""}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName} ${detail ? "-> " + detail : ""}`);
    }
  }

  // Persiapan data akun asli untuk pengujian
  const testRealEmail = "warga.perum.asli@gmail.com";
  const testRealPassword = "PasswordAsli#2026";
  const testHashed = await bcrypt.hash(testRealPassword, 10);

  // Buat atau update akun uji asli
  await prisma.user.upsert({
    where: { email: testRealEmail },
    update: { password: testHashed, role: Role.WARGA },
    create: {
      nama: "Warga Asli Terdaftar",
      email: testRealEmail,
      password: testHashed,
      role: Role.WARGA,
    },
  });

  // ── TEST 1: Akun demo yang sebelumnya berfungsi ──────────────
  console.log("\n--- TEST 1: Akun Demo ---");
  try {
    const demoUser = await authorize({ email: "budi@warga.id", password: "password123" });
    assert(demoUser && demoUser.email === "budi@warga.id", "Login akun demo budi@warga.id berhasil", `Role: ${demoUser.role}`);
  } catch (err: any) {
    assert(false, "Login akun demo budi@warga.id gagal", err.message);
  }

  // ── TEST 2: Akun asli yang sudah terdaftar dengan password benar ──
  console.log("\n--- TEST 2: Akun Asli Terdaftar ---");
  try {
    const realUser = await authorize({ email: testRealEmail, password: testRealPassword });
    assert(realUser && realUser.email === testRealEmail, "Login akun asli berhasil dengan password valid", `Nama: ${realUser.name}`);
  } catch (err: any) {
    assert(false, "Login akun asli gagal", err.message);
  }

  // ── TEST 3: Password yang salah ─────────────────────────────
  console.log("\n--- TEST 3: Password Salah ---");
  try {
    await authorize({ email: testRealEmail, password: "PasswordYangSalah123!" });
    assert(false, "Login dengan password salah seharusnya ditolak tapi lolos");
  } catch (err: any) {
    assert(err.message === "Email atau password salah", "Password salah ditolak dengan pesan aman", err.message);
  }

  // ── TEST 4: Email yang belum terdaftar ───────────────────────
  console.log("\n--- TEST 4: Email Belum Terdaftar ---");
  try {
    await authorize({ email: "email_fiktif_belum_ada@desa.id", password: "password123" });
    assert(false, "Email belum terdaftar seharusnya ditolak tapi lolos");
  } catch (err: any) {
    assert(err.message === "Email atau password salah", "Email tidak terdaftar ditolak dengan pesan aman", err.message);
  }

  // ── TEST 5: Email dengan variasi huruf besar/kecil & spasi ──
  console.log("\n--- TEST 5: Casing & Whitespace Tolerance ---");
  try {
    // 5a. Uppercase
    const userUpper = await authorize({ email: "BUDI@WARGA.ID", password: "password123" });
    assert(userUpper && userUpper.role === "WARGA", "Login email HURUF BESAR berhasil");

    // 5b. Mixed Case dengan Spasi di awal & akhir
    const userSpaced = await authorize({ email: "   Budi@Warga.ID   ", password: "password123" });
    assert(userSpaced && userSpaced.role === "WARGA", "Login email dengan SPASI & mixed-case berhasil");

    // 5c. Akun asli dengan mixed case
    const realMixed = await authorize({ email: "Warga.Perum.Asli@GMAIL.COM", password: testRealPassword });
    assert(realMixed && realMixed.email === testRealEmail, "Login akun asli mixed-case berhasil");
  } catch (err: any) {
    assert(false, "Pengujian toleransi casing/whitespace gagal", err.message);
  }

  // ── TEST 6: Akun dari masing-masing role ──────────────────────
  console.log("\n--- TEST 6: Pengujian Setiap Role ---");
  const roleChecklist = [
    { email: "budi@warga.id", expectedRole: "WARGA" },
    { email: "staf@desa.id", expectedRole: "STAF_DESA" },
    { email: "supervisor@desa.id", expectedRole: "SUPERVISOR" },
    { email: "kades@desa.id", expectedRole: "KEPALA_DESA" },
  ];

  for (const rc of roleChecklist) {
    try {
      const u = await authorize({ email: rc.email, password: "password123" });
      assert(u && u.role === rc.expectedRole, `Role ${rc.expectedRole} tervalidasi`, `Email: ${rc.email}`);
    } catch (err: any) {
      assert(false, `Login role ${rc.expectedRole} gagal`, err.message);
    }
  }

  // ── TEST 7: Callback Token & Session ─────────────────────────
  console.log("\n--- TEST 7: Callback JWT & Session ---");
  try {
    const jwtCallback = authOptions.callbacks?.jwt;
    const sessionCallback = authOptions.callbacks?.session;

    if (jwtCallback && sessionCallback) {
      // Simulasi token generation saat sign in
      const mockUser = { id: "user-123", email: testRealEmail, name: "Warga Asli", role: "WARGA" };
      const token = await jwtCallback({ token: {}, user: mockUser as any, account: null });
      assert(token.id === "user-123" && token.role === "WARGA", "JWT Token callback menyimpan id dan role yang benar");

      // Cari user riil di db untuk session callback
      const dbUser = await prisma.user.findUnique({ where: { email: testRealEmail } });
      const sessionResult = await sessionCallback({
        session: { user: { name: "", email: "", image: "" }, expires: "2099-01-01" } as any,
        token: { id: dbUser?.id, role: dbUser?.role, name: dbUser?.nama, email: dbUser?.email },
      } as any);

      const userObj = (sessionResult as any)?.user;
      assert(
        userObj?.id === dbUser?.id &&
        userObj?.role === "WARGA" &&
        userObj?.email === testRealEmail,
        "Session callback berhasil menyusun data session valid dari database",
        `Session Role: ${userObj?.role}`
      );
    } else {
      assert(false, "Callbacks jwt atau session tidak ditemukan di authOptions");
    }
  } catch (err: any) {
    assert(false, "Pengujian callback token & session gagal", err.message);
  }

  // ── TEST 8: Uji Migrasi Password Aman (Legacy format) ────────
  console.log("\n--- TEST 8: Migrasi Format Akun Legacy ---");
  try {
    const legacyEmail = "legacy.warga@desa.id";
    const legacyPass = "PlainOldPassword123";

    // Simpan akun dengan password plaintext
    await prisma.user.upsert({
      where: { email: legacyEmail },
      update: { password: legacyPass, role: Role.WARGA },
      create: {
        nama: "Warga Akun Lama",
        email: legacyEmail,
        password: legacyPass,
        role: Role.WARGA,
      },
    });

    // Login pertama: harus berhasil dan mentransformasikan password ke bcrypt
    const legacyUser = await authorize({ email: legacyEmail, password: legacyPass });
    assert(legacyUser && legacyUser.email === legacyEmail, "Login akun legacy plain-password berhasil");

    // Periksa apakah database otomatis di-upgrade ke bcrypt
    const reloaded = await prisma.user.findUnique({ where: { email: legacyEmail } });
    const isNowBcrypt = reloaded?.password?.startsWith("$2a$") || reloaded?.password?.startsWith("$2b$");
    assert(isNowBcrypt === true, "Password legacy berhasil dimigrasikan secara transparan ke hash bcrypt");

    // Bersihkan akun legacy uji
    await prisma.user.delete({ where: { email: legacyEmail } });
  } catch (err: any) {
    assert(false, "Uji migrasi password legacy gagal", err.message);
  }

  console.log("\n=================================================");
  console.log(`HASIL: ${passedTests} dari ${totalTests} pengujian berhasil (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log("=================================================\n");
}

runTestSuite()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
