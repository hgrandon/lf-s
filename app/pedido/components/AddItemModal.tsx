'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export type AddItemPayload = {
  articuloId: number;
  articuloNombre: string;
  precio: number;
  cantidad: number;
};

export default function AddItemModal({
  open,
  articuloId,
  articuloNombre,
  precioInicial,
  onClose,
  onConfirm,
}: {
  open: boolean;
  articuloId: number | null;
  articuloNombre: string;
  precioInicial: number | null;
  onClose: () => void;
  onConfirm: (payload: AddItemPayload) => void;
}) {
  const [precio, setPrecio] = useState<number>(precioInicial ?? 0);
  const [cantidad, setCantidad] = useState<number>(1);
  const [savingPrice, setSavingPrice] = useState(false);
  const precioRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setPrecio(precioInicial ?? 0);
      setCantidad(1);
      // focus en el precio para editar rápido
      setTimeout(() => precioRef.current?.focus(), 50);
    }
  }, [open, precioInicial]);

  if (!open || articuloId == null) return null;

  const canConfirm = precio > 0 && cantidad > 0;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    // Si el precio cambió, lo persistimos como nuevo default
    if (precioInicial != null && precio !== precioInicial) {
      try {
        setSavingPrice(true);
        const { error } = await supabase
          .from('articulo')
          .update({ precio, updated_at: new Date().toISOString() })
          .eq('id', articuloId);
        if (error) {
          // no interrumpimos el flujo si falla; solo seguimos
          console.error('No se pudo actualizar precio por defecto:', error.message);
        }
      } finally {
        setSavingPrice(false);
      }
    }
    onConfirm({
      articuloId,
      articuloNombre,
      precio,
      cantidad,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header degradado morado */}
        <div className="relative bg-gradient-to-r from-violet-700 via-fuchsia-600 to-indigo-600 py-4 px-5">
          <h3 className="text-center text-white text-lg font-extrabold tracking-wide">
            {articuloNombre}
          </h3>
          <button
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido: SIN etiquetas visibles; sólo placeholders */}
        <div className="p-5 space-y-3">
          <input
            ref={precioRef}
            type="number"
            inputMode="numeric"
            min={0}
            value={Number.isFinite(precio) ? precio : 0}
            onChange={(e) => setPrecio(Number(e.target.value))}
            placeholder="Precio"
            className="w-full rounded-xl border-2 border-violet-300 px-4 py-3 outline-none focus:border-violet-500"
          />
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={Number.isFinite(cantidad) ? cantidad : 1}
            onChange={(e) => setCantidad(Math.max(1, Number(e.target.value)))}
            placeholder="Cantidad"
            className="w-full rounded-xl border-2 border-violet-300 px-4 py-3 outline-none focus:border-violet-500"
          />

          <button
            onClick={handleConfirm}
            disabled={!canConfirm || savingPrice}
            className="w-full rounded-xl bg-gradient-to-r from-violet-700 via-fuchsia-600 to-indigo-600 px-4 py-3 text-white font-semibold hover:opacity-95 disabled:opacity-60"
          >
            {savingPrice ? 'Guardando precio…' : 'Agregar Detalle'}
          </button>

          <button
            onClick={onClose}
            className="w-full rounded-xl border-2 border-violet-300 px-4 py-3 text-violet-700 font-semibold hover:bg-violet-50"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
