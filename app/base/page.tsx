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
  Printer, // 👈 NUEVO ICONO
} from 'lucide-react';

/* =========================
   Tipos extra (UUD)
========================= */

type AuthMode = 'clave' | 'usuario' | 'google';

type LfSession = {
  mode: AuthMode;
  display: string;
  rol?: string | null;
  ts: number;
  ttl: number;
};

function readSessionSafely(): LfSession | null {
  try {
    const raw = localStorage.getItem('lf_auth');
    if (!raw) return null;
    const s = JSON.parse(raw) as LfSession;
    if (!s || !s.ts || !s.ttl) return null;
    const expired = Date.now() - s.ts > s.ttl;
    if (expired) {
      localStorage.removeItem('lf_auth');
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

/* =========================
   Tipos y constantes
========================= */
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

const EMPTY_COUNTS: Record<EstadoKey, number> = {
  LAVAR: 0,
  LAVANDO: 0,
  GUARDAR: 0,
  GUARDADO: 0,
  ENTREGADO: 0,
  ENTREGAR: 0,
};

/* =========================
   Página principal Base
========================= */
export default function BasePage() {
  const router = useRouter();

  // --- Seguridad UUD: requiere sesión válida (cualquier rol) ---
  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const sess = readSessionSafely();
    if (!sess) {
      setHasSession(false);
      setAuthChecked(true);
      return;
    }
    setHasSession(true);
    setAuthChecked(true);
  }, []);

  // --- Estados de datos ---
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [counts, setCounts] =
    useState<Record<EstadoKey, number>>(EMPTY_COUNTS);
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

  /** Carga de conteo (RPC o fallback SELECT) */
  const fetchCounts = async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setErr(null);
    try {
      const { data: rpcData, error: rpcError } =
        await supabase.rpc('get_pedido_counts');
      const next = { ...EMPTY_COUNTS };

      if (!rpcError && Array.isArray(rpcData)) {
        (rpcData as { estado: string; n: number }[]).forEach((row) => {
          const key = (row.estado || '')
            .toUpperCase()
            .trim() as EstadoKey;
          if (key && key in next) next[key] = Number(row.n) || 0;
        });
        next.GUARDAR = 0;
        if (mountedRef.current) setCounts(next);
      } else {
        const { data, error } = await supabase
          .from('pedido')
          .select('estado');
        if (error) throw error;
        (data as PedidoRow[]).forEach((row) => {
          const estado = normalizeEstado(row.estado);
          if (estado && estado in next) next[estado] += 1;
        });
        next.GUARDAR = 0;
        if (mountedRef.current) setCounts(next);
      }

      // ENTREGADO pendientes de pago
      const { count: pendCount, error: pendErr } = await supabase
        .from('pedido')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'ENTREGADO')
        .eq('pagado', false);
      if (pendErr) throw pendErr;
      if (mountedRef.current)
        setPendingEntregado(pendCount ?? 0);
    } catch (e: any) {
      if (mountedRef.current)
        setErr(e?.message ?? 'Error desconocido al cargar');
      console.error('fetchCounts error:', e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // Suscripción realtime SOLO si hay sesión
  useEffect(() => {
    if (!hasSession) return;

    (async () => {
      await fetchCounts();
    })();

    let channel: RealtimeChannel | null = supabase
      .channel('pedido-counts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedido' },
        () => {
          fetchCounts();
        },
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
      channel = null;
    };
  }, [hasSession]);

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
        title: 'Editar',
        key: null,
        icon: Archive,
        href: '/editar',
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
        subtitle: `P. pago ${pendingEntregado}`,
      },
      {
        title: 'Entregar',
        key: 'ENTREGAR' as EstadoKey,
        icon: Truck,
        href: '/base/entregar',
      },
      // 🔹 NUEVO TILE: Imp Rotulo (sin contador)
      {
        title: 'Imp Rótulo',
        key: null,
        icon: Printer,
        href: '/rotulos',
      },
    ],
    [pendingEntregado],
  );

  const shortcuts = [
    { name: 'Base', icon: LayoutDashboard, href: '/base' },
    { name: 'Clientes', icon: User, href: '/clientes' },
    { name: 'Finanzas', icon: PiggyBank, href: '/finanzas' },
    { name: 'Config', icon: Settings, href: '/config' },
  ];

  /* =========================
     Renders según seguridad
  ========================== */

  if (!authChecked) {
    // Verificando UUD
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin" size={26} />
          <span className="text-sm opacity-80">
            Verificando acceso UUD…
          </span>
        </div>
      </main>
    );
  }

  if (!hasSession) {
    // Sin sesión válida: NO se redirige, solo mensaje
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white px-6 text-center">
        <div className="max-w-xs space-y-3">
          <h1 className="text-lg font-extrabold">
            Acceso restringido LF-UUD
          </h1>
          <p className="text-sm text-white/80">
            Esta pantalla solo está disponible para usuarios con
            sesión activa en la aplicación.
          </p>
          <p className="text-[11px] text-white/60">
            Abre la app Lavandería Fabiola, inicia sesión y vuelve
            a intentar ingresar a <strong>/base</strong>.
          </p>
        </div>
      </main>
    );
  }

  /* =========================
     Página normal (con sesión)
  ========================== */

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* HEADER */}
      <header className="relative z-10 flex items-center justify-between px-4 py-4 max-w-6xl mx-auto">
        <h1 className="font-bold text-xl sm:text-2xl">
          Base de Pedidos
        </h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={fetchCounts}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-60"
            aria-busy={loading}
          >
            <RefreshCw
              className={loading ? 'animate-spin' : ''}
              size={16}
            />
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

      {/* ERROR */}
      {err && (
        <div className="relative z-10 mx-auto max-w-6xl px-4">
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-red-100">
            <AlertTriangle size={16} />
            <span>
              No se pudieron cargar los contadores: {err}
            </span>
          </div>
        </div>
      )}

      {/* GRID COMPACTO */}
      <section className="relative z-10 mx-auto max-w-5xl px-4">
        <div className="grid grid-cols-2 gap-4 sm:gap-5 [grid-auto-rows:5.5rem] sm:[grid-auto-rows:6rem]">
          {tiles.map((t) => (
            <Tile
              key={`${t.title}-${t.href}`}
              title={t.title}
              count={loading || !t.key ? null : counts[t.key]}
              onClick={() => router.push(t.href)}
              Icon={t.icon}
              subtitle={t.subtitle}
            />
          ))}
        </div>
      </section>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 px-3 pt-2 pb-3 backdrop-blur-md">
        <div className="mx-auto max-w-6xl rounded-2xl bg-white/10 border border-white/15 p-3">
          <div className="grid grid-cols-4 gap-3">
            {shortcuts.map((item) => (
              <button
                key={item.name}
                onClick={() => router.push(item.href)}
                className="flex flex-col items-center justify-center rounded-xl bg-white/5 border border-white/10 py-3 text-white/90 hover:bg-white/10 transition"
                aria-label={item.name}
              >
                <item.icon size={18} className="mb-1" />
                <span className="text-sm font-medium">
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </nav>
    </main>
  );
}

/* =========================
   Componente Tile
========================= */
function Tile({
  title,
  count,
  Icon,
  onClick,
  subtitle,
}: {
  title: string;
  count: number | null;
  Icon: React.ComponentType<
    React.SVGProps<SVGSVGElement>
  >;
  onClick: () => void;
  subtitle?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="
        group w-full rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md
        shadow-[0_4px_16px_rgba(0,0,0,0.20)] hover:bg-white/14 hover:shadow-[0_6px_22px_rgba(0,0,0,0.25)]
        transition p-3 sm:p-4 text-left h-[5.5rem] sm:h-[6.25rem] active:scale-[.99]
      "
      aria-label={title}
    >
      <div className="h-full flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Icon className="w-6 h-6 text-white/90 shrink-0" />
          <div className="min-w-0">
            <span className="block text-base sm:text-lg font-extrabold tracking-tight truncate">
              {title}
            </span>
            {subtitle ? (
              <span className="mt-0.5 block text-[0.9rem] sm:text-[1rem] text-yellow-300 font-extrabold italic truncate">
                {subtitle}
              </span>
            ) : null}
          </div>
        </div>
        <div className="text-right w-12 sm:w-14">
          {count === null ? (
            <span className="block w-0 h-0" />
          ) : (
            <span className="block text-2xl sm:text-3xl font-extrabold leading-none tracking-tight">
              {count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
