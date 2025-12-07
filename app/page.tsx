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
      {/* Contenedor principal */}
      <div className="relative flex flex-col items-center">
        {/* LOGO */}
        <Image
          src="/logo.png"
          alt="Logo Lavandería Fabiola"
          width={120}
          height={120}
          priority
          className="object-contain z-10"
        />

        {/* Círculos de carga animados */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-40 h-40">
              <span className="absolute inset-0 rounded-full border-4 border-violet-500 border-t-transparent animate-spin"></span>
              <span className="absolute inset-2 rounded-full border-4 border-fuchsia-500 border-t-transparent animate-spin-slow"></span>
            </div>
          </div>
        )}

        {/* Botón que aparece después de la carga */}
        {!loading && (
          <Link
            href="/login"
            className="mt-10 bg-violet-600 text-white px-6 py-3 rounded-xl font-semibold text-lg transition-opacity duration-700 animate-fade-in shadow-lg hover:bg-violet-700"
          >
            Iniciar sesión
          </Link>
        )}
      </div>

      {/* Animaciones personalizadas */}
      <style jsx global>{`
        @keyframes spin-slow {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(-360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 1s ease forwards;
        }
      `}</style>
    </main>
  );
}
