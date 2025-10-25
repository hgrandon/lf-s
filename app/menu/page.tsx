'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

function useAuthGuard() {
  const router = useRouter();
  useEffect(() => {
    const ok = typeof window !== 'undefined' && localStorage.getItem('auth') === 'ok';
    if (!ok) router.replace('/login');
  }, [router]);
}

export default function MenuPage() {
  useAuthGuard();

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">Menú principal</h1>

        <div className="grid sm:grid-cols-2 gap-4">
          <a href="/clientes" className="block p-6 rounded-xl bg-white shadow hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">Clientes</h2>
            <p className="text-sm text-gray-500 mt-1">(TELÉFONO, NOMBRE, DIRECCIÓN)</p>
          </a>

          <a href="/imagenes" className="block p-6 rounded-xl bg-white shadow hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">Imágenes</h2>
            <p className="text-sm text-gray-500 mt-1">Subir fotos asociadas a un cliente (se guardan en Supabase Storage).</p>
          </a>

          <a href="/config" className="block p-6 rounded-xl bg-white shadow hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">Configuración</h2>
            <p className="text-sm text-gray-500 mt-1">Cambiar la clave de acceso.</p>
          </a>

          <button
            onClick={() => { localStorage.removeItem('auth'); location.href = '/login'; }}
            className="p-6 rounded-xl bg-white shadow hover:shadow-md text-left"
          >
            <h2 className="text-lg font-semibold text-gray-800">Salir</h2>
            <p className="text-sm text-gray-500 mt-1">Cerrar sesión.</p>
          </button>
        </div>
      </div>
    </main>
  );
}
