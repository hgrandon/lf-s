'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

type Articulo = { id: number; nombre: string; precio: number };
type Linea = { articulo_id: number; nombre: string; precio: number; qty: number; estado: 'LAVAR' };

export default function EditLineaModal({
  open,
  articulo,
  lineaActual,
  onCancel,
  onConfirm,
  onSaveNewPrice,
}: {
  open: boolean;
  articulo: Articulo | null;
  lineaActual: Linea | null;
  onCancel: () => void;
  onConfirm: (nuevoPrecio: number, nuevaQty: number) => void;
  onSaveNewPrice: (nuevoPrecio: number) => Promise<void>;
}) {
  const [precio, setPrecio] = useState<number>(articulo?.precio ?? 0);
  const [qty, setQty] = useState<number>(lineaActual?.qty ?? 1);

  useEffect(() => {
    setPrecio(lineaActual?.precio ?? articulo?.precio ?? 0);
    setQty(lineaActual?.qty ?? 1);
  }, [open, articulo, lineaActual]);

  if (!open || !articulo) return null;

  const hardInt = (n: number, min = 0) => Math.max(min, Math.trunc(Number.isFinite(n) ? n : 0));

  const handleAutoUpdate = async (val: number) => {
    await onSaveNewPrice(hardInt(val, 0));
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Agregar / Editar artículo</h3>
          <button
            onClick={onCancel}
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* body */}
        <div className="px-5 pb-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">ARTÍCULO</label>
            <input
              readOnly
              value={articulo.nombre}
              className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">VALOR (CLP)</label>
              <input
                type="number"
                inputMode="numeric"
                value={precio}
                onChange={async (e) => {
                  const val = hardInt(Number(e.target.value || 0), 0);
                  setPrecio(val);
                  await handleAutoUpdate(val); // 🔹 actualiza en silencio apenas cambias
                }}
                className="w-full rounded-xl border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">CANTIDAD</label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={qty}
                onChange={(e) => setQty(hardInt(Number(e.target.value || 1), 1))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 border-t px-5 py-4">
          <button
            onClick={onCancel}
            className="rounded-xl bg-gray-100 px-4 py-2 font-medium text-gray-700 hover:bg-gray-200"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(hardInt(precio, 0), hardInt(qty, 1))}
            className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
