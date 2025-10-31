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
    { title: 'Lavar',     count: 12, icon: <Droplet className="w-6 h-6 text-white/90" />,        href: '/base/lavar' },
    { title: 'Lavando',   count: 5,  icon: <WashingMachine className="w-6 h-6 text-white/90" />, href: '/base/lavando' },
    { title: 'Guardar',   count: 8,  icon: <Archive className="w-6 h-6 text-white/90" />,        href: '/base/guardar' },
    { title: 'Guardado',  count: 22, icon: <CheckCircle2 className="w-6 h-6 text-white/90" />,   href: '/base/guardado' },
    { title: 'Entregado', count: 9,  icon: <PackageCheck className="w-6 h-6 text-white/90" />,   href: '/base/entregado' },
    { title: 'Entregar',  count: 15, icon: <Truck className="w-6 h-6 text-white/90" />,          href: '/entrega' },
  ];

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800">
      {/* velo radial suave como en /menu */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <h1 className="font-bold text-lg">Base de Pedidos</h1>
        <button
          onClick={() => router.push('/menu')}
          className="text-sm text-white/90 hover:text-white"
        >
          ← Volver
        </button>
      </header>

      {/* Cards / glass */}
      <section className="relative z-10 grid grid-cols-2 gap-4 px-6 py-4 max-w-4xl">
        {statuses.map(s => (
          <button
            key={s.title}
            onClick={() => router.push(s.href)}
            className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shadow-[0_6px_20px_rgba(0,0,0,0.15)] hover:bg-white/14 transition p-4 text-left"
          >
            <div className="flex items-center gap-2">
              {s.icon}
              <span className="font-semibold">{s.title}</span>
            </div>
            <p className="text-sm text-white/80 mt-1">{s.count} Orders</p>
          </button>
        ))}
      </section>

      {/* FAB */}
      <div className="relative z-10 flex justify-end px-6 py-6">
        <button
          className="rounded-full w-14 h-14 bg-white text-violet-700 shadow-xl hover:bg-violet-50 grid place-items-center"
          onClick={() => router.push('/pedido/nuevo')}
          aria-label="Nuevo pedido"
        >
          <Plus size={26} />
        </button>
      </div>

      {/* Bottom nav “suave” opcional */}
      <nav className="relative z-10 px-6 pb-6">
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-2xl bg-white/8 border border-white/10 py-2 text-center text-sm">Dashboard</div>
          <div className="rounded-2xl bg-white/8 border border-white/10 py-2 text-center text-sm">Clientes</div>
          <div className="rounded-2xl bg-white/8 border border-white/10 py-2 text-center text-sm">Reportes</div>
          <div className="rounded-2xl bg-white/8 border border-white/10 py-2 text-center text-sm">Config</div>
        </div>
      </nav>
    </main>
  );
}

