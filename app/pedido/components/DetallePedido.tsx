'use client';

import { useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, Plus, Camera, Image as ImageIcon, X } from 'lucide-react';
import type { Cliente, NextNumber } from './HeaderPedido';

export type Item = { articulo: string; qty: number; valor: number; subtotal: number; estado: 'LAVAR' };
const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

export default function DetallePedido({
  cliente,
  nroInfo,
  items,
}: {
  cliente: Cliente | null;
  nroInfo: NextNumber | null;
  items: Item[];
}) {
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Speed-dial (abanico)
  const [openDial, setOpenDial] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);

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

      // Ajustado a columnas reales: usamos `nombre` en lugar de `cliente`
      const { error } = await supabase.from('pedido').insert({
        id: nroInfo.nro,
        nombre: cliente.nombre,           // <— importante
        telefono: cliente.telefono,
        direccion: cliente.direccion,
        total,
        estado: 'LAVAR',
        items,                            // JSON
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
                <tr key={idx} className="border-b last:border-b-0">
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

      {/* Total + foto (abanico) + guardar */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
        <div>
          <div className="text-2xl font-extrabold tracking-tight">Total {CLP.format(total)}</div>

          {/* Speed Dial / Abanico */}
          <div className="relative mt-4 h-20 w-40">
            {/* Botones del abanico (aparecen alrededor) */}
            <button
              aria-label="Tomar foto"
              onClick={() => cameraInputRef.current?.click()}
              className={`absolute left-2 top-2 inline-flex items-center justify-center w-11 h-11 rounded-full bg-white text-violet-700 border border-violet-200 shadow transition
                ${openDial ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3 pointer-events-none'}`}
              title="Tomar foto"
            >
              <Camera className="w-5 h-5" />
            </button>

            <button
              aria-label="Elegir imagen"
              onClick={() => pickerInputRef.current?.click()}
              className={`absolute right-2 top-9 inline-flex items-center justify-center w-11 h-11 rounded-full bg-white text-violet-700 border border-violet-200 shadow transition
                ${openDial ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3 pointer-events-none'}`}
              title="Elegir de la galería"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            {/* Botón principal (toggle) */}
            <button
              onClick={() => setOpenDial(v => !v)}
              aria-label="Opciones de foto"
              className="absolute left-1/2 -translate-x-1/2 bottom-0 inline-flex items-center justify-center w-14 h-14 rounded-full
                         bg-gradient-to-r from-violet-700 to-fuchsia-600 text-white shadow-xl"
              title="Opciones de foto"
            >
              {openDial ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
            </button>

            {/* Inputs ocultos */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
            />
            <input
              ref={pickerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
            />
          </div>

          {fotoFile && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2.5 text-violet-800">
              {fotoFile.name}
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
    </>
  );
}
