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
        <div className="relative flex items-center justify-center h-[260px] w-[260px]">
          {/* LOGO perfectamente centrado */}
          <Image
            src="/logo.png"
            alt="Logo Lavandería Fabiola"
            width={150}
            height={150}
            priority
            className="object-contain z-10"
          />

          {/* LOADER totalmente centrado detrás */}
          {loading && <div className="loader-spinner absolute"></div>}
        </div>


      {/* ANIMACIONES */}
        <style jsx global>{`
          /* Spinner mayor tamaño y más visible */
          .loader-spinner {
            width: 230px;
            height: 230px;
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
