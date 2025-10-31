'use client';

import { useRouter } from 'next/navigation';
import {
  Droplet,
  WashingMachine,
  Archive,
  CheckCircle2,
  Truck,
  PackageCheck,
  User,
  PiggyBank,
  Settings,
  LayoutDashboard,
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

  const shortcuts = [
    { name: 'Base',     icon: LayoutDashboard, href: '/base' },
    { name: 'Clientes', icon: User,            href: '/clientes' },
    { name: 'Finanzas', icon: PiggyBank,       href: '/finanzas' },
    { name: 'Config',   icon: Settings,        href: '/config' },
  ];

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <h1 className="font-bold text-lg">Base de Pedidos</h1>
        <button
          onClick={() => router.push('/menu')}
          className="text-sm text-white/90 hover:text-white"
        >
          ← Volver
        </button>
      </header>

      <section className="relative z-10 grid grid-cols-2 gap-4 px-6 py-4 max-w-4xl">
        {statuses.map((s) => (
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

      <nav className="fixed bottom-0 left-0 right-0 z-20 px-4 pt-2 pb-4 backdrop-blur-md">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white/10 border border-white/15 p-3">
          <div className="grid grid-cols-4 gap-3">
            {shortcuts.map((item) => (
              <button
                key={item.name}
                onClick={() => router.push(item.href)}
                className="flex flex-col items-center justify-center rounded-xl bg-white/5 border border-white/10 py-3 text-white/90 hover:bg-white/10 transition"
              >
                <item.icon size={18} className="mb-1" />
                <span className="text-sm font-medium">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>
    </main>
  );
}
