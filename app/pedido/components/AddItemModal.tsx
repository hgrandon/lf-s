// app/pedido/components/AddItemModal.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  open: boolean;
  articuloId: number | null;
  articuloNombre: string | null;
  onCancel: () => void;
  onConfirm: (payload: { articulo: string; qty: number; valor: number }) => void;
};

/**
 * Modal para capturar VALOR y CANTIDAD del artículo seleccionado.
 * - Prefill de valor consultando primero public.articulo (precio) y si no, public._bak_articulo (pre).
 * - Si no hay precio en BD, deja 0 y el usuario puede editar.
 */
export default function AddItemModal({
  open,
  articuloId,
  articuloNombre,
  onCancel,
  onConfirm,
}: Props) {
  const [valor, setValor] = useState<number>(0);
  const [qty, setQty] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadPrecio() {
      if (!open || !articuloId) return;
      setLoading(true);
      try {
        // 1) Intentar en public.articulo (campo "precio")
        const { data: a1, error: e1 } = await supabase
          .from('articulo')
          .select('precio')
          .eq('id', articuloId)
          .maybeSingle();

        if (!e1 && a1 && typeof a1.precio === 'number') {
          if (mounted) setValor(a1.precio || 0);
          return;
        }

        // 2) Fallback a public._bak_articulo (campo "pre")
        const { data: a2, error: e2 } = await supabase
          .from('_bak_articulo')
          .select('pre')
          .eq('id', articuloId)
          .maybeSingle();

        if (!e2 && a2 && typeof a2.pre === 'number') {
          if (mounted) setValor(a2.pre || 0);
          return;
        }

        if (mounted) setValor(0);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadPrecio();
    return () => {
      mounted = false;
    };
  }, [open, articuloId]);

  if (!open) return null;

  const canConfirm = !!articuloNombre && qty > 0 && valor >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] overflow-hidden">
        {/* Header morado */}
        <div className="bg-gradient-to-r from-violet-700 via-fuchsia-600 to-indigo-600 px-5 py-4">
          <h3 className="text-center text-white font-extrabold tracking-tight">
            {articuloNombre || 'ARTÍCULO'}
          </h3>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Valor</label>
            <input
              type="number"
              min={0}
              value={Number.isFinite(valor) ? valor : 0}
              onChange={(e) => setValor(Math.max(0, Number(e.target.value) || 0))}
              className="w-full rounded-xl border-2 border-violet-300 px-3 py-2.5 outline-none focus:border-violet-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Cantidad</label>
            <input
              placeholder="CANTIDAD"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className="w-full rounded-xl border-2 border-violet-300 px-3 py-2.5 outline-none focus:border-violet-500"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() =>
                canConfirm &&
                onConfirm({
                  articulo: articuloNombre || 'ARTÍCULO',
                  qty,
                  valor,
                })
              }
              disabled={!canConfirm || loading}
              className="w-full rounded-xl bg-gradient-to-r from-violet-700 via-fuchsia-600 to-indigo-600 text-white font-semibold py-2.5 hover:opacity-95 disabled:opacity-50"
            >
              Agregar Detalle
            </button>
            <button
              onClick={onCancel}
              className="w-full rounded-xl border-2 border-violet-200 text-violet-800 font-semibold py-2.5 hover:bg-violet-50"
            >
              Salir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
