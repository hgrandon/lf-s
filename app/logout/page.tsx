'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    // Limpiar todos los datos de sesión
    localStorage.removeItem('access_ok');
    localStorage.removeItem('user');
    localStorage.removeItem('token');

    // Redirigir automáticamente después de un pequeño delay
    const timer = setTimeout(() => {
      router.replace('/login');
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex flex-col items-center justify-center h-screen bg-white relative overflow-hidden text-center">
      {/* Fondo degradado suave rosado-violeta */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-200 via-purple-200 to-white opacity-60 blur-3xl" />

      {/* Contenedor visible */}
      <div className="relative bg-white shadow-lg rounded-2xl p-8 w-80 border border-gray-200 z-10">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <Image
            src="/logo.png"
            alt="Logo Lavandería"
            width={64}
            height={64}
            className="object-contain"
            priority
          />
        </div>

        <h2 className="text-2xl font-bold mb-2 text-purple-700">Cerrando sesión...</h2>
        <p className="text-gray-500 text-sm">Serás redirigido al inicio en unos segundos.</p>
      </div>
    </main>
  );
}

