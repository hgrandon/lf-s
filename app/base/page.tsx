// app/base/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
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
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

type EstadoKey = 'LAVAR' | 'LAVANDO' | 'GUARDAR' | 'GUARDADO' | 'ENTREGADO' | 'ENTREGAR';
type PedidoRow = { estado: string | null };

const ESTADOS: EstadoKey[] = ['LAVAR', 'LAVANDO', 'GUARDAR', 'GUARDADO', 'ENTREGADO', 'ENTREGAR'];

export default function BasePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<EstadoKey, number>>({
    LAVAR: 0,
    LAVANDO: 0,
    GUARDAR: 0,
    GUARDADO: 0,
    ENTREGADO: 0,
    ENTREGAR: 0,
  });

  // Normaliza el valor de "estado" y devuelve la clave del mapa si existe
  const normalizeEstado = (v: string | null): EstadoKey | null => {
    if (!v) return null;
    const key = v.trim().toUpperCase();
    return ESTADOS.includes(key as EstadoKey) ? (key as EstadoKey) : null;
  };

  // Carga los contadores (único fetch, se agrupa en front para compatibilidad total)
  const fetchCounts = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase.from('pedido').select('estado');
      if (error) throw error;

      const next: Record<EstadoKey, number> = {
        LAVAR: 0,
        LAVANDO: 0,
        GUARDAR: 0,
        GUARDADO: 0,
        ENTREGADO: 0,
        ENTREGAR: 0,
      };

      (data as PedidoRow[]).forEach((row) => {
        const k = normalizeEstado(row.estado);
        if (k) next[k] += 1;
      });

      setCounts(next);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? 'Error desconocido al cargar');
    } finally {
      setLoading(false);
    }
  };

  // Primer fetch + realtime (se actualiza solo ante INSERT/UPDATE/DELETE)
  useEffect(() => {
    fetchCounts();

    const channel = supabase
      .channel('pedido-counts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedido' },
        () => fetchCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Tarjetas de navegación
  const tiles = useMemo(
    () => [
      { title: 'Lavar', key: 'LAVAR' as EstadoKey, icon: <Droplet className="w-6 h-6 text-white/90" />, href: '/base/lavar' },
      { title: 'Lavando', key: 'LAVANDO' as EstadoKey, icon: <WashingMachine className="w-6 h-6 text-white/90" />, href: '/base/lavando' },
      { title: 'Editar', key: 'GUARDAR' as EstadoKey, icon: <Archive className="w-6 h-6 text-white/90" />, href: '/base/guardar' },
      { title: 'Guardado', key: 'GUARDADO' as EstadoKey, icon: <CheckCircle2 className="w-6 h-6 text-white/90" />, href: '/base/guardado' },
      { title: 'Entregado', key: 'ENTREGADO' as EstadoKey, icon: <PackageCheck className="w-6 h-6 text-white/90" />, href: '/base/entregado' },
      { title: 'Entregar', key: 'ENTREGAR' as EstadoKey, icon: <Truck className="w-6 h-6 text-white/90" />, href: '/entrega' },
    ],
    []
  );

  const shortcuts = [
    { name: 'Base', icon: LayoutDashboard, href: '/base' },
    { name: 'Clientes', icon: User, href: '/clientes' },
    { name: 'Finanzas', icon: PiggyBank, href: '/finanzas' },
    { name: 'Config', icon: Settings, href: '/config' },
  ];

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <h1 className="font-bold text-xl tracking-tight">Base de Pedidos</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCounts}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-sm hover:bg-white/15"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
          <button
            onClick={() => router.push('/menu')}
            className="text-sm text-white/90 hover:text-white"
          >
            ← Volver
          </button>
        </div>
      </header>

      {/* Error banner (si ocurre) */}
      {err && (
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-red-100">
            <AlertTriangle size={16} />
            <span>No se pudieron cargar los contadores: {err}</span>
          </div>
        </div>
      )}

      {/* Grid centrada */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-2">
        <div className="grid justify-items-center gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
          {tiles.map((t) => (
            <button
              key={t.key}
              onClick={() => router.push(t.href)}
              className="w-full rounded-2xl bg-white/10 backdrop-blur-md border border-white/15
                         shadow-[0_6px_20px_rgba(0,0,0,0.15)] hover:bg-white/14 transition p-4 text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {t.icon}
                  <span className="font-semibold">{t.title}</span>
                </div>

                {/* Badge con conteo */}
                <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs">
                  {loading ? '—' : counts[t.key]}
                </span>
              </div>

              {/* Subtexto o skeleton */}
              <p className="text-sm text-white/80 mt-2">
                {loading ? (
                  <span className="inline-block h-2 w-24 animate-pulse rounded bg-white/20" />
                ) : (
                  `${counts[t.key]} Orders`
                )}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 px-4 pt-2 pb-4 backdrop-blur-md">
        <div className="mx-auto max-w-6xl rounded-2xl bg-white/10 border border-white/15 p-3">
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
