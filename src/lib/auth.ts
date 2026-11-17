import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import prisma from "./prisma"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "email@contoh.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email dan password harus diisi")
        }

        const rawEmail = credentials.email.trim();
        const normalizedEmail = rawEmail.toLowerCase();

        if (!rawEmail) {
          throw new Error("Email dan password harus diisi");
        }

        // Cari akun dengan case-insensitive & normalized matching yang aman
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: normalizedEmail, mode: "insensitive" } },
              { email: { equals: rawEmail, mode: "insensitive" } },
            ],
          },
        });

        if (!user || !user.password) {
          throw new Error("Email atau password salah");
        }

        let isPasswordValid = false;
        const isBcrypt =
          user.password.startsWith("$2a$") ||
          user.password.startsWith("$2b$") ||
          user.password.startsWith("$2y$");

        if (isBcrypt) {
          isPasswordValid = await bcrypt.compare(credentials.password, user.password);
        } else {
          // Dukungan migrasi aman jika ada format akun lama
          if (credentials.password === user.password) {
            isPasswordValid = true;
            try {
              const upgradedHash = await bcrypt.hash(credentials.password, 10);
              await prisma.user.update({
                where: { id: user.id },
                data: { password: upgradedHash },
              });
            } catch {
              // Abaikan kegagalan background hash update
            }
          }
        }

        if (!isPasswordValid) {
          throw new Error("Email atau password salah");
        }

        try {
          await prisma.systemLog.create({
            data: {
              userId: user.id,
              action: "LOGIN",
              entity: "AUTH"
            }
          })
        } catch {
          // ignore
        }

        return {
          id: user.id,
          email: user.email,
          name: user.nama,
          role: user.role,
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;

        try {
          const freshUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { nama: true, email: true, role: true },
          });
          if (freshUser) {
            session.user.name = freshUser.nama || (token.name as string) || "Pengguna";
            session.user.email = freshUser.email || (token.email as string);
            session.user.role = freshUser.role || (token.role as string);
          }
        } catch (dbErr) {
          console.error("Failed to sync session user from DB:", dbErr);
        }
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
}
