'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, User, Table, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

type Item = { articulo: string; qty: number; valor: number };
type Pedido = {
  id: number;
  cliente_nombre: string;        // si tu columna se llama distinto, ver mapeo más abajo
  total: number | null;
  estado: 'LAVAR' | 'LAVANDO' | 'GUARDAR' | 'GUARDADO' | 'ENTREGADO';
  foto_url?: string | null;
  pagado?: boolean | null;
  items?: Item[];
};

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

export default function LavarPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [openDetail, setOpenDetail] = useState<Record<number, boolean>>({});
  const [imageError, setImageError] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);

  // === CARGA REAL DESDE SUPABASE ===
  useEffect(() => {
    let ignore = false;

    (async () => {
      setLoading(true);

      // Ajusta nombres de columnas si tu esquema difiere
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          id,
          cliente_nombre,
          total,
          estado,
          foto_url,
          pagado,
          pedido_items:pedido_items ( articulo, qty, valor )
        `)
        .eq('estado', 'LAVAR')
        .order('id', { ascending: false });

      if (!ignore) {
        if (error) {
          console.error('Supabase error:', error);
          setPedidos([]);
        } else {
          const mapped: Pedido[] =
            (data ?? []).map((p: any) => ({
              id: p.id,
              cliente_nombre: p.cliente_nombre ?? p.cliente ?? 'SIN NOMBRE',
              total: p.total ?? null,
              estado: p.estado,
              foto_url: p.foto_url,
              pagado: p.pagado ?? false,
              items: (p.pedido_items ?? []).map((it: any) => ({
                articulo: it.articulo,
                qty: it.qty,
                valor: it.valor,
              })),
            })) as Pedido[];
          setPedidos(mapped);
        }
        setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  const subtotal = (it: Item) => it.qty * it.valor;

  const pedidoAbierto = useMemo(
    () => pedidos.find((p) => p.id === openId) ?? null,
    [pedidos, openId]
  );

  // === ACTUALIZAR ESTADO / PAGO ===
  async function updatePedido(
    id: number,
    changes: Partial<Pick<Pedido, 'estado' | 'pagado'>>
  ) {
    setSaving(true);

    // Optimistic UI
    const prev = pedidos;
    const patched = pedidos.map((p) =>
      p.id === id ? { ...p, ...changes } : p
    );
    setPedidos(patched);

    const { error } = await supabase
      .from('pedidos')
      .update(changes)
      .eq('id', id)
      .select('id')
      .single();

    if (error) {
      console.error('No se pudo actualizar:', error);
      // revertir
      setPedidos(prev);
      setSaving(false);
      return;
    }

    setSaving(false);
  }

  function totalCalc(p: Pedido) {
    if (p.items && p.items.length > 0) {
      return p.items.reduce((acc, it) => acc + subtotal(it), 0);
    }
    return p.total ?? 0;
  }

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      <header className="relative z-10 flex items-center justify-between px-4 lg:px-10 py-3 lg:py-5">
        <h1 className="font-bold text-base lg:text-xl">Lavar</h1>
        <button
          onClick={() => router.push('/base')}
          className="text-xs lg:text-sm text-white/90 hover:text-white"
        >
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

        {!loading &&
          pedidos.map((p) => {
            const isOpen = openId === p.id;
            const detOpen = !!openDetail[p.id];

            return (
              <div
                key={p.id}
                className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md shadow-[0_6px_20px_rgba(0,0,0,0.15)]"
              >
                {/* Cabecera del pedido */}
                <button
                  onClick={() => setOpenId(isOpen ? null : p.id)}
                  className="w-full flex items-center justify-between gap-3 lg:gap-4 px-3 sm:px-4 lg:px-6 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/15 border border-white/20">
                      <User size={18} />
                    </span>
                    <div className="text-left">
                      <div className="font-extrabold tracking-wide text-sm lg:text-base">
                        N° {p.id}
                      </div>
                      <div className="text-[10px] lg:text-xs uppercase text-white/85">
                        {p.cliente_nombre}
                        {p.pagado ? ' • PAGADO' : ' • PENDIENTE'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 lg:gap-4">
                    <div className="font-extrabold text-white/95 text-sm lg:text-base">
                      {CLP.format(totalCalc(p))}
                    </div>
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-3 sm:px-4 lg:px-6 pb-3 lg:pb-5">
                    <div className="rounded-xl bg-white/8 border border-white/15 p-2 lg:p-3">
                      {/* ÚNICO ACORDEÓN: Detalle */}
                      <button
                        onClick={() =>
                          setOpenDetail((prev) => ({
                            ...prev,
                            [p.id]: !prev[p.id],
                          }))
                        }
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center gap-2">
                          <Table size={16} />
                          <span className="font-semibold">Detalle Pedido</span>
                        </div>
                        {detOpen ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </button>

                      {detOpen && (
                        <div className="mt-3 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex justify-center">
                          <div className="overflow-x-auto w-full max-w-5xl">
                            <table className="w-full text-xs lg:text-sm text-white/95">
                              <thead className="bg-white/10 text-white/90">
                                <tr>
                                  <th className="text-left px-3 py-2 w-[40%]">
                                    Artículo
                                  </th>
                                  <th className="text-right px-3 py-2 w-[15%]">
                                    Can.
                                  </th>
                                  <th className="text-right px-3 py-2 w-[20%]">
                                    Valor
                                  </th>
                                  <th className="text-right px-3 py-2 w-[25%]">
                                    Subtotal
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/10">
                                {p.items?.length ? (
                                  p.items.map((it, idx) => (
                                    <tr key={idx}>
                                      <td className="px-3 py-2 truncate">
                                        {it.articulo.length > 20
                                          ? it.articulo.slice(0, 20) + '...'
                                          : it.articulo}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        {it.qty}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        {CLP.format(it.valor)}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        {CLP.format(it.qty * it.valor)}
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td
                                      className="px-3 py-4 text-center text-white/70"
                                      colSpan={4}
                                    >
                                      Sin artículos registrados.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>

                            <div className="px-3 py-3 bg-white/10 text-right font-extrabold text-white">
                              Total: {CLP.format(totalCalc(p))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* IMAGEN SIEMPRE VISIBLE, ABAJO */}
                      <div className="mt-3 rounded-xl overflow-hidden bg-black/20 border border-white/10">
                        {p.foto_url && !imageError[p.id] ? (
                          <div className="relative w-full aspect-[16/9] lg:h-72">
                            <Image
                              src={p.foto_url}
                              alt={`Foto pedido ${p.id}`}
                              fill
                              sizes="(max-width: 1024px) 100vw, 1200px"
                              onError={() =>
                                setImageError((prev) => ({ ...prev, [p.id]: true }))
                              }
                              className="object-cover"
                              priority={false}
                            />
                          </div>
                        ) : (
                          <div className="p-6 text-sm text-white/70">
                            Sin imagen adjunta.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </section>

      {/* BARRA INFERIOR: CAMBIAR ESTADO Y PAGO */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 px-4 sm:px-6 lg:px-10 pt-2 pb-4 backdrop-blur-md">
        <div className="mx-auto w-full rounded-2xl bg-white/10 border border-white/15 p-3">
          <div className="grid grid-cols-5 gap-3">
            <ActionBtn
              label="Lavando"
              disabled={!pedidoAbierto || saving}
              onClick={() =>
                pedidoAbierto &&
                updatePedido(pedidoAbierto.id, { estado: 'LAVANDO' })
              }
              active={pedidoAbierto?.estado === 'LAVANDO'}
            />
            <ActionBtn
              label="Guardado"
              disabled={!pedidoAbierto || saving}
              onClick={() =>
                pedidoAbierto &&
                updatePedido(pedidoAbierto.id, { estado: 'GUARDADO' })
              }
              active={pedidoAbierto?.estado === 'GUARDADO'}
            />
            <ActionBtn
              label="Entregar"
              disabled={!pedidoAbierto || saving}
              onClick={() =>
                pedidoAbierto &&
                updatePedido(pedidoAbierto.id, { estado: 'GUARDAR' })
              }
              active={pedidoAbierto?.estado === 'GUARDAR'}
            />
            <ActionBtn
              label="Entregado"
              disabled={!pedidoAbierto || saving}
              onClick={() =>
                pedidoAbierto &&
                updatePedido(pedidoAbierto.id, { estado: 'ENTREGADO' })
              }
              active={pedidoAbierto?.estado === 'ENTREGADO'}
            />
            <ActionBtn
              label={pedidoAbierto?.pagado ? 'Pagado' : 'Pendiente'}
              disabled={!pedidoAbierto || saving}
              onClick={() =>
                pedidoAbierto &&
                updatePedido(pedidoAbierto.id, { pagado: !pedidoAbierto.pagado })
              }
              active={!!pedidoAbierto?.pagado}
            />
          </div>
          {pedidoAbierto && (
            <div className="mt-2 text-center text-xs text-white/90">
              Pedido seleccionado: <b>#{pedidoAbierto.id}</b>{' '}
              {saving && (
                <span className="inline-flex items-center gap-1">
                  <Loader2 size={14} className="animate-spin" /> Guardando…
                </span>
              )}
            </div>
          )}
          {!pedidoAbierto && (
            <div className="mt-2 text-center text-xs text-white/70">
              Abre un pedido para aplicar las acciones de estado o pago.
            </div>
          )}
        </div>
      </nav>
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
