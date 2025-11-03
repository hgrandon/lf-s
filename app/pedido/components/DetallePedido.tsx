'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Camera, Loader2, AlertTriangle } from 'lucide-react';
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

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

const MAX_FILE_MB = 8;
const ALLOWED_IMG = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

const sanitizeFileName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 80);

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
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [showFotoModal, setShowFotoModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    };
  }, [fotoPreview]);

  const safeSet = useCallback(<T,>(setter: (v: T) => void, value: T) => {
    if (isMounted.current) setter(value);
  }, []);

  const total = useMemo(
    () => items.reduce((acc, it) => acc + it.subtotal, 0),
    [items]
  );

  const validateAndSetFile = useCallback((file: File | null) => {
    if (!file) {
      setFotoFile(null);
      setFotoPreview(null);
      return;
    }
    if (!ALLOWED_IMG.has(file.type)) {
      setErr('Formato de imagen no permitido (usa JPG, PNG o WEBP).');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setErr(`La imagen supera ${MAX_FILE_MB} MB.`);
      return;
    }
    setErr(null);
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  }, []);

  const uploadFotoIfAny = useCallback(
    async (nro: number): Promise<string | null> => {
      if (!fotoFile) return null;

      const cleanName = sanitizeFileName(fotoFile.name || 'foto.jpg');
      const filename = `pedido/${nro}/pedido_${nro}_${Date.now()}_${cleanName}`;

      const { data, error } = await supabase.storage
        .from('fotos')
        .upload(filename, fotoFile, { upsert: true });

      if (error || !data) return null;

      const { data: pub } = supabase.storage.from('fotos').getPublicUrl(data.path);
      return pub?.publicUrl || null;
    },
    [fotoFile]
  );

  const guardarPedido = useCallback(async () => {
    if (saving) return;

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

    safeSet(setSaving, true);
    safeSet(setErr, null);

    try {
      const payload: any = {
        nro: nroInfo.nro,
        telefono: cliente.telefono,
        nombre: cliente.nombre,
        direccion: cliente.direccion,
        total,
        estado: 'LAVAR',
        fecha: nroInfo.fecha,
        entrega: nroInfo.entrega,
        pagado: false,
      };

      // Si también quieres persistir los ítems en jsonb:
      // payload.items = items;

      const { error: errPedido } = await supabase.from('pedido').insert(payload);
      if (errPedido) throw errPedido;

      const fotoUrl = await uploadFotoIfAny(nroInfo.nro);
      if (fotoUrl) {
        await supabase.from('pedido_foto').insert({
          nro: nroInfo.nro,
          url: fotoUrl,
        });
      }

      window.location.href = '/base';
    } catch (e: any) {
      const message =
        typeof e?.message === 'string'
          ? e.message
          : e?.error_description || 'No se pudo guardar el pedido';
      safeSet(setErr, message);
    } finally {
      safeSet(setSaving, false);
    }
  }, [saving, cliente, nroInfo, items, total, uploadFotoIfAny, safeSet]);

  return (
    <>
      {/* Tabla de items */}
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
                <td colSpan={4} className="text-center text-slate-500 py-6">
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
                  <td className="px-3 py-2 text-right">{CLP.format(it.valor)}</td>
                  <td className="px-3 py-2 text-right">{CLP.format(it.subtotal)}</td>
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

      {/* Total + bloque de imagen estilo “Lavar” + guardar */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <div className="text-2xl font-extrabold tracking-tight">
            Total {CLP.format(total)}
          </div>

          {/* Bloque estilo Lavar: toca para agregar/cambiar imagen */}
          <div
            className="mt-4 rounded-2xl border border-white/20 bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 p-4 text-white/90 hover:bg-white/10 cursor-pointer transition"
            onClick={() => setShowFotoModal(true)}
            title="Toca para agregar o cambiar la imagen"
          >
            {fotoPreview ? (
              <div className="flex items-center gap-3">
                <img
                  src={fotoPreview}
                  alt="Foto seleccionada"
                  className="h-20 w-20 rounded-xl object-cover border border-white/30"
                />
                <div>
                  <div className="font-semibold">Imagen seleccionada</div>
                  <div className="text-xs opacity-80">
                    Toca de nuevo para reemplazar la imagen.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <Camera className="w-4 h-4" />
                Sin imagen adjunta. Toca para agregar.
              </div>
            )}
          </div>
        </div>

        <div className="flex md:justify-end">
          <button
            type="button"
            onClick={guardarPedido}
            disabled={saving || !cliente || items.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 text-white px-5 py-3 text-base font-semibold hover:bg-violet-700 disabled:opacity-50"
            aria-busy={saving}
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

      {/* Modal de foto (reutiliza tu FotoModal.tsx) */}
      <FotoModal
        open={showFotoModal}
        onClose={() => setShowFotoModal(false)}
        onPick={(file) => {
          validateAndSetFile(file);
          setShowFotoModal(false);
        }}
      />
    </>
  );
}
