'use client';

import React from 'react';
import { Camera, X } from 'lucide-react';
import PedidoDetalleCard from './PedidoDetalleCard';

type Articulo = {
  nombre: string;
  cantidad: number;
  valor: number;
  subtotal: number;
  estado: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  pedido: {
    nro: number;
    nombre: string;
    telefono: string;
    direccion: string;
    fecha: string;
    entrega: string;
    pago: string;
    total: number;
    articulos: Articulo[];
    imagen?: string;
  } | null;
  onModificar: () => void;
};

export default function FullPedidoModal({ open, onClose, pedido, onModificar }: Props) {
  if (!open || !pedido) return null;

  const {
    nro,
    nombre,
    telefono,
    direccion,
    fecha,
    entrega,
    pago,
    total,
    articulos,
    imagen,
  } = pedido;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50">
      <div className="relative w-[600px] max-w-[95vw] rounded-2xl bg-white shadow-2xl p-6">
        {/* Cerrar */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full bg-violet-100 p-2 text-violet-700 hover:bg-violet-200"
        >
          <X size={18} />
        </button>

        {/* Encabezado */}
        <div className="mb-3 border-b border-violet-100 pb-2 text-center">
          <h2 className="text-2xl font-bold text-violet-800">Pedido N° {nro}</h2>
          <p className="text-sm text-slate-600">{nombre}</p>
          <p className="text-sm text-slate-600">{telefono} — {direccion}</p>
        </div>

        {/* Detalle */}
        <div className="max-h-[65vh] overflow-y-auto">
          {articulos.map((a, i) => (
            <PedidoDetalleCard key={i} articulo={a} />
          ))}
        </div>

        {/* Total */}
        <div className="mt-4 flex items-center justify-between border-t border-violet-100 pt-3">
          <span className="text-lg font-semibold text-violet-700">Total:</span>
          <span className="text-2xl font-bold text-violet-800">
            {new Intl.NumberFormat('es-CL').format(total)}
          </span>
        </div>

        {/* Imagen */}
        {imagen && (
          <div className="mt-4">
            <img
              src={imagen}
              alt="foto pedido"
              className="mx-auto w-full max-w-md rounded-xl border border-violet-100 shadow-sm"
            />
          </div>
        )}

        {/* Botones */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={onModificar}
            className="w-full rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-600 py-2 font-semibold text-white shadow-md hover:opacity-90"
          >
            Modificar Pedido
          </button>

          <button
            className="mx-auto flex items-center gap-2 rounded-full bg-violet-100 p-3 text-violet-700 hover:bg-violet-200"
            title="Abrir cámara"
          >
            <Camera size={20} />
            <span>Agregar Imagen</span>
          </button>
        </div>
      </div>
    </div>
  );
}
