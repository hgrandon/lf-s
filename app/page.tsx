"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="flex items-center justify-center min-h-screen bg-white">
      <div className="relative flex flex-col items-center">
        {/* LOGO */}
        <Image
          src="/logo.png"
          alt="Logo Lavandería Fabiola"
          width={140}
          height={140}
          priority
          className="z-10"
        />

        {/* LOADER TIPO SPINNER ALREDEDOR DEL LOGO */}
        {loading && (
          <div className="absolute flex items-center justify-center inset-0">
            <div className="loader-spinner"></div>
          </div>
        )}

        {/* BOTÓN DESPUÉS DE CARGAR */}
        {!loading && (
          <Link
            href="/login"
            className="mt-10 bg-violet-600 text-white px-7 py-3 rounded-xl text-lg font-semibold shadow-lg hover:bg-violet-700 animate-fade-in"
          >
            Iniciar sesión
          </Link>
        )}
      </div>

      {/* ANIMACIONES */}
        <style jsx global>{`
          /* Spinner mayor tamaño y más visible */
          .loader-spinner {
            width: 200px;
            height: 200px;
            position: absolute;
            inset: 0;
            margin: auto;
          }

          .loader-spinner::before {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background:
              conic-gradient(
                from 0deg,
                #7c3aed 0deg 20deg,
                #a855f7 20deg 40deg,
                #c084fc 40deg 60deg,
                transparent 60deg 360deg
              );
            mask:
              radial-gradient(
                farthest-side,
                transparent calc(100% - 20px),
                #000 calc(100% - 15px)
              );
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          /* Fade del botón */
          @keyframes fade-in {
            0% {
              opacity: 0;
              transform: translateY(10px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-fade-in {
            animation: fade-in 0.8s ease forwards;
          }
        `}</style>

    </main>
  );
}
