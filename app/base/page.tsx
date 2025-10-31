'use client';

import { useRouter } from 'next/navigation';
import {
  Droplet,
  WashingMachine,
  Archive,
  CheckCircle2,
  Truck,
  PackageCheck,
  Plus,
} from 'lucide-react';

export default function BasePage() {
  const router = useRouter();

  const statuses = [
    { title: 'Lavar',     count: 12, icon: <Droplet className="text-sky-500 w-6 h-6" />,        color: 'border-sky-300',     href: '/base/lavar' },
    { title: 'Lavando',   count: 5,  icon: <WashingMachine className="text-amber-500 w-6 h-6"/>,color: 'border-amber-300',   href: '/base/lavando' },
    { title: 'Guardar',   count: 8,  icon: <Archive className="text-green-600 w-6 h-6" />,      color: 'border-green-300',   href: '/base/guardar' },
    { title: 'Guardado',  count: 22, icon: <CheckCircle2 className="text-purple-600 w-6 h-6"/>, color: 'border-purple-300',  href: '/base/guardado' },
    { title: 'Entregado', count: 9,  icon: <PackageCheck className="text-emerald-600 w-6 h-6"/>,color: 'border-emerald-300', href: '/base/entregado' },
    { title: 'Entregar',  count: 15, icon: <Truck className="text-teal-600 w-6 h-6" />,         color: 'border-teal-300',    href: '/entrega' }, // va a la ventana Entrega
  ];

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-between">
      <header className="flex items-center justify-between p-4 border-b bg-white shadow-sm">
        <h1 className="font-bold text-lg text-gray-800">Base de Pedidos</h1>
        <button onClick={() => router.push('/menu')} className="text-sm text-violet-600 hover:underline">
          ← Volver
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 p-4">
        {statuses.map((s) => (
          <div
            key={s.title}
            onClick={() => router.push(s.href)}
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

      <div className="flex justify-end p-5">
        <button
          className="rounded-full w-14 h-14 bg-violet-600 hover:bg-violet-700 text-white shadow-lg flex items-center justify-center"
          onClick={() => router.push('/pedido/nuevo')}
        >
          <Plus size={28} />
        </button>
      </div>
    </main>
  );
}
