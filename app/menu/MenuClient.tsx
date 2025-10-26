'use client';

import MenuTile from '@/app/components/MenuTile';
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

// Solo la grilla — sin encabezado ni logo
const tiles = [
  { href: '/pedido', title: 'Pedido', icon: <ClipboardList size={22} /> },
  { href: '/clientes', title: 'Cliente', icon: <User size={22} /> },
  { href: '/base', title: 'Base', icon: <Database size={22} />, disabled: true },
  { href: '/historico', title: 'Histórico', icon: <History size={22} />, disabled: true },
  { href: '/finanzas', title: 'Finanzas', icon: <PiggyBank size={22} />, disabled: true },
  { href: '/guardar', title: 'Guardar', icon: <Save size={22} />, disabled: true },
  { href: '/entregar', title: 'Entregar', icon: <PackageCheck size={22} />, disabled: true },
  { href: '/ruta', title: 'Ruta', icon: <RouteIcon size={22} />, disabled: true },
  { href: '/domicilio', title: 'Domicilio', icon: <Home size={22} />, disabled: true },
  { href: '/config', title: 'Configuración', icon: <Settings size={22} /> },
  { href: '/articulos', title: 'Artículos', icon: <Tag size={22} />, disabled: true },
  { href: '/logout', title: 'Salir', icon: <LogOut size={22} /> },
];

export default function MenuClient() {
  return (
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
  );
}


