// app/base/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
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
  Printer,
} from 'lucide-react';

type EstadoKey =
  | 'LAVAR'
  | 'LAVANDO'
  | 'GUARDAR'
  | 'GUARDADO'
  | 'ENTREGADO'
  | 'ENTREGAR';

const ESTADOS: EstadoKey[] = [
  'LAVAR',
  'LAVANDO',
  'GUARDAR',
  'GUARDADO',
  'ENTREGADO',
  'ENTREGAR',
];

const EMPTY_COUNTS: Record<EstadoKey, number> = {
  LAVAR: 0,
  LAVANDO: 0,
  GUARDAR: 0,
  GUARDADO: 0,
  ENTREGADO: 0,
  ENTREGAR: 0,
};

export default function BasePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<EstadoKey, number>>(EMPTY_COUNTS);
  const [pendingEntregado, setPendingEntregado] = useState(0);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const normalizeEstado = (v: string | null): EstadoKey | null => {
    if (!v) return null;
    const key = v.trim().toUpperCase();
    return ESTADOS.includes(key as EstadoKey) ? (key as EstadoKey) : null;
  };

  const fetchCounts = async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setErr(null);
    try {
      const { data: rpcData } = await supabase.rpc('get_pedido_counts');
      const next = { ...EMPTY_COUNTS };

      if (Array.isArray(rpcData)) {
        rpcData.forEach((row: any) => {
          const key = normalizeEstado(row.estado);
          if (key) next[key] = Number(row.n) || 0;
        });
        next.GUARDAR = 0;
        setCounts(next);
      }

      const { count } = await supabase
        .from('pedido')
        .select('*', { head: true, count: 'exact' })
        .eq('estado', 'ENTREGADO')
        .eq('pagado', false);

      setPendingEntregado(count ?? 0);
    } catch (e: any) {
      setErr(e?.message ?? 'Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
    let channel: RealtimeChannel | null = supabase
      .channel('pedido-counts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedido' },
        fetchCounts
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const tiles = [
    { title: 'Lavar', key: 'LAVAR' as EstadoKey, icon: Droplet },
    { title: 'Lavando', key: 'LAVANDO' as EstadoKey, icon: WashingMachine },
    { title: 'Guardado', key: 'GUARDADO' as EstadoKey, icon: CheckCircle2 },
    {
      title: 'Entregar',
      key: 'ENTREGAR' as EstadoKey,
      icon: Truck,
    },
    {
      title: 'Entregado',
      key: 'ENTREGADO' as EstadoKey,
      icon: PackageCheck,
      subtitle: `Pago pend. ${pendingEntregado}`,
    },
  ];

  const shortcuts = [
    { name: 'Base', icon: LayoutDashboard, href: '/base' },
    { name: 'Clientes', icon: User, href: '/clientes' },
    { name: 'Finanzas', icon: PiggyBank, href: '/finanzas' },
    { name: 'Config', icon: Settings, href: '/config' },
  ];

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-28">
      <header className="relative z-10 flex items-center justify-between px-4 py-4 max-w-6xl mx-auto">
        <h1 className="font-bold text-xl sm:text-2xl">Base de Pedidos</h1>
        <button
          onClick={fetchCounts}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-60"
        >
          <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </header>

      {err && (
        <div className="text-center text-sm text-red-200">{err}</div>
      )}

      <section className="relative z-10 mx-auto max-w-5xl px-4">
        <div className="grid grid-cols-2 gap-4 sm:gap-5">
          {tiles.map((t) => (
            <button
              key={t.title}
              onClick={() =>
                router.push(`/base/general?estado=${t.key}`)
              }
              className="rounded-xl bg-white/10 border border-white/15 p-4 shadow text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <t.icon size={22} />
                  <span className="font-bold">{t.title}</span>
                </div>
                <span className="text-lg font-extrabold">
                  {loading ? '-' : counts[t.key]}
                </span>
              </div>
              {t.subtitle && (
                <p className="text-[0.7rem] italic text-yellow-300 mt-1">
                  {t.subtitle}
                </p>
              )}
            </button>
          ))}

          <button
            onClick={() => router.push('/rotulos')}
            className="rounded-xl bg-white/10 border border-white/15 p-4 shadow text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer size={22} />
                <span className="font-bold">Imp Rótulo</span>
              </div>
            </div>
          </button>
        </div>
      </section>

      <nav className="fixed bottom-0 left-0 right-0 z-20 px-3 py-3 backdrop-blur-md">
        <div className="mx-auto max-w-6xl rounded-xl bg-white/10 border border-white/15 p-3 grid grid-cols-4 gap-3">
          {shortcuts.map((s) => (
            <button
              key={s.name}
              onClick={() => router.push(s.href)}
              className="flex flex-col items-center text-white"
            >
              <s.icon size={18} />
              <span className="text-xs">{s.name}</span>
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
