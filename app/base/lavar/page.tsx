'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, User, Table, Loader2, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

type Item = { articulo: string; qty: number; valor: number };
type Estado = 'LAVAR' | 'LAVANDO' | 'GUARDAR' | 'GUARDADO' | 'ENTREGADO';

type Pedido = {
  id: number;             // nro
  cliente: string;        // nombre o telefono
  total: number | null;
  estado: Estado;
  detalle?: string | null;
  foto_url?: string | null;
  pagado?: boolean | null; // mapeado desde estado_pago
  items?: Item[];
};

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

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
  const [canUpdateEstado, setCanUpdateEstado] = useState(true); // se pone en false si no existe columna estado

  const pedidoAbierto = useMemo(() => pedidos.find(p => p.id === openId) ?? null, [pedidos, openId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErrMsg(null);
        setCanUpdateEstado(true);

        // 1) Intento principal: leer desde public.pedido (con columna estado)
        let rows: any[] | null = null;
        let e1: any = null;

        const q1 = await supabase
          .from('pedido')
          .select('id:nro, telefono, total, estado, detalle, estado_pago, fotos_urls')
          .eq('estado', 'LAVAR')
          .order('nro', { ascending: false });

        if (q1.error) e1 = q1.error;
        rows = q1.data || null;

        // Si la columna "estado" no existe (error 42703), hacemos fallback a la vista
        if (e1 && String(e1.message).toLowerCase().includes('column') && String(e1.message).toLowerCase().includes('does not exist')) {
          setCanUpdateEstado(false);

          const qView = await supabase
            .from('vw_pedido_resumen')
            .select('id:nro, telefono, total, estado, detalle, estado_pago, fotos_urls')
            .eq('estado', 'LAVAR')
            .order('nro', { ascending: false });

          if (qView.error) throw qView.error;
          rows = qView.data || null;
        } else if (e1) {
          throw e1;
        }

        const ids = (rows ?? []).map(r => r.id);
        const tels = (rows ?? []).map(r => r.telefono).filter(Boolean);

        if (!rows?.length) {
          if (!cancelled) {
            setPedidos([]);
            setLoading(false);
          }
          return;
        }

        // 2) Líneas por nro
        const q2 = await supabase
          .from('pedido_linea')
          .select('pedido_id:nro, articulo, cantidad, valor')
          .in('nro', ids);

        if (q2.error) throw q2.error;

        // 3) Fotos de respaldo en pedido_foto (por nro)
        const q3 = await supabase
          .from('pedido_foto')
          .select('nro, url')
          .in('nro', ids);

        if (q3.error) throw q3.error;

        // 4) Nombres por teléfono
        const q4 = await supabase
          .from('clientes')
          .select('telefono, nombre')
          .in('telefono', tels);

        if (q4.error) throw q4.error;

        const nombreByTel = new Map<string, string>();
        (q4.data ?? []).forEach(c => nombreByTel.set(String(c.telefono), c.nombre ?? 'SIN NOMBRE'));

        const itemsByPedido = new Map<number, Item[]>();
        (q2.data ?? []).forEach((l: any) => {
          const pid = Number(l.pedido_id ?? l.nro);
          const arr = itemsByPedido.get(pid) ?? [];
          arr.push({
            articulo: String(l.articulo ?? ''),
            qty: Number(l.cantidad ?? 0),
            valor: Number(l.valor ?? 0),
          });
          itemsByPedido.set(pid, arr);
        });

        const fotoByPedido = new Map<number, string>();
        // prioridad: fotos_urls en la fila de pedido (o de la vista)
        (rows ?? []).forEach((r: any) => {
          const f = firstFotoFromMixed(r.fotos_urls);
          if (f) fotoByPedido.set(r.id, f);
        });
        // respaldo: pedido_foto
        (q3.data ?? []).forEach((f: any) => {
          const pid = Number(f.nro);
          if (!fotoByPedido.has(pid) && typeof f.url === 'string' && f.url) {
            fotoByPedido.set(pid, f.url);
          }
        });

        const mapped: Pedido[] = (rows ?? []).map((r: any) => ({
          id: r.id,
          cliente: nombreByTel.get(String(r.telefono)) ?? String(r.telefono ?? 'SIN NOMBRE'),
          total: r.total ?? null,
          estado: r.estado as Estado,
          detalle: r.detalle ?? null,
          foto_url: fotoByPedido.get(r.id) ?? null,
          pagado: (r.estado_pago ?? '').toString().toUpperCase() === 'PAGADO',
          items: itemsByPedido.get(r.id) ?? [],
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
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const subtotal = (it: Item) => it.qty * it.valor;

  function snack(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 1800);
  }

  // Cambiar estado (requiere columna 'estado' en public.pedido)
  async function changeEstado(id: number, next: Estado) {
    if (!id) return;
    if (!canUpdateEstado) {
      snack('Para cambiar el estado crea la columna "estado" en public.pedido (ver SQL más abajo).');
      return;
    }

    setSaving(true);
    const prev = pedidos;
    setPedidos(prev.map(p => (p.id === id ? { ...p, estado: next } : p)));

    const { error } = await supabase.from('pedido').update({ estado: next }).eq('nro', id).select('nro').single();
    if (error) {
      console.error('No se pudo actualizar estado:', error);
      setPedidos(prev);
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

  // Toggle pago (usa estado_pago en public.pedido)
  async function togglePago(id: number) {
    if (!id) return;
    setSaving(true);
    const prev = pedidos;
    const actual = prev.find(p => p.id === id)?.pagado ?? false;
    setPedidos(prev.map(p => (p.id === id ? { ...p, pagado: !actual } : p)));

    const nuevo = !actual ? 'PAGADO' : 'PENDIENTE';
    const { error } = await supabase.from('pedido').update({ estado_pago: nuevo }).eq('nro', id).select('nro').single();

    if (error) {
      console.error('No se pudo actualizar pago:', error);
      setPedidos(prev);
      setSaving(false);
      return;
    }

    snack(`Pedido #${id} marcado como ${!actual ? 'Pagado' : 'Pendiente'}`);
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

        {!loading && !errMsg &&
          pedidos.map(p => {
            const isOpen = openId === p.id;
            const detOpen = !!openDetail[p.id];
            const totalCalc = p.items?.length ? p.items.reduce((a, it) => a + subtotal(it), 0) : p.total ?? 0;

            return (
              <div
                key={p.id}
                className={[
                  'rounded-2xl bg-white/10 border backdrop-blur-md shadow-[0_6px_20px_rgba(0,0,0,0.15)]',
                  isOpen ? 'border-white/40' : 'border-white/15',
                ].join(' ')}
              >
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
                        {p.cliente} {p.pagado ? '• PAGADO' : '• PENDIENTE'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 lg:gap-4">
                    <div className="font-extrabold text-white/95 text-sm lg:text-base">{CLP.format(totalCalc)}</div>
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-3 sm:px-4 lg:px-6 pb-3 lg:pb-5">
                    <div className="rounded-xl bg-white/8 border border-white/15 p-2 lg:p-3">
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

      <nav className="fixed bottom-0 left-0 right-0 z-20 px-4 sm:px-6 lg:px-10 pt-2 pb-4 backdrop-blur-md">
        <div className="mx-auto w-full rounded-2xl bg-white/10 border border-white/15 p-3">
          <div className="grid grid-cols-5 gap-3">
            <ActionBtn
              label="Lavando"
              disabled={!pedidoAbierto || saving || !canUpdateEstado}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'LAVANDO')}
              active={pedidoAbierto?.estado === 'LAVANDO'}
            />
            <ActionBtn
              label="Guardado"
              disabled={!pedidoAbierto || saving || !canUpdateEstado}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'GUARDADO')}
              active={pedidoAbierto?.estado === 'GUARDADO'}
            />
            <ActionBtn
              label="Entregar"
              disabled={!pedidoAbierto || saving || !canUpdateEstado}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'GUARDAR')}
              active={pedidoAbierto?.estado === 'GUARDAR'}
            />
            <ActionBtn
              label="Entregado"
              disabled={!pedidoAbierto || saving || !canUpdateEstado}
              onClick={() => pedidoAbierto && changeEstado(pedidoAbierto.id, 'ENTREGADO')}
              active={pedidoAbierto?.estado === 'ENTREGADO'}
            />
            <ActionBtn
              label={pedidoAbierto?.pagado ? 'Pago' : 'Pendiente'}
              disabled={!pedidoAbierto || saving}
              onClick={() => pedidoAbierto && togglePago(pedidoAbierto.id)}
              active={!!pedidoAbierto?.pagado}
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
              {!canUpdateEstado && (
                <div className="mt-1 text-amber-200/90">
                  Estados en modo lectura: crea la columna <b>estado</b> en <b>public.pedido</b> para habilitar.
                </div>
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
        active
          ? 'bg-white/20 border-white/30 text-white'
          : 'bg-white/5 border-white/10 text-white/90 hover:bg-white/10',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
