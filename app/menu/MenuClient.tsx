'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  Building2,
  LogOut,
  FileDown,
} from 'lucide-react';

/* =========================
   Helpers de sesión / rol
========================= */

type AuthSession = {
  rol?: string | null;
  ts?: number;
  ttl?: number;
};

function getCurrentRole(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('lf_auth');
    if (!raw) return null;

    const parsed = JSON.parse(raw) as AuthSession;

    if (parsed.ttl && parsed.ts && Date.now() - parsed.ts > parsed.ttl) {
      localStorage.removeItem('lf_auth');
      return null;
    }

    return parsed.rol ?? null;
  } catch {
    return null;
  }
}

function isAdminRole(rol: string | null | undefined): boolean {
  if (!rol) return false;
  const r = rol.toUpperCase();
  return r === 'ADMIN' || r === 'ADMINISTRADOR';
}

/* =========================
   Configuración de Tiles
========================= */

type TileConfig = {
  href: string;
  title: string;
  icon: React.ReactNode;
  disabled?: boolean;
  adminOnly?: boolean;
};

const tiles: TileConfig[] = [
  { href: '/pedido', title: 'Pedido', icon: <ClipboardList size={22} /> },
  { href: '/clientes', title: 'Cliente', icon: <User size={22} /> },
  { href: '/base', title: 'Base', icon: <Database size={22} /> },

  // ✅ REPORTE EMPRESA (ruta correcta)
  {
    href: '/base/reporte_empresa',
    title: 'Reporte Empresa',
    icon: <FileDown size={22} />,
  },

  { href: '/empresa', title: 'Empresa', icon: <Building2 size={22} /> },

  // ✅ FINANZAS SOLO ADMIN (más limpio que filtrar por title)
  { href: '/finanzas', title: 'Finanzas', icon: <PiggyBank size={22} />, adminOnly: true },

  // Próximamente
  { href: '/guardar', title: 'Guardar', icon: <Save size={22} />, disabled: true },
  { href: '/entregar', title: 'Entregar', icon: <PackageCheck size={22} />, disabled: true },

  // ✅ RUTA ACTIVADA (ya NO disabled)
  { href: '/ruta', title: 'Ruta', icon: <RouteIcon size={22} /> },

  { href: '/domicilio', title: 'Domicilio', icon: <Home size={22} />, disabled: true },

  { href: '/configuracion', title: 'Configuración', icon: <Settings size={22} /> },

  { href: '/articulos', title: 'Artículos', icon: <Tag size={22} />, disabled: true },

  { href: '/logout', title: 'Salir', icon: <LogOut size={22} /> },
];

/* =========================
   Componente MenuClient
========================= */

export default function MenuClient() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const role = getCurrentRole();
    setIsAdmin(isAdminRole(role));
  }, []);

  const visibleTiles = useMemo(() => {
    if (isAdmin === null) return tiles;
    return tiles.filter((t) => !(t.adminOnly && !isAdmin));
  }, [isAdmin]);

  if (isAdmin === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.href} className="h-24 rounded-2xl bg-white/10 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {visibleTiles.map(({ href, icon, title, disabled }) => (
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
