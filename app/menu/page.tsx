'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MenuTile from '@/app/components/MenuTile';

// Usa nombres que sé que existen en lucide-react
import {
  ClipboardList,
  User,           // en vez de User2
  Database,
  History,
  Wallet,
  Save,
  Truck,
  Route,          // en vez de RouteIcon
  Home,
  Settings,
  Package
} from 'lucide-react';

export default function MenuPage() {
  const router = useRouter();

  useEffect(() => {
    const ok = typeof window !== 'undefined' && localStorage.getItem('access_ok') === '1';
    if (!ok) router.replace('/login');
  }, [router]);

  return (
    <main className="min-h-[100svh] bg-gradient-to-b from-white to-violet-50">
      <div className="mx-auto max-w-md px-6 py-10">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="text-violet-700 font-black text-4xl leading-none">LF</div>
          <h1 className="text-2xl font-bold text-violet-800 text-center">
            Lavandería América
          </h1>
        </div>

        <div className="grid grid-cols-3 gap-y-8 gap-x-6 place-items-center">
          <MenuTile href="/pedido"    label="PEDIDO"     icon={<ClipboardList />} />
          <MenuTile href="/cliente"   label="CLIENTE"    icon={<User />} />
          <MenuTile href="/base"      label="BASE"       icon={<Database />} />

          <MenuTile href="/historico" label="HISTÓRICO"  icon={<History />} />
          <MenuTile href="/finanzas"  label="FINANZAS"   icon={<Wallet />} />
          <MenuTile href="/guardar"   label="GUARDAR"    icon={<Save />} />

          <MenuTile href="/entregar"  label="ENTREGAR"   icon={<Truck />} />
          <MenuTile href="/ruta"      label="RUTA"       icon={<Route />} />
          <MenuTile href="/domicilio" label="DOMICILIO"  icon={<Home />} />

          <MenuTile href="/config"    label="CONFIG"     icon={<Settings />} />
          <MenuTile href="/articulos" label="ARTÍCULOS"  icon={<Package />} />
          <MenuTile href="/logout"    label="SALIR"      icon={<Save className="rotate-180" />} />
        </div>
      </div>
    </main>
  );
}


