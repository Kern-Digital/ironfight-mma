import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/lib/auth-context";
import PwaRegister from "@/components/PwaRegister";
import FighterNameModal from "@/components/auth/FighterNameModal";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Tidal Athletics — Train Hard. Fight Smart.",
  description:
    "Deine MMA Trainings-App. Boxing, Wrestling, BJJ, Muay Thai. Strukturierte Pläne, Workout-Timer und Fortschritts-Tracking.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tidal Athletics",
  },
};

export const viewport: Viewport = {
  themeColor: "#dc2626",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased`}
      >
        <AuthProvider>
          <PwaRegister />
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <FighterNameModal />
        </AuthProvider>
      </body>
    </html>
  );
}
