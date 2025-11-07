'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Plus, Save, Trash2, ArrowLeft } from 'lucide-react';

type Linea = {
  id?: number;            // opcional si tienes PK propia
  pedido_id: number;
  articulo: string;
  cantidad: number;
  valor: number;
  _tmp?: string;          // helper local para key
};

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export default function EditarPedidoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const pedidoId = Number(params?.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [cliente, setCliente] = useState<string>('');
  const [estado, setEstado] = useState<string>('');
  const [pagado, setPagado] = useState<boolean>(false);
  const [lineas, setLineas] = useState<Linea[]>([]);

  const total = useMemo(
    () => lineas.reduce((a, l) => a + (Number(l.cantidad) || 0) * (Number(l.valor) || 0), 0),
    [lineas]
  );

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // Cabecera del pedido (usa nro=id)
        const { data: p, error: ep } = await supabase
          .from('pedido')
          .select('nro, telefono, total, estado, pagado')
          .eq('nro', pedidoId)
          .single();
        if (ep) throw ep;

        // Nombre por teléfono
        const tel = p?.telefono ? String(p.telefono) : '';
        let nombre = tel;
        if (tel) {
          const { data: c } = await supabase.from('clientes').select('nombre').eq('telefono', tel).maybeSingle();
          if (c?.nombre) nombre = c.nombre;
        }

        const { data: ls, error: el } = await supabase
          .from('pedido_linea')
          .select('id, pedido_id, articulo, cantidad, valor')
          .eq('pedido_id', pedidoId)
          .order('id', { ascending: true });
        if (el) throw el;

        if (!cancel) {
          setCliente(nombre ?? tel ?? 'SIN NOMBRE');
          setEstado(p?.estado ?? '');
          setPagado(!!p?.pagado);
          setLineas((ls ?? []).map((l, i) => ({ ...l, _tmp: `k${i}_${l.id ?? ''}` })));
        }
      } catch (e: any) {
        if (!cancel) setErr(e?.message ?? 'Error al cargar pedido');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [pedidoId]);

  function addLinea() {
    setLineas((prev) => [
      ...prev,
      {
        _tmp: `tmp_${Date.now()}`,
        pedido_id: pedidoId,
        articulo: '',
        cantidad: 1,
        valor: 0,
      },
    ]);
  }

  function rmLinea(idx: number) {
    setLineas((prev) => prev.filter((_, i) => i !== idx));
  }

  function updLinea(idx: number, patch: Partial<Linea>) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function guardar() {
    try {
      setSaving(true);
      setErr(null);

      // 1) Borra líneas “vacías” locales
      const limpias = lineas.filter((l) => String(l.articulo).trim() !== '');

      // 2) Upsert por (id) si existe, si no insert (pedido_id, articulo) como mínimos
      //    Ajusta a tu PK/UK reales. Aquí usamos "id" si está presente.
      const upsertPayload = limpias.map((l) => ({
        id: l.id, // puede venir undefined -> insert
        pedido_id: pedidoId,
        articulo: l.articulo,
        cantidad: Number(l.cantidad) || 0,
        valor: Number(l.valor) || 0,
      }));

      const { error: eu } = await supabase.from('pedido_linea').upsert(upsertPayload, {
        onConflict: 'id',
        ignoreDuplicates: false,
      });
      if (eu) throw eu;

      // 3) Recalcula total en cabecera
      const { error: ep } = await supabase.from('pedido').update({ total }).eq('nro', pedidoId);
      if (ep) throw ep;

      router.push('/lavando'); // vuelve a la lista de Lavando
    } catch (e: any) {
      setErr(e?.message ?? 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-900 via-fuchsia-800 to-indigo-900 text-white">
      <header className="flex items-center justify-between px-4 md:px-8 py-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-white/90 hover:text-white"
        >
          <ArrowLeft size={16} /> Volver
        </button>
        <h1 className="font-bold text-lg">Editar pedido #{pedidoId}</h1>
        <div />
      </header>

      <section className="px-4 md:px-8 pb-24">
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="animate-spin" size={18} /> Cargando…
          </div>
        ) : err ? (
          <div className="rounded-xl bg-red-500/20 border border-red-300/30 p-3 text-sm flex items-center gap-2">
            <span>⚠️</span> {err}
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-white/10 border border-white/15 p-4 mb-4">
              <div className="text-sm opacity-90">Cliente</div>
              <div className="text-lg font-extrabold">{cliente}</div>
              <div className="mt-2 text-xs opacity-90">
                Estado: <b>{estado}</b> • {pagado ? 'PAGADO' : 'PENDIENTE'}
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 border border-white/15 overflow-hidden">
              <div className="p-3 font-semibold bg-white/10">Detalle</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/10">
                    <tr>
                      <th className="text-left px-3 py-2 w-[42%]">Artículo</th>
                      <th className="text-right px-3 py-2 w-[15%]">Can.</th>
                      <th className="text-right px-3 py-2 w-[20%]">Valor</th>
                      <th className="text-right px-3 py-2 w-[20%]">Subtotal</th>
                      <th className="px-3 py-2 w-[3%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {lineas.map((l, idx) => (
                      <tr key={l._tmp ?? idx}>
                        <td className="px-3 py-2">
                          <input
                            className="w-full rounded border border-white/20 bg-white/5 px-2 py-1 outline-none"
                            value={l.articulo}
                            onChange={(e) => updLinea(idx, { articulo: e.target.value })}
                            placeholder="Descripción del artículo"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            className="w-20 rounded border border-white/20 bg-white/5 px-2 py-1 text-right outline-none"
                            value={l.cantidad}
                            onChange={(e) => updLinea(idx, { cantidad: Number(e.target.value) })}
                            min={0}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            className="w-28 rounded border border-white/20 bg-white/5 px-2 py-1 text-right outline-none"
                            value={l.valor}
                            onChange={(e) => updLinea(idx, { valor: Number(e.target.value) })}
                            min={0}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          {CLP.format((Number(l.cantidad) || 0) * (Number(l.valor) || 0))}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => rmLinea(idx)}
                            className="rounded-lg p-2 hover:bg-white/10"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-white/10">
                      <td className="px-3 py-3" colSpan={3}>
                        <button
                          onClick={addLinea}
                          className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-3 py-2 hover:bg-white/15"
                        >
                          <Plus size={16} /> Agregar ítem
                        </button>
                      </td>
                      <td className="px-3 py-3 text-right font-extrabold">{CLP.format(total)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                disabled={saving}
                onClick={guardar}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <Save size={18} />
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
