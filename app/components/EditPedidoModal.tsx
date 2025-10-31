'use client';

import React from 'react';
import { Camera } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  nro?: number;
  estado: string;
  entrega: string;
  pago: string;
  setEstado: (v: string) => void;
  setEntrega: (v: string) => void;
  setPago: (v: string) => void;
};

export default function EditPedidoModal({
  open,
  onClose,
  onSave,
  saving,
  nro,
  estado,
  entrega,
  pago,
  setEstado,
  setEntrega,
  setPago,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="w-[480px] max-w-[90vw] rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-5 text-xl font-semibold text-violet-700">
          Pedido N° {nro}
        </h3>

        <div className="grid gap-4">
          {/* Estado */}
          <label className="grid gap-1">
            <span className="text-sm font-semibold text-violet-700">Estado:</span>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="rounded-xl border border-violet-200 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-400"
            >
              <option value="LAVAR">LAVAR</option>
              <option value="LAVADO">LAVADO</option>
              <option value="ENTREGADO">ENTREGADO</option>
            </select>
          </label>

          {/* Entrega */}
          <label className="grid gap-1">
            <span className="text-sm font-semibold text-violet-700">Entrega:</span>
            <select
              value={entrega}
              onChange={(e) => setEntrega(e.target.value)}
              className="rounded-xl border border-violet-200 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-400"
            >
              <option value="LOCAL">LOCAL</option>
              <option value="DOMICILIO">DOMICILIO</option>
            </select>
          </label>

          {/* Pago */}
          <label className="grid gap-1">
            <span className="text-sm font-semibold text-violet-700">Pago:</span>
            <select
              value={pago}
              onChange={(e) => setPago(e.target.value)}
              className="rounded-xl border border-violet-200 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-400"
            >
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="PAGADO">PAGADO</option>
            </select>
          </label>

          {/* Botón cámara */}
          <div className="flex justify-center mt-3">
            <button
              title="Abrir cámara"
              className="rounded-full bg-violet-600 p-4 text-white hover:bg-violet-700 shadow-lg"
            >
              <Camera size={24} />
            </button>
          </div>

          {/* Botón guardar */}
          <button
            onClick={onSave}
            disabled={saving}
            className={`mt-4 w-full rounded-2xl px-4 py-2 font-semibold text-white ${
              saving ? 'bg-violet-300' : 'bg-violet-600 hover:bg-violet-700'
            }`}
          >
            {saving ? 'Guardando…' : 'Guardar Cambios'}
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
