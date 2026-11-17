import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./chatbot.css";
import ChatBot from "@/components/ChatBot";
import Navbar from "@/components/Navbar";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 5.0,
  userScalable: true,
  themeColor: "#17365D",
};

export const metadata: Metadata = {
  title: "Sistem Pelayanan Desa Terpadu — Asisten Desa Perum",
  description:
    "Platform pelayanan desa digital yang modern, profesional, dan mudah digunakan untuk masyarakat Desa Perum, Kota Cirebon.",
  keywords: "pelayanan desa, desa perum, surat keterangan, administrasi desa, cirebon",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#F1F5F9] text-[#1E293B] antialiased">
        <Navbar />
        {children}
        <ChatBot />
      </body>
    </html>
  );
}

