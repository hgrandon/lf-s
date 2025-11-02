'use client';

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Camera, ImagePlus, Loader2, AlertTriangle } from 'lucide-react';
import type { Cliente, NextNumber } from './HeaderPedido';

export type Item = { articulo: string; qty: number; valor: number; subtotal: number; estado: 'LAVAR' };
const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

export default function DetallePedido({
  cliente,
  nroInfo,
  items,
  onRemoveItem,
}: {
  cliente: Cliente | null;
  nroInfo: NextNumber | null;
  items: Item[];
  onRemoveItem: (idx: number) => void;
}) {
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // modal de confirmación para eliminar en doble click
  const [confirm, setConfirm] = useState<{ open: boolean; index: number | null; label?: string }>({
    open: false,
    index: null,
    label: '',
  });

  const total = useMemo(() => items.reduce((acc, it) => acc + it.subtotal, 0), [items]);

  async function uploadFotoIfAny(nro: number): Promise<string | null> {
    if (!fotoFile) return null;
    const filename = `pedido_${nro}_${Date.now()}_${fotoFile.name}`.replace(/\s+/g, '_');
    const { data, error } = await supabase.storage.from('fotos').upload(filename, fotoFile, { upsert: true });
    if (error || !data) return null;
    const { data: pub } = supabase.storage.from('fotos').getPublicUrl(data.path);
    return pub?.publicUrl || null;
  }

  async function guardarPedido() {
    if (!cliente) { setErr('Ingrese un teléfono válido o cree el cliente.'); return; }
    if (!nroInfo) { setErr('No se pudo determinar el correlativo.'); return; }
    if (items.length === 0) { setErr('Agregue al menos un artículo.'); return; }

    setSaving(true);
    setErr(null);
    try {
      const foto_url = await uploadFotoIfAny(nroInfo.nro);
      const { error } = await supabase.from('pedido').insert({
        id: nroInfo.nro,
        cliente: cliente.nombre,
        telefono: cliente.telefono,
        direccion: cliente.direccion,
        total,
        estado: 'LAVAR',
        items,
        fecha: nroInfo.fecha,
        entrega: nroInfo.entrega,
        foto_url,
        pagado: false,
      });
      if (error) throw error;
      window.location.href = '/base';
    } catch (e: any) {
      setErr(e?.message ?? 'No se pudo guardar el pedido');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm select-none">
          <thead>
            <tr className="bg-violet-50 text-violet-900">
              <th className="text-left  px-3 py-2 rounded-l-lg">Artículo</th>
              <th className="text-right px-3 py-2">Cantidad</th>
              <th className="text-right px-3 py-2">Valor</th>
              <th className="text-right px-3 py-2 rounded-r-lg">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-slate-500 py-6">Sin artículos todavía.</td>
              </tr>
            ) : (
              items.map((it, idx) => (
                <tr
                  key={idx}
                  className="border-b last:border-b-0 cursor-pointer hover:bg-violet-50/60"
                  onDoubleClick={() =>
                    setConfirm({ open: true, index: idx, label: `${it.articulo}  ×${it.qty}  — ${CLP.format(it.subtotal)}` })
                  }
                  title="Doble clic para eliminar"
                >
                  <td className="px-3 py-2">{it.articulo}</td>
                  <td className="px-3 py-2 text-right">{it.qty}</td>
                  <td className="px-3 py-2 text-right">{CLP.format(it.valor)}</td>
                  <td className="px-3 py-2 text-right">{CLP.format(it.subtotal)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Total + foto + guardar */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div>
          <div className="text-2xl font-extrabold tracking-tight">Total {CLP.format(total)}</div>
          <div className="flex gap-2 mt-3">
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 bg-white cursor-pointer hover:bg-slate-50">
              <Camera className="w-4 h-4 text-violet-700" />
              Tomar foto / Elegir
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
              />
            </label>
            {fotoFile && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2.5 text-violet-800">
                <ImagePlus className="w-4 h-4" />
                {fotoFile.name}
              </div>
            )}
          </div>
        </div>

        <div className="flex md:justify-end">
          <button
            onClick={guardarPedido}
            disabled={saving || !cliente || items.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 text-white px-5 py-3 text-base font-semibold hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Guardar Pedido
          </button>
        </div>
      </div>

      {err && (
        <div className="mt-4 flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-sm">
          <AlertTriangle className="w-4 h-4" />
          {err}
        </div>
      )}

      {/* Modal de confirmación de eliminación (doble click) */}
      {confirm.open && confirm.index !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-width[520px] max-w-md rounded-2xl bg-white p-5 shadow-2xl text-slate-900">
            <div className="flex items-center gap-2 text-rose-700 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-lg font-bold">Eliminar ítem</h3>
            </div>
            <p className="text-sm text-slate-600">
              ¿Deseas eliminar <b>{confirm.label}</b> del pedido?
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirm({ open: false, index: null })}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (confirm.index !== null) onRemoveItem(confirm.index);
                  setConfirm({ open: false, index: null });
                }}
                className="rounded-xl bg-rose-600 text-white px-4 py-2.5 font-semibold hover:bg-rose-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
