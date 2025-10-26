'use client';

import Logo from '@/app/components/Logo';
import MenuTile from '@/app/components/MenuTile';
import Protected from '@/app/components/Protected';
import {
  ClipboardList,
  User,
  PiggyBank,
  Save,
  PackageCheck,
  Route as RouteIcon,
  Home,
  Settings,
  Tag,
  Database,
  History,
  LogOut,
} from 'lucide-react';

const tiles = [
  { href: '/pedido',     title: 'Pedido',    icon: <ClipboardList size={22} /> },
  { href: '/clientes',   title: 'Cliente',   icon: <User size={22} /> },
  { href: '/base',       title: 'Base',      icon: <Database size={22} />,   disabled: true },
  { href: '/historico',  title: 'Histórico', icon: <History size={22} />,    disabled: true },
  { href: '/finanzas',   title: 'Finanzas',  icon: <PiggyBank size={22} />,  disabled: true },
  { href: '/guardar',    title: 'Guardar',   icon: <Save size={22} />,       disabled: true },
  { href: '/entregar',   title: 'Entregar',  icon: <PackageCheck size={22} />,disabled: true },
  { href: '/ruta',       title: 'Ruta',      icon: <RouteIcon size={22} />,  disabled: true },
  { href: '/domicilio',  title: 'Domicilio', icon: <Home size={22} />,       disabled: true },
  { href: '/config',     title: 'Config',    icon: <Settings size={22} /> },
  { href: '/articulos',  title: 'Artículos', icon: <Tag size={22} />,        disabled: true },
  { href: '/logout',     title: 'Salir',     icon: <LogOut size={22} /> },
];

export default function MenuClient() {
  return (
    <Protected>
      <main className="min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" />
        <header className="relative z-10 mx-auto max-w-6xl px-6 pt-10">
          <Logo size={56} showName boxed className="mb-6" />
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl md:text-3xl font-bold">Menú principal</h1>
            <p className="text-white/80">Elige una opción para continuar.</p>
          </div>
        </header>

        <section className="relative z-10 mx-auto max-w-6xl px-6 py-10">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {tiles.map(({ href, icon, title, disabled }) => (
              <MenuTile
                key={href}
                href={disabled ? '#' : href}
                icon={icon}
                title={title}
                subtitle={disabled ? 'Próximamente' : undefined}
                disabled={disabled}
              />
            ))}
          </div>
        </section>
      </main>
    </Protected>
  );
}
