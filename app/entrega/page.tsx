'use client';

import { useRouter } from 'next/navigation';
import { Home, Truck } from 'lucide-react';
import { useState } from 'react';

export default function EntregaPage() {
  const router = useRouter();
  const [modo, setModo] = useState<'LOCAL' | 'DOMICILIO'>('LOCAL');

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b">
        <button className="text-violet-600 hover:underline" onClick={() => router.push('/base')}>← Volver</button>
        <h1 className="font-semibold text-gray-800">Entrega</h1>
        <div className="w-8" />
      </header>

      {/* Selector Local/Domicilio */}
      <section className="p-4">
        <div className="inline-flex rounded-xl overflow-hidden border bg-white">
          <button
            className={`px-4 py-2 flex items-center gap-2 ${modo === 'LOCAL' ? 'bg-violet-600 text-white' : 'text-gray-700'}`}
            onClick={() => setModo('LOCAL')}
          >
            <Home size={18} /> Local
          </button>
          <button
            className={`px-4 py-2 flex items-center gap-2 ${modo === 'DOMICILIO' ? 'bg-violet-600 text-white' : 'text-gray-700'}`}
            onClick={() => setModo('DOMICILIO')}
          >
            <Truck size={18} /> Domicilio
          </button>
        </div>
      </section>

      {/* Contenido según modo */}
      <section className="p-4 grid gap-3">
        {modo === 'LOCAL' ? (
          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold text-gray-800 mb-2">Entregas en Local</h2>
            <p className="text-sm text-gray-600">Aquí mostraremos los pedidos listos para retiro en tienda.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold text-gray-800 mb-2">Entregas a Domicilio</h2>
            <p className="text-sm text-gray-600">Planifica la ruta y abre Google Maps con la dirección del cliente.</p>
          </div>
        )}
      </section>
    </main>
  );
}
