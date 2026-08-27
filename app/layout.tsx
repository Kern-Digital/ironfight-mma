import type { Metadata, Viewport } from "next";
import { Archivo, Barlow_Condensed, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AthleteChromeGate from "@/components/AthleteChromeGate";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import FighterNameModal from "@/components/auth/FighterNameModal";
import TrainerOnboardingModal from "@/components/auth/TrainerOnboardingModal";
import SubscriptionAutoSync from "@/components/SubscriptionAutoSync";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

// Neues Token-System (Redesign): Archivo für Display UND Body.
// Barlow/Inter bleiben bis zum Rollout-Ende für Altseiten.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tidal Athletics — Train Hard. Fight Smart.",
  description:
    "Deine MMA Trainings-App. Boxing, Wrestling, BJJ, Muay Thai. Strukturierte Pläne, Workout-Timer und Fortschritts-Tracking.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tidal Athletics",
  },
};

export const viewport: Viewport = {
  themeColor: "#23C4CE",
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
    // Font-Variablen MÜSSEN auf <html> liegen, nicht auf <body> (Fix
    // 2026-08-26): Die Typo-Tokens in globals.css (--type-* auf :root)
    // referenzieren var(--font-archivo)&Co. — liegen die Variablen nur auf
    // <body>, schlägt die Substitution auf :root fehl, die Tokens vererben
    // sich als "guaranteed-invalid" und JEDES font: var(--type-*) fällt
    // still auf den Preflight zurück (16px/400).
    <html
      lang="de"
      className={`dark ${barlowCondensed.variable} ${inter.variable} ${jetbrainsMono.variable} ${archivo.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Prevents flash of wrong theme on reload */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('ta-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}` }} />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <ThemeProvider>
          <AuthProvider>
            {/* PwaRegister (Service Worker) ist bewusst RAUS (2026-08-26):
                der alte Cache-First-SW servierte dauerhaft veraltete Stände.
                public/sw.js bleibt als Kill-Switch für Bestandsclients. */}
            <PwaInstallPrompt />
            <AthleteChromeGate>
              <Navbar />
            </AthleteChromeGate>
            <main className="flex-1">{children}</main>
            <AthleteChromeGate>
              <Footer />
            </AthleteChromeGate>
            <FighterNameModal />
            <TrainerOnboardingModal />
            <SubscriptionAutoSync />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
