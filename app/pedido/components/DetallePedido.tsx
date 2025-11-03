'use client';

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle } from 'lucide-react';
import FotoModal from './FotoModal';

export type Item = {
  articulo: string;
  qty: number;
  valor: number;
  subtotal: number;
  estado: 'LAVAR';
};

export type Cliente = { telefono: string; nombre: string; direccion: string };
export type NextNumber = { nro: number; fecha: string; entrega: string };

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
  const [showFotoModal, setShowFotoModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
      // 1) Subir la foto (si existe)
      const foto_url = await uploadFotoIfAny(nroInfo.nro);

      // 2) Insertar pedido (sin foto_url para evitar error de columna)
      const { error: errPedido } = await supabase.from('pedido').insert({
        id: nroInfo.nro,
        telefono: cliente.telefono,
        nombre: cliente.nombre,
        direccion: cliente.direccion,
        total,
        estado: 'LAVAR',       // por defecto
        items,                 // JSON
        fecha: nroInfo.fecha,
        entrega: nroInfo.entrega,
        pagado: false,
      });
      if (errPedido) throw errPedido;

      // 3) Si hay URL, guardarla en la tabla pedido_foto (pedido_id + url)
      if (foto_url) {
        await supabase
          .from('pedido_foto')
          .insert({ pedido_id: nroInfo.nro, url: foto_url })
          .catch(() => {}); // si falla, no bloquear guardado
      }

      window.location.href = '/base';
    } catch (e: any) {
      setErr(e?.message ?? 'No se pudo guardar el pedido');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Tabla con doble clic para eliminar */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-violet-50 text-violet-900">
              <th className="text-left px-3 py-2 rounded-l-lg">Artículo</th>
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
                  onDoubleClick={() => onRemoveItem(idx)}
                  title="Doble clic para eliminar esta línea"
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
        {items.length > 0 && (
          <div className="mt-2 text-xs text-slate-500">Tip: haz <b>doble clic</b> en una fila para eliminarla.</div>
        )}
      </div>

      {/* Total + botón que abre el modal de foto + guardar */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <div className="text-2xl font-extrabold tracking-tight">Total {CLP.format(total)}</div>

          <button
            onClick={() => setShowFotoModal(true)}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 bg-white hover:bg-slate-50"
          >
            Tomar foto / Elegir
          </button>

          {fotoFile && (
            <div className="mt-2 text-xs text-slate-600">
              Seleccionado: <b>{fotoFile.name}</b>
            </div>
          )}
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

      {/* Modal de foto */}
      <FotoModal
        open={showFotoModal}
        onClose={() => setShowFotoModal(false)}
        onPick={(file) => setFotoFile(file)}
      />
    </>
  );
}
