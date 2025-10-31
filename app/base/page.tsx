'use client';

import { useRouter } from 'next/navigation';
import { Droplet, WashingMachine, Archive, CheckCircle2, Truck, Plus } from 'lucide-react';

export default function BasePage() {
  const router = useRouter();

  const statuses = [
    { title: 'Lavar', count: 12, icon: <Droplet className="text-sky-500 w-6 h-6" />, color: 'border-sky-300' },
    { title: 'Lavando', count: 5, icon: <WashingMachine className="text-amber-500 w-6 h-6" />, color: 'border-amber-300' },
    { title: 'Guardar', count: 8, icon: <Archive className="text-green-500 w-6 h-6" />, color: 'border-green-300' },
    { title: 'Guardado', count: 22, icon: <CheckCircle2 className="text-purple-500 w-6 h-6" />, color: 'border-purple-300' },
    { title: 'Entregar', count: 15, icon: <Truck className="text-teal-600 w-6 h-6" />, color: 'border-teal-300' },
  ];

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-between">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b bg-white shadow-sm">
        <h1 className="font-bold text-lg text-gray-800">Base de Pedidos</h1>
        <button
          onClick={() => router.push('/menu')}
          className="text-sm text-violet-600 hover:underline"
        >
          ← Volver
        </button>
      </header>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {statuses.map((s) => (
          <div
            key={s.title}
            onClick={() => router.push(`/base/${s.title.toLowerCase()}`)}
            className={`flex flex-col justify-center items-center bg-white border ${s.color} rounded-xl shadow-sm cursor-pointer hover:shadow-md transition`}
          >
            <div className="flex flex-col items-center py-4">
              {s.icon}
              <h2 className="font-semibold text-gray-800 mt-2">{s.title}</h2>
              <p className="text-sm text-gray-500">{s.count} Orders</p>
            </div>
          </div>
        ))}
      </div>

      {/* Floating button */}
      <div className="flex justify-end p-5">
        <button
          className="rounded-full w-14 h-14 bg-violet-600 hover:bg-violet-700 text-white shadow-lg flex items-center justify-center"
          onClick={() => router.push('/pedido/nuevo')}
        >
          <Plus size={28} />
        </button>
      </div>

      {/* Bottom Navigation */}
      <nav className="flex justify-around border-t bg-white py-2 text-gray-500 text-sm">
        <div className="flex flex-col items-center text-violet-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18m-6 6h6m-6-12h6M3 6h6m-6 12h6" />
          </svg>
          Dashboard
        </div>
        <div className="flex flex-col items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A4 4 0 018 16h8a4 4 0 012.879 1.804M12 14v7m0-7a4 4 0 100-8 4 4 0 000 8z" />
          </svg>
          Clientes
        </div>
        <div className="flex flex-col items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M9 16h6m-3-6v6" />
          </svg>
          Reportes
        </div>
        <div className="flex flex-col items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6h4m-2-2v4m0 8v4m0-2h4m-2-2v4m-8-8v4m2-2h4" />
          </svg>
          Config
        </div>
      </nav>
    </main>
  );
}
