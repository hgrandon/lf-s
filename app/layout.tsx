import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: {
    default: "Lavandería Fabiola",
    template: "%s | Lavandería Fabiola",
  },
  description: "Gestión de pedidos y clientes de Lavandería Fabiola.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.webmanifest",
  themeColor: "#8B5CF6", // violeta principal del diseño
  openGraph: {
    title: "Lavandería Fabiola",
    description: "Gestión moderna y eficiente para tu lavandería.",
    url: "https://lf-s.vercel.app",
    siteName: "Lavandería Fabiola",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "Lavandería Fabiola",
      },
    ],
    locale: "es_CL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lavandería Fabiola",
    description: "Gestión moderna y eficiente para tu lavandería.",
    images: ["/icon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="bg-violet-900 text-white">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
