// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/** Viewport / PWA */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#8B5CF6",
  colorScheme: "light",
};

export const metadata: Metadata = {
  applicationName: "Lavandería Fabiola",
  description: "Gestión de pedidos y clientes de Lavandería Fabiola.",
  manifest: "/manifest.webmanifest",
  themeColor: "#8B5CF6",
  title: {
    default: "Lavandería Fabiola",
    template: "%s | Lavandería Fabiola",
  },

  /** Íconos (asegúrate de tenerlos en /public) */
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon.ico"],
  },

  /** PWA en iOS */
  appleWebApp: {
    capable: true,
    title: "Lavandería Fabiola",
    statusBarStyle: "default",
  },

  /** Evita autolink de teléfonos en iOS y mejora SEO básico */
  formatDetection: { telephone: false, address: false, email: false },
  category: "business",

  /** Social */
  openGraph: {
    title: "Lavandería Fabiola",
    description: "Gestión moderna y eficiente para tu lavandería.",
    url: "https://lf-s.vercel.app",
    siteName: "Lavandería Fabiola",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Lavandería Fabiola" }],
    locale: "es_CL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lavandería Fabiola",
    description: "Gestión moderna y eficiente para tu lavandería.",
    images: ["/icon-512.png"],
  },

  alternates: { canonical: "/", languages: { "es-CL": "/" } },
  robots: { index: true, follow: true },

  /** Metas extra que algunos launchers leen */
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 bg-[radial-gradient(75%_50%_at_50%_0%,rgba(255,255,255,0.12),transparent)]"
        />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
