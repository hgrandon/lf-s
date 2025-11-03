'use client';

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Camera,
  ImagePlus,
  Loader2,
  AlertTriangle,
  ChevronDown,
  XCircle,
} from 'lucide-react';

export type Item = {
  articulo: string;
  qty: number;
  valor: number;
  subtotal: number;
  estado: 'LAVAR';
};

export type Cliente = { telefono: string; nombre: string; direccion: string };
export type NextNumber = { nro: number; fecha: string; entrega: string };

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

const MAX_FILE_MB = 8;
const ALLOWED_IMG = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

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
  const [showFotoFan, setShowFotoFan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const total = useMemo(
    () => items.reduce((acc, it) => acc + it.subtotal, 0),
    [items]
  );

  function validateAndSetFile(file: File | null) {
    if (!file) {
      setFotoFile(null);
      return;
    }
    if (!ALLOWED_IMG.includes(file.type)) {
      setErr('Formato de imagen no permitido (usa JPG, PNG o WEBP).');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setErr(`La imagen supera ${MAX_FILE_MB} MB.`);
      return;
    }
    setErr(null);
    setFotoFile(file);
  }

  async function uploadFotoIfAny(nro: number): Promise<string | null> {
    if (!fotoFile) return null;
    const cleanName = fotoFile.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const filename = `pedido_${nro}_${Date.now()}_${cleanName}`.replace(/\s+/g, '_');

    const { data, error } = await supabase.storage
      .from('fotos')
      .upload(filename, fotoFile, { upsert: true });

    if (error || !data) return null;

    const { data: pub } = supabase.storage.from('fotos').getPublicUrl(data.path);
    return pub?.publicUrl || null;
  }

  async function guardarPedido() {
    if (!cliente) {
      setErr('Ingrese un teléfono válido o cree el cliente.');
      return;
    }
    if (!nroInfo) {
      setErr('No se pudo determinar el correlativo.');
      return;
    }
    if (items.length === 0) {
      setErr('Agregue al menos un artículo.');
      return;
    }

    setSaving(true);
    setErr(null);

    try {
      // 1) Insertar el pedido (sin foto_url)
      const { error: errPedido } = await supabase.from('pedido').insert({
        id: nroInfo.nro,
        telefono: cliente.telefono,
        nombre: cliente.nombre,
        direccion: cliente.direccion,
        total,
        estado: 'LAVAR', // por defecto
        items, // JSON
        fecha: nroInfo.fecha,
        entrega: nroInfo.entrega,
        pagado: false,
      });

      if (errPedido) throw errPedido;

      // 2) Subir imagen (si hay) y registrar en pedido_foto
      const fotoUrl = await uploadFotoIfAny(nroInfo.nro);
      if (fotoUrl) {
        const { error: errFoto } = await supabase
          .from('pedido_foto')
          .insert({ pedido_id: nroInfo.nro, url: fotoUrl });

        // Si falla el registro de la foto, no bloqueamos el flujo.
        if (errFoto) {
          // Puedes loguearlo si quieres: console.warn(errFoto);
        }
      }

      // 3) Volver a base
      window.location.href = '/base';
    } catch (e: any) {
      setErr(e?.message ?? 'No se pudo guardar el pedido');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Tabla de items (doble click para eliminar) */}
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
                <td
                  colSpan={4}
                  className="text-center text-slate-500 py-6"
                >
                  Sin artículos todavía.
                </td>
              </tr>
            ) : (
              items.map((it, idx) => (
                <tr
                  key={`${it.articulo}-${idx}`}
                  className="border-b last:border-b-0 cursor-pointer hover:bg-violet-50/60"
                  onDoubleClick={() => onRemoveItem(idx)}
                  title="Doble clic para eliminar esta línea"
                >
                  <td className="px-3 py-2">{it.articulo}</td>
                  <td className="px-3 py-2 text-right">{it.qty}</td>
                  <td className="px-3 py-2 text-right">
                    {CLP.format(it.valor)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {CLP.format(it.subtotal)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {items.length > 0 && (
          <div className="mt-2 text-xs text-slate-500">
            Tip: haz <b>doble clic</b> en una fila para eliminarla.
          </div>
        )}
      </div>

      {/* Total + abanico para foto + guardar */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <div className="text-2xl font-extrabold tracking-tight">
            Total {CLP.format(total)}
          </div>

          {/* Abanico (desplegable) para sacar/cargar foto */}
          <button
            onClick={() => setShowFotoFan((s) => !s)}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 bg-white hover:bg-slate-50"
            aria-expanded={showFotoFan}
            aria-controls="foto-fan"
          >
            <ChevronDown
              className={`w-4 h-4 transition ${showFotoFan ? 'rotate-180' : ''}`}
            />
            Tomar foto / Elegir
          </button>

          {showFotoFan && (
            <div id="foto-fan" className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Opción 1: sacar foto (mobile) */}
              <label className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2.5 text-violet-800 cursor-pointer hover:bg-violet-100">
                <Camera className="w-4 h-4" />
                Sacar foto
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => validateAndSetFile(e.target.files?.[0] || null)}
                />
              </label>

              {/* Opción 2: cargar desde archivos */}
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 cursor-pointer hover:bg-slate-50">
                <ImagePlus className="w-4 h-4" />
                Cargar imagen
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => validateAndSetFile(e.target.files?.[0] || null)}
                />
              </label>

              {fotoFile && (
                <div className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-600">
                  Seleccionado: <b>{fotoFile.name}</b>
                  <button
                    type="button"
                    onClick={() => setFotoFile(null)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 hover:bg-slate-50"
                    title="Quitar imagen"
                  >
                    <XCircle className="w-4 h-4 text-rose-600" />
                    Quitar
                  </button>
                </div>
              )}
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
