'use client';

import * as React from 'react';
import type { Entrega, Estado, Pago } from '@/app/types/pedido';

type Props = {
  // estado actual
  pago: Pago;
  estado: Estado;
  entrega: Entrega;

  // setters REALES (no (v: string)=>void)
  setPago: React.Dispatch<React.SetStateAction<Pago>>;
  setEstado: React.Dispatch<React.SetStateAction<Estado>>;
  setEntrega: React.Dispatch<React.SetStateAction<Entrega>>;

  // acciones externas del contenedor
  onModificar: () => void;
  onAbrirCamara?: () => void;

  // control de apertura/cierre si lo necesitas
  open?: boolean;
  onClose?: () => void;
};

export default function FullPedidoModal({
  pago,
  estado,
  entrega,
  setPago,
  setEstado,
  setEntrega,
  onModificar,
  onAbrirCamara,
  open = true,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-white">
      <h3 className="mb-3 text-lg font-bold">Detalle Pedido</h3>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1">
          <span className="text-xs opacity-80">ENTREGA</span>
          <select
            value={entrega}
            onChange={(e) => setEntrega(e.target.value as Entrega)}
            className="rounded-md bg-white/10 px-3 py-2 outline-none"
          >
            <option value="LOCAL">LOCAL</option>
            <option value="DOMICILIO">DOMICILIO</option>
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs opacity-80">ESTADO</span>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as Estado)}
            className="rounded-md bg-white/10 px-3 py-2 outline-none"
          >
            <option value="LAVAR">LAVAR</option>
            <option value="LAVANDO">LAVANDO</option>
            <option value="GUARDAR">ENTREGAR</option>
            <option value="GUARDADO">GUARDADO</option>
            <option value="ENTREGADO">ENTREGADO</option>
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs opacity-80">PAGO</span>
          <select
            value={pago}
            onChange={(e) => setPago(e.target.value as Pago)}
            className="rounded-md bg-white/10 px-3 py-2 outline-none"
          >
            <option value="PENDIENTE">PENDIENTE</option>
            <option value="PAGADO">PAGADO</option>
          </select>
        </label>
      </div>

      {/* Botones */}
      <div className="mt-6 flex flex-col gap-3">
        <button
          onClick={onModificar}
          className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 px-4 py-3 font-semibold"
          title="Modificar pedido"
        >
          Modificar Pedido
        </button>

        <button
          onClick={onAbrirCamara}
          className="mx-auto flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2"
          title="Abrir cámara"
        >
          <span>Agregar Imagen</span>
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 px-4 py-2"
            title="Cerrar"
          >
            Cerrar
          </button>
        )}
      </div>
    </div>
  );
}
