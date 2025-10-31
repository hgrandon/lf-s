import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ habilita imágenes remotas desde Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },

  // (opcional) si ya lo usas, lo mantenemos
  reactCompiler: true,
};

export default nextConfig;

