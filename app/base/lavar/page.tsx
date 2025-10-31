'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, User, Table, Loader2, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

type Item = { articulo: string; qty: number; valor: number };

type Pedido = {
  id: number;              // nro de pedido
  cliente: string;         // nombre por teléfono o el propio teléfono
  total: number | null;    // total del pedido si no hay líneas
  estado: 'LAVAR' | 'LAVANDO' | 'GUARDAR' | 'GUARDADO' | 'ENTREGADO';
  detalle?: string | null;
  foto_url?: string | null;
  estado_pago?: 'PAGADO' | 'PENDIENTE' | null; // tomado de pedido.estado_pago
  items?: Item[];
};

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

/** Acepta: null | '' | url simple | '[]' | '["url"]' y devuelve la primera url válida o null */
function firstFotoFromMixed(input: unknown): string | null {
  if (!input) return null;
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return null;
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        return Array.isArray(arr) && typeof arr[0] === 'string' ? arr[0] : null;
      } catch {
        return null;
      }
    }
    return s;
  }
  if (Array.isArray(input) && typeof input[0] === 'string') return input[0];
  return null;
}

export default function LavarPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [openDetail, setOpenDetail] = useState<Record<number, boolean>>({});
  const [imageError, setImageError] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const pedidoAbierto = useMemo(() => pedidos.find(p => p.id === openId) ?? null, [pedidos, openId]);
  const subtotal = (it: Item) => it.qty * it.valor;
  const totalDe = (p: Pedido) => (p.items?.length ? p.items.reduce((a, it) => a + subtotal(it), 0) : p.total ?? 0);

  function snack(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 1800);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErrMsg(null);

        // 1) Pedidos: usar tabla "pedido" (NO la vista) — filtramos por estado='LAVAR'
        const { data: rows, error: e1 } = await supabase
          .from('pedido')
          .select('nro, telefono, total, estado, detalle, estado_pago, fotos_urls')
          .eq('estado', 'LAVAR')
          .order('nro', { ascending: false });

        if (e1) throw e1;

        if (!rows?.length) {
          if (!cancelled) {
            setPedidos([]);
            setLoading(false);
          }
          return;
        }

        const nros = rows.map(r => r.nro);
        const telefonos = rows.map(r => r.telefono).filter(Boolean) as string[];

        // 2) Líneas del pedido
        const { data: lineas, error: e2 } = await supabase
          .from('pedido_linea')
          .select('nro, articulo, cantidad, valor')
          .in('nro', nros);

        if (e2) throw e2;

        // 3) Respaldo de fotos (si no viene en fotos_urls)
        const { data: fotos, error: e3 } = await supabase
          .from('pedido_foto')
          .select('nro, url')
          .in('nro', nros);

        if (e3) throw e3;

        // 4) Clientes para nombre por teléfono
        const { data: cli, error: e4 } = await supabase
          .from('clientes')
          .select('telefono, nombre')
          .in('telefono', telefonos);

        if (e4) throw e4;

        // Mapas auxiliares
        const nombreByTel = new Map<string, string>();
        (cli ?? []).forEach(c => nombreByTel.set(String(c.telefono), c.nombre ?? 'SIN NOMBRE'));

        const itemsByNro = new Map<number, Item[]>();
        (lineas ?? []).forEach(l => {
          const key = Number(l.nro);
          const arr = itemsByNro.get(key) ?? [];
          arr.push({
            articulo: String(l.articulo ?? ''),
            qty: Number(l.cantidad ?? 0),
            valor: Number(l.valor ?? 0),
          });
          itemsByNro.set(key, arr);
        });

        const fotoByNro = new Map<number, string>();
        // Prioridad: fotos_urls del propio pedido
        rows.forEach(r => {
          const f = firstFotoFromMixed((r as any).fotos_urls);
          if (f) fotoByNro.set(r.nro, f);
        });
        // Respaldo: pedido_foto
        (fotos ?? []).forEach(f => {
          const key = Number(f.nro);
          if (!fotoByNro.has(key) && typeof f.url === 'string' && f.url) {
            fotoByNro.set(key, f.url);
          }
        });

        const mapped: Pedido[] = rows.map(r => ({
          id: r.nro,
          cliente: nombreByTel.get(String(r.telefono)) ?? String(r.telefono ?? 'SIN NOMBRE'),
          total: r.total ?? null,
          estado: r.estado as Pedido['estado'],
          detalle: r.detalle ?? null,
          foto_url: fotoByNro.get(r.nro) ?? null,
          estado_pago: (r.estado_pago as 'PAGADO' | 'PENDIENTE' | null) ?? 'PENDIENTE',
          items: itemsByNro.get(r.nro) ?? [],
        }));

        if (!cancelled) {
          setPedidos(mapped);
          setLoading(false);
        }
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setErrMsg(err?.message ?? 'Error al cargar pedidos');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Cambiar estado (usa columna nro)
  async function changeEstado(id: number, next: Pedido['estado']) {
    if (!id) return;
    setSaving(true);
    const prev = pedidos;
    setPedidos(prev.map(p => (p.id === id ? { ...p, estado: next } : p)));

    const { error } = await supabase.from('pedido').update({ estado: next }).eq('nro', id).select('nro').single();

    if (error) {
      console.error('No se pudo actualizar estado:', error);
      setPedidos(prev); // revert
      setSaving(false);
      return;
    }

    if (next !== 'LAVAR') {
      setPedidos(curr => curr.filter(p => p.id !== id));
      setOpenId(null);
      snack(`Pedido #${id} movido a ${next}`);
    }
    setSaving(false);
  }

  // Toggle pago usando columna texto "estado_pago" (PAGADO/PENDIENTE)
  async function togglePago(id: number) {
    if (!id) return;
    setSaving(true);
    const prev = pedidos;
    const actual = prev.find(p => p.id === id)?.estado_pago ?? 'PENDIENTE';
    const next = actual === 'PAGADO' ? 'PENDIENTE' : 'PAGADO';

    setPedidos(prev.map(p => (p.id === id ? { ...p, estado_pago: next } : p)));

    const { error } = await supabase.from('pedido').update({ estado_pago: next }).eq('nro', id).select('nro').single();

    if (error) {
      console.error('No se pudo actualizar estado_pago:', error);
      setPedidos(prev); // revert
      setSaving(false);
      return;
    }

    snack(`Pedido #${id} marcado como ${next}`);
    setSaving(false);
  }

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      <header className="relative z-10 flex items-center justify-between px-4 lg:px-10 py-3 lg:py-5">
        <h1 className="font-bold text-base lg:text-xl">Lavar</h1>
        <button onClick={() => router.push('/base')} className="text-xs lg:text-sm text-white/90 hover:text-white">
          ← Volver
        </button>
      </header>

      <section className="relative z-10 w-full px-3 sm:px-6 lg:px-10 grid gap-4">
        {loading && (
          <div className="flex items-center gap-2 text-white/90">
            <Loader2 className="animate-spin" size={18} />
            Cargando pedidos…
          </div>
        )}

        {!loading && errMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-300/30 p-3 text-sm">
            <AlertTriangle size={16} />
            <span>{errMsg}</span>
          </div>
        )}

        {!loading && !errMsg && pedidos.length === 0 && (
          <div className="text-white/80">No hay pedidos en estado LAVAR.</div>
        )}

        {!loading &&
          !errMsg &&
          pedidos.map(p => {
            const isOpen = openId === p.id;
            const detOpen = !!openDetail[p.id];
            const totalCalc = totalDe(p);

            return (
              <div
                key={p.id}
                className={[
                  'rounded-2xl bg-white/10 border backdrop-blur-md shadow-[0_6px_20px_rgba(0,0,0,0.15)]',
                  isOpen ? 'border-white/40' : 'border-white/15',
                ].join(' ')}
              >
                {/* Cabecera */}
                <button
                  onClick={() => setOpenId(isOpen ? null : p.id)}
                  className="w-full flex items-center justify-between gap-3 lg:gap-4 px-3 sm:px-4 lg:px-6 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/15 border border-white/20">
                      <User size={18} />
                    </span>
                    <div className="text-left">
                      <div className="font-extrabold tracking-wide text-sm lg:text-base">N° {p.id}</div>
                      <div className="text-[10px] lg:text-xs uppercase text-white/85">
                        {p.cliente} • {p.estado_pago === 'PAGADO' ? 'PAGADO' : 'PENDIENTE'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 lg:gap-4">
                    <div className="font-extrabold text-white/95 text-sm lg:text-base">{CLP.format(totalCalc)}</div>
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </button>

                {/* Cuerpo */}
                {isOpen && (
                  <div className="px-3 sm:px-4 lg:px-6 pb-3 lg:pb-5">
                    <div className="rounded-xl bg-white/8 border border-white/15 p-2 lg:p-3">
                      {/* Acordeón de detalle */}
                      <button
                        onClick={() => setOpenDetail(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center gap-2">
                          <Table size={16} />
                          <span className="font-semibold">Detalle Pedido</span>
                        </div>
                        {detOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>

                      {detOpen && (
                        <div className="mt-3 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex justify-center">
                          <div className="overflow-x-auto w-full max-w-4xl">
                            <table className="w-full text-xs lg:text-sm text-white/95">
                              <thead className="bg-white/10 text-white/90">
                                <tr>
                                  <th className="text-left px-3 py-2 w-[40%]">Artículo</th>
                                  <th className="text-right px-3 py-2 w-[15%]">Can.</th>
                                  <th className="text-right px-3 py-2 w-[20%]">Valor</th>
                                  <th className="text-right px-3 py-2 w-[25%]">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/10">
                                {p.items?.length ? (
                                  p.items.map((it, idx) => (
                                    <tr key={idx}>
                                      <td className="px-3 py-2 truncate">
                                        {it.articulo.length > 18 ? it.articulo.slice(0, 18) + '.' : it.articulo}
                                      </td>
                                      <td className="px-3 py-2 text-right">{it.qty}</td>
                                      <td className="px-3 py-2 text-right">{CLP.format(it.valor)}</td>
                                      <td className="px-3 py-2 text-right">{CLP.format(it.qty * it.valor)}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td className="px-3 py-4 text-center text-white/70" colSpan={4}>
                                      Sin artículos registrados.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                            <div className="px-3 py-3 bg-white/10 text-right font-extrabold text-white">
                              Total: {CLP.format(totalCalc)}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Imagen siempre debajo */}
                      <div className="mt-3 rounded-xl overflow-hidden bg-black/20 border border-white/10">
                        {p.foto_url && !imageError[p.id] ? (
                          <div className="relative w-full aspect-[16/9] lg:h-72">
                            <Image
                              src={p.foto_url}
                              alt={`Foto pedido ${p.id}`}
                              fill
                              sizes="(max-width: 1024px) 100vw, 1200px"
                              onError={() => setImageError(prev => ({ ...prev, [p.id]: true }))}
                              className="object-cover"
                              priority={false}
                            />
                          </div>
                        ) : (
                          <div className="p-6 text-sm text-white/70">Sin imagen adjunta.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </section>

      {/* Acciones inferiores */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 px-4 sm:px-6 lg:px-10 pt-2 pb-4 backdrop-blur-md">
        <div className="mx-auto w-full rounded-2xl bg-white/10 border border-white/15 p-3">
          <div className="grid grid-cols-5 gap-3">
            <ActionBtn
              label="Lavando"
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'LAVANDO')}
              active={pedidoAbierto?.estado === 'LAVANDO'}
            />
            <ActionBtn
              label="Guardado"
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'GUARDADO')}
              active={pedidoAbierto?.estado === 'GUARDADO'}
            />
            <ActionBtn
              label="Entregar"
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'GUARDAR')}
              active={pedidoAbierto?.estado === 'GUARDAR'}
            />
            <ActionBtn
              label="Entregado"
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'ENTREGADO')}
              active={pedidoAbierto?.estado === 'ENTREGADO'}
            />
            <ActionBtn
              label={pedidoAbierto?.estado_pago === 'PAGADO' ? 'Pago' : 'Pendiente'}
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && togglePago(pedidoAbierto.id)}
              active={pedidoAbierto?.estado_pago === 'PAGADO'}
            />
          </div>

          {pedidoAbierto ? (
            <div className="mt-2 text-center text-xs text-white/90">
              Pedido seleccionado: <b>#{pedidoAbierto.id}</b>{' '}
              {saving && (
                <span className="inline-flex items-center gap-1">
                  <Loader2 size={14} className="animate-spin" /> Guardando…
                </span>
              )}
            </div>
          ) : (
            <div className="mt-2 text-center text-xs text-white/70">Abre un pedido para habilitar las acciones.</div>
          )}
        </div>
      </nav>

      {notice && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg bg-black/70 text-white text-sm shadow">
          {notice}
        </div>
      )}
    </main>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  active,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'rounded-xl py-3 text-sm font-medium border transition',
        active ? 'bg-white/20 border-white/30 text-white' : 'bg-white/5 border-white/10 text-white/90 hover:bg-white/10',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
