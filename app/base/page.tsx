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

type EstadoKey =
  | 'LAVAR'
  | 'LAVANDO'
  | 'GUARDAR'
  | 'GUARDADO'
  | 'ENTREGADO'
  | 'ENTREGAR';
type PedidoRow = { estado: string | null };

const ESTADOS: EstadoKey[] = [
  'LAVAR',
  'LAVANDO',
  'GUARDAR',
  'GUARDADO',
  'ENTREGADO',
  'ENTREGAR',
];

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

  const normalizeEstado = (v: string | null): EstadoKey | null => {
    if (!v) return null;
    const key = v.trim().toUpperCase();
    return ESTADOS.includes(key as EstadoKey) ? (key as EstadoKey) : null;
  };

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
        const estado = normalizeEstado(row.estado);
        // 👇 se cuentan todos excepto GUARDAR
        if (estado && estado !== 'GUARDAR') {
          next[estado] += 1;
        }
      });

      setCounts(next);
    } catch (e: any) {
      setErr(e?.message ?? 'Error desconocido al cargar');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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
    return () => supabase.removeChannel(channel);
  }, []);

  const tiles = useMemo(
    () => [
      {
        title: 'Lavar',
        key: 'LAVAR' as EstadoKey,
        icon: Droplet,
        href: '/base/lavar',
      },
      {
        title: 'Lavando',
        key: 'LAVANDO' as EstadoKey,
        icon: WashingMachine,
        href: '/base/lavando',
      },
      {
        title: 'Editar', // visualmente visible pero no cuenta
        key: 'GUARDAR' as EstadoKey,
        icon: Archive,
        href: '/base/guardar',
      },
      {
        title: 'Guardado',
        key: 'GUARDADO' as EstadoKey,
        icon: CheckCircle2,
        href: '/base/guardado',
      },
      {
        title: 'Entregado',
        key: 'ENTREGADO' as EstadoKey,
        icon: PackageCheck,
        href: '/base/entregado',
      },
      {
        title: 'Entregar',
        key: 'ENTREGAR' as EstadoKey,
        icon: Truck,
        href: '/entrega',
      },
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
      <header className="relative z-10 flex items-center justify-between px-6 py-6 max-w-6xl mx-auto">
        <h1 className="font-bold text-2xl">Base de Pedidos</h1>
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

      {err && (
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-red-100">
            <AlertTriangle size={16} />
            <span>No se pudieron cargar los contadores: {err}</span>
          </div>
        </div>
      )}

      {/* Grid */}
      <section className="relative z-10 mx-auto max-w-5xl px-6">
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2">
          {tiles.map((t) => {
            const Icon = t.icon;
            const value = loading ? null : counts[t.key];
            return (
              <button
                key={t.key}
                onClick={() => router.push(t.href)}
                className="group w-full rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md
                           shadow-[0_6px_24px_rgba(0,0,0,0.20)] hover:bg-white/14 hover:shadow-[0_10px_28px_rgba(0,0,0,0.25)]
                           transition p-5 md:p-6 text-left h-28 md:h-32"
              >
                <div className="flex items-center justify-between h-full">
                  <div className="flex items-center gap-3 md:gap-4">
                    <Icon className="w-7 h-7 md:w-8 md:h-8 text-white/90" />
                    <span className="text-lg md:text-xl font-extrabold tracking-tight drop-shadow">
                      {t.title}
                    </span>
                  </div>
                  <div className="text-right">
                    {value === null ? (
                      <span className="inline-block h-8 w-12 md:w-14 rounded bg-white/20 animate-pulse" />
                    ) : (
                      <span className="block text-4xl md:text-5xl font-extrabold leading-none tracking-tight drop-shadow-sm">
                        {t.key === 'GUARDAR' ? 0 : value}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Bottom Nav */}
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
