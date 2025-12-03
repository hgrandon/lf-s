// app/clientes/ClientesApp.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  UserPlus,
  Search,
  ChevronRight,
  ChevronDown,
  User2,
  Package,
  Calendar,
  Coins,
  AlertCircle,
  ArrowLeft,
  Home,
  Truck,
} from 'lucide-react';

/* =========================
   Tipos
========================= */
type Cliente = {
  telefono: string;
  nombre: string;
  direccion: string | null;
};

type PedidoResumen = {
  nro: number;
  fecha: string | null;
  entrega: string | null;
  estado: string | null;
  total: number | null;
  estado_pago: string | null;
  tipo_entrega: string | null;
};

type PedidosCache = Record<
  string,
  { loading: boolean; error: string | null; items: PedidoResumen[] }
>;

/* =========================
   Utilidades
========================= */
const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

function normalize(q: string) {
  return q
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function useDebounced<T>(value: T, delay = 350) {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return deb;
}

/** Fecha YYYY-MM-DD → DD-MM-YYYY (si viene con hora, se ignora) */
function formatFecha(fecha: string | null): string {
  if (!fecha) return '—';
  const s = fecha.slice(0, 10);
  const [y, m, d] = s.split('-');
  if (y && m && d) return `${d}-${m}-${y}`;
  return fecha;
}

/* =========================
   Componente
========================= */
export default function ClientesApp() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const debQuery = useDebounced(query);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const [openTel, setOpenTel] = useState<string | null>(null);
  const [pedidosByTel, setPedidosByTel] = useState<PedidosCache>({});

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* -------- Carga de clientes -------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const q = debQuery.trim();
        const base = supabase
          .from('clientes')
          .select('telefono, nombre, direccion')
          .order('nombre', { ascending: true });

        if (q) {
          const { data, error } = await base.or(
            `nombre.ilike.%${q}%,direccion.ilike.%${q}%,telefono.ilike.%${q}%`,
          );
          if (error) throw error;
          if (!cancelled && mountedRef.current) {
            setClientes((data ?? []) as Cliente[]);
          }
        } else {
          const { data, error } = await base.limit(80);
          if (error) throw error;
          if (!cancelled && mountedRef.current) {
            setClientes((data ?? []) as Cliente[]);
          }
        }
      } catch (e: any) {
        console.error(e);
        if (!cancelled && mountedRef.current) {
          setError(e?.message ?? 'No se pudieron cargar clientes');
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debQuery]);

  /* -------- Abrir cliente y cargar pedidos -------- */
  async function toggleOpen(telefono: string) {
    setOpenTel((prev) => (prev === telefono ? null : telefono));

    const cache = pedidosByTel[telefono];
    if (cache?.items?.length || cache?.loading) return;

    setPedidosByTel((prev) => ({
      ...prev,
      [telefono]: { loading: true, error: null, items: [] },
    }));

    try {
      // OJO: columnas reales de la tabla pedido
      const { data, error } = await supabase
        .from('pedido')
        .select(
          'nro, fecha_ingreso, fecha_entrega, estado, total, estado_pago, tipo_entrega',
        )
        .eq('telefono', telefono)
        .order('nro', { ascending: false });

      if (error) throw error;

      const items: PedidoResumen[] = (data ?? []).map((r: any) => ({
        nro: Number(r.nro),
        fecha: r.fecha_ingreso ?? null,
        entrega: r.fecha_entrega ?? null,
        estado: r.estado ?? null,
        total: r.total ?? null,
        estado_pago: r.estado_pago ?? null,
        tipo_entrega: r.tipo_entrega ?? null,
      }));

      setPedidosByTel((prev) => ({
        ...prev,
        [telefono]: { loading: false, error: null, items },
      }));
    } catch (e: any) {
      console.error(e);
      setPedidosByTel((prev) => ({
        ...prev,
        [telefono]: {
          loading: false,
          error: e?.message ?? 'No se pudieron cargar pedidos',
          items: [],
        },
      }));
    }
  }

  const filtered = useMemo(() => {
    const q = normalize(debQuery);
    if (!q) return clientes;
    return clientes.filter((c) => {
      const hay =
        normalize(c.nombre ?? '').includes(q) ||
        normalize(c.direccion ?? '').includes(q) ||
        (c.telefono ?? '').toString().includes(q);
      return hay;
    });
  }, [clientes, debQuery]);

  /* =========================
     Render
  ========================== */
  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-28">
      {/* brillo superior */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* 🔵 CABECERA + FILTRO FIJOS */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-violet-800/95 via-fuchsia-700/95 to-indigo-800/95 backdrop-blur border-b border-white/15">
        <div className="mx-auto max-w-5xl px-4 lg:px-10 py-3">
          {/* fila: título + agregar + volver */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h1 className="font-bold text-xl sm:text-2xl">Clientes</h1>
              <button
                onClick={() => router.push('/clientes/nuevo')}
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 border border-white/25 px-3 py-1.5 text-xs sm:text-sm font-medium hover:bg-white/25 shadow-sm"
              >
                <UserPlus size={16} /> Agregar cliente
              </button>
            </div>
            <button
              onClick={() => router.push('/menu')}
              className="inline-flex items-center gap-1 text-xs sm:text-sm text-white/90 hover:text-white"
            >
              <ArrowLeft size={16} /> Volver
            </button>
          </div>

          {/* buscador dentro de la cabecera */}
          <div className="relative mt-3 mb-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, teléfono o dirección..."
              className="w-full rounded-2xl bg-white/10 border border-white/20 pl-9 pr-3 py-2 text-sm placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/35"
            />
          </div>
        </div>
      </header>

      {/* CONTENIDO SCROLLEABLE */}
      <section className="relative z-10 mx-auto max-w-5xl px-3 sm:px-4">
        {/* Errores generales de clientes */}
        {error && (
          <div className="mt-3 mb-3 flex items-center gap-2 rounded-xl border border-red-300/30 bg-red-500/20 px-3 py-2 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Lista de clientes */}
        {loading ? (
          <div className="mt-2 grid gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-2xl bg-white/10 border border-white/10 animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-4 text-white/80">Sin resultados.</div>
        ) : (
          <div className="mt-2 grid gap-3 pb-8">
            {filtered.map((c) => {
              const abierto = openTel === c.telefono;
              const cache = pedidosByTel[c.telefono];

              return (
                <div
                  key={c.telefono}
                  className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md shadow-[0_6px_20px_rgba(0,0,0,0.15)]"
                >
                  {/* fila cliente */}
                  <button
                    onClick={() => toggleOpen(c.telefono)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/15 border border-white/20">
                        <User2 size={18} />
                      </span>
                      <div className="text-left">
                        <div className="font-extrabold leading-tight uppercase text-sm">
                          {c.nombre || 'SIN NOMBRE'}
                        </div>
                        <div className="text-[11px] text-white/85 truncate">
                          +56 {c.telefono}{' '}
                          {c.direccion ? `• ${c.direccion}` : ''}
                        </div>
                      </div>
                    </div>
                    {abierto ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                  </button>

                  {/* acordeón pedidos */}
                  {abierto && (
                    <div className="px-3 pb-4">
                      {cache?.loading && (
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90">
                          Cargando pedidos…
                        </div>
                      )}

                      {cache?.error && (
                        <div className="mt-2 rounded-xl border border-red-300/30 bg-red-500/20 px-3 py-2 text-sm">
                          <AlertCircle size={16} className="inline mr-1" />
                          {cache.error}
                        </div>
                      )}

                      {!cache?.loading && !cache?.error && (
                        <div className="mt-2 grid gap-2">
                          {cache?.items?.length ? (
                            cache.items.map((p) => {
                              const estado = (p.estado ?? '').toUpperCase();
                              const pago = (p.estado_pago ?? '').toUpperCase();
                              const tipo = (p.tipo_entrega ?? '').toUpperCase();
                              const esProceso = [
                                'LAVAR',
                                'LAVANDO',
                                'GUARDAR',
                                'GUARDADO',
                              ].includes(estado);

                              const cardBase =
                                'rounded-2xl border p-3 text-[11px] sm:text-xs';
                              const cardColors = esProceso
                                ? 'bg-emerald-600/25 border-emerald-300/40'
                                : 'bg-white/5 border-white/10';

                              return (
                                <div
                                  key={p.nro}
                                  className={`${cardBase} ${cardColors}`}
                                >
                                  {/* fila nro + total */}
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <Package size={14} />
                                      <span className="font-semibold text-sm">
                                        {p.nro}
                                      </span>
                                    </div>
                                    <span className="text-sm font-bold">
                                      {p.total != null
                                        ? CLP.format(p.total)
                                        : '—'}
                                    </span>
                                  </div>

                                  {/* fechas */}
                                  <div className="mt-1 grid grid-cols-2 gap-2 text-[10px] sm:text-[11px] text-white/90">
                                    <div className="flex items-center gap-1">
                                      <Calendar size={11} /> Fec.{' '}
                                      {formatFecha(p.fecha)}
                                    </div>
                                    <div className="flex items-center gap-1 justify-end">
                                      <Calendar size={11} /> Ent.{' '}
                                      {formatFecha(p.entrega)}
                                    </div>
                                  </div>

                                  {/* estado + entrega + pago */}
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {/* estado en recuadro gris */}
                                    <span className="inline-flex items-center rounded-lg bg-slate-100/10 border border-slate-200/30 px-2 py-1 text-[10px] sm:text-[11px] uppercase tracking-wide">
                                      {estado || '—'}
                                    </span>

                                    {/* tipo entrega */}
                                    <span className="inline-flex items-center rounded-lg bg-white/10 border border-white/20 px-2 py-1 text-[10px] sm:text-[11px] gap-1">
                                      {tipo === 'DOMICILIO' ? (
                                        <>
                                          <Truck size={12} /> DOMICILIO
                                        </>
                                      ) : (
                                        <>
                                          <Home size={12} /> LOCAL
                                        </>
                                      )}
                                    </span>

                                    {/* pago */}
                                    <span
                                      className={[
                                        'inline-flex items-center rounded-lg px-2 py-1 text-[10px] sm:text-[11px] gap-1 border',
                                        pago === 'PAGADO'
                                          ? 'bg-emerald-500/30 border-emerald-300/50 text-emerald-50'
                                          : 'bg-amber-500/25 border-amber-300/50 text-amber-50',
                                      ].join(' ')}
                                    >
                                      <Coins size={12} />
                                      {pago || 'PENDIENTE'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85">
                              Sin pedidos para este cliente.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
