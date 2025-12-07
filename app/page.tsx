"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  // Después de 2.5s redirige automáticamente a /login
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/login");
    }, 2500);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex items-center justify-center min-h-screen bg-white">
      <div className="relative flex flex-col items-center">
        {/* Contenedor centrado de logo + loader */}
        <div className="relative flex items-center justify-center h-[260px] w-[260px]">
          {/* LOGO centrado */}
          <Image
            src="/logo.png"
            alt="Logo Lavandería Fabiola"
            width={150}
            height={150}
            priority
            className="object-contain z-10"
          />

          {/* Loader alrededor del logo */}
          <div className="loader-spinner absolute" />
        </div>
      </div>

      {/* Estilos del loader y animaciones */}
      <style jsx global>{`
        .loader-spinner {
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background:
            conic-gradient(
              from 0deg,
              #7c3aed 0deg 24deg,
              #a855f7 24deg 48deg,
              #c084fc 48deg 72deg,
              transparent 72deg 360deg
            );
          mask:
            radial-gradient(
              farthest-side,
              transparent calc(100% - 22px),
              #000 calc(100% - 15px)
            );
          animation: spin 1.1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}
