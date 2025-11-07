'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Trash2, Plus, Save, AlertTriangle } from 'lucide-react';

type Linea = {
  id?: number | null;
  pedido_id: number;
  articulo: string;
  cantidad: number;
  valor: number;
};

type PedidoHead = {
  nro: number;
  telefono: string | null;
  estado: string | null;
  pagado: boolean | null;
};

type Cliente = { telefono: string; nombre: string | null };
type ArticuloCat = { id?: number; nombre?: string; valor?: number | null };

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export default function EditarPedidoPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params?.id);

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [head, setHead] = useState<PedidoHead | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [articulos, setArticulos] = useState<ArticuloCat[]>([]);
  const [selArt, setSelArt] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<null | { idx: number; linea: Linea }>(null);

  const total = useMemo(
    () => lineas.reduce((a, l) => a + (Number(l.cantidad) || 0) * (Number(l.valor) || 0), 0),
    [lineas]
  );

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        setErrMsg(null);

        // Encabezado del pedido
        const { data: pRow, error: eP } = await supabase
          .from('pedido')
          .select('nro, telefono, estado, pagado')
          .eq('nro', id)
          .limit(1)
          .maybeSingle();
        if (eP) throw eP;
        if (!pRow) throw new Error('Pedido no encontrado');

        // Cliente
        let cli: Cliente | null = null;
        if (pRow.telefono) {
          const { data: cRow, error: eC } = await supabase
            .from('clientes')
            .select('telefono, nombre')
            .eq('telefono', pRow.telefono)
            .limit(1)
            .maybeSingle();
          if (eC) throw eC;
          cli = cRow ?? null;
        }

        // Líneas del pedido
        const { data: lRows, error: eL } = await supabase
          .from('pedido_linea')
          .select('id, pedido_id, articulo, cantidad, valor')
          .eq('pedido_id', id);
        if (eL) throw eL;

        // Catálogo de artículos (usa columna nombre, no articulo)
        const { data: aRows, error: eA } = await supabase
          .from('articulo')
          .select('id, nombre, valor')
          .order('nombre', { ascending: true });
        if (eA) throw eA;

        if (!cancel) {
          setHead(pRow as PedidoHead);
          setCliente(cli);
          setLineas(
            (lRows ?? []).map((l: any) => ({
              id: l.id ?? null,
              pedido_id: l.pedido_id ?? id,
              articulo: String(l.articulo ?? ''),
              cantidad: Number(l.cantidad ?? 0),
              valor: Number(l.valor ?? 0),
            }))
          );
          setArticulos(aRows ?? []);
          setLoading(false);
        }
      } catch (err: any) {
        console.error(err);
        if (!cancel) {
          setErrMsg(err?.message ?? 'Error al cargar datos');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [id]);

  function nombreFromCat(a: ArticuloCat): string {
    return (a.nombre ?? '').toString();
  }

  function valorFromCat(a: ArticuloCat): number {
    const v = Number(a.valor ?? 0);
    return Number.isFinite(v) ? v : 0;
  }

  function agregarLineaDesdeSelect() {
    if (!selArt) return;
    const cat = articulos.find((a) => nombreFromCat(a).toUpperCase() === selArt.toUpperCase());
    const nombre = cat ? nombreFromCat(cat) : selArt;
    const val = cat ? valorFromCat(cat) : 0;

    setLineas((prev) => [
      ...prev,
      { pedido_id: id, articulo: nombre, cantidad: 1, valor: val, id: undefined },
    ]);
    setSelArt('');
  }

  function setCantidad(idx: number, v: number) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, cantidad: v } : l)));
  }

  function setValor(idx: number, v: number) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, valor: v } : l)));
  }

  async function guardarCambios() {
    try {
      setSaving(true);
      setErrMsg(null);

      await supabase.from('pedido_linea').delete().eq('pedido_id', id);

      const payload = lineas
        .filter((l) => (l.articulo ?? '').trim() !== '')
        .map((l) => ({
          pedido_id: id,
          articulo: l.articulo.trim(),
          cantidad: Number(l.cantidad || 0),
          valor: Number(l.valor || 0),
        }));

      if (payload.length) {
        const { error: insErr } = await supabase.from('pedido_linea').insert(payload);
        if (insErr) throw insErr;
      }

      const { error: upErr } = await supabase.from('pedido').update({ total }).eq('nro', id);
      if (upErr) throw upErr;

      router.push('/lavando');
    } catch (err: any) {
      console.error(err);
      setErrMsg(err?.message ?? 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800">
      <header className="px-4 lg:px-8 py-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-white/90 hover:text-white"
        >
          <ArrowLeft size={18} /> Volver
        </button>
        <h1 className="mx-auto font-extrabold text-lg sm:text-xl">Editar pedido #{id}</h1>
      </header>

      <section className="px-4 lg:px-8 pb-28 grid gap-4">
        {loading && <div className="text-white/90">Cargando…</div>}

        {!loading && errMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-300/30 p-3 text-sm">
            <AlertTriangle size={16} />
            <span>{errMsg}</span>
          </div>
        )}

        {!loading && head && (
          <>
            <div className="rounded-2xl bg-white/10 border border-white/15 p-4">
              <div className="text-xs uppercase text-white/70 mb-1">Cliente</div>
              <div className="text-xl font-extrabold tracking-wide">
                {cliente?.nombre ?? head.telefono ?? 'SIN NOMBRE'}
              </div>
              <div className="text-xs text-white/80 mt-1">
                Estado: {String(head.estado ?? '').toUpperCase() || '—'} •{' '}
                {head.pagado ? 'PAGADO' : 'PENDIENTE'}
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 border border-white/15 p-4">
              <div className="text-sm font-semibold mb-3">Detalle</div>

              <div className="grid gap-2 sm:flex sm:items-center sm:gap-3 mb-3">
                <select
                  className="w-full sm:w-auto min-w-[260px] rounded-xl bg-white/10 border border-white/20 px-3 py-2 outline-none"
                  value={selArt}
                  onChange={(e) => setSelArt(e.target.value)}
                >
                  <option value="">SELECCIONE UN ARTÍCULO</option>
                  {articulos.map((a) => (
                    <option key={a.id ?? a.nombre} value={a.nombre}>
                      {a.nombre} {a.valor ? `(${CLP.format(a.valor)})` : ''}
                    </option>
                  ))}
                </select>

                <button
                  onClick={agregarLineaDesdeSelect}
                  disabled={!selArt}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/15 border border-white/20 px-3 py-2 text-sm hover:bg-white/20 disabled:opacity-50"
                >
                  <Plus size={16} /> Agregar ítem
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
                <table className="w-full text-sm">
                  <thead className="bg-white/10 text-white/90">
                    <tr>
                      <th className="text-left px-3 py-2 w-[45%]">Artículo</th>
                      <th className="text-right px-3 py-2 w-[12%]">Cantidad</th>
                      <th className="text-right px-3 py-2 w-[18%]">Valor</th>
                      <th className="text-right px-3 py-2 w-[18%]">Subtotal</th>
                      <th className="px-3 py-2 w-[7%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {lineas.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-white/70">
                          Sin líneas. Usa el selector para agregar.
                        </td>
                      </tr>
                    )}
                    {lineas.map((l, idx) => {
                      const subtotal = (Number(l.cantidad) || 0) * (Number(l.valor) || 0);
                      return (
                        <tr
                          key={`${idx}-${l.articulo}`}
                          className="hover:bg-white/5 cursor-pointer"
                          onClick={() => setToDelete({ idx, linea: l })}
                        >
                          <td className="px-3 py-2">
                            <input
                              value={l.articulo}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                setLineas((prev) =>
                                  prev.map((x, i) =>
                                    i === idx ? { ...x, articulo: e.target.value } : x
                                  )
                                )
                              }
                              className="w-full rounded-lg bg-white/10 border border-white/15 px-2 py-1 outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              value={l.cantidad}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setCantidad(idx, Number(e.target.value))}
                              className="w-20 text-right rounded-lg bg-white/10 border border-white/15 px-2 py-1 outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              value={l.valor}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setValor(idx, Number(e.target.value))}
                              className="w-28 text-right rounded-lg bg-white/10 border border-white/15 px-2 py-1 outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">{CLP.format(subtotal)}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setToDelete({ idx, linea: l });
                              }}
                              className="inline-flex items-center rounded-lg px-2 py-1 hover:bg-white/10"
                              title="Eliminar"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="px-3 py-3 bg-white/10 text-right font-extrabold">
                  Total: {CLP.format(total)}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={guardarCambios}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-5 py-3 font-semibold shadow disabled:opacity-60"
              >
                <Save size={18} />
                Guardar cambios
              </button>
            </div>
          </>
        )}
      </section>

      {toDelete && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 px-4">
          <div className="w-[520px] max-w-full rounded-2xl bg-white text-violet-900 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b">
              <div className="font-bold">Eliminar ítem</div>
              <div className="text-sm text-violet-700/80">
                ¿Deseas eliminar <b>{toDelete.linea.articulo}</b> del pedido?
              </div>
            </div>
            <div className="px-5 py-4 flex justify-end gap-2">
              <button
                onClick={() => setToDelete(null)}
                className="rounded-xl px-4 py-2 hover:bg-violet-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setLineas((prev) => prev.filter((_, i) => i !== toDelete.idx));
                  setToDelete(null);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2"
              >
                <Trash2 size={16} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
