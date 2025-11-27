// app/pedido/correlativo/Correlativo.tsx
'use client';

import { Camera } from 'lucide-react';

type Props = {
  /** Número de pedido (correlativo) */
  nro?: number;
  /** Fecha de ingreso en formato YYYY-MM-DD */
  fechaIngreso?: string;
  /** Fecha de entrega en formato YYYY-MM-DD */
  fechaEntrega?: string;
  /** Acción al hacer clic en el ícono de cámara */
  onClickCamara?: () => void;
};

export default function Correlativo({
  nro,
  fechaIngreso,
  fechaEntrega,
  onClickCamara,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-4 sm:gap-6 mb-4 sm:mb-6">
      {/* Lado izquierdo: N° grande */}
      <div className="flex flex-col">
        <span className="text-xs sm:text-sm font-semibold tracking-wide">
          N°
        </span>
        <span className="text-4xl sm:text-5xl font-extrabold leading-none">
          {nro ?? '----'}
        </span>
      </div>

      {/* Lado derecho: cámara + fechas */}
      <div className="flex items-center gap-4 sm:gap-6">
        {/* Botón cámara */}
        <button
          type="button"
          onClick={onClickCamara}
          className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 border-white/90 text-white bg-white/5 hover:bg-white/10 active:scale-95 transition"
          aria-label="Tomar foto"
        >
          <Camera size={32} className="sm:w-9 sm:h-9" />
        </button>

        {/* Fechas */}
        <div className="text-right text-xs sm:text-sm leading-tight">
          <div>{fechaIngreso ?? ''}</div>
          <div>{fechaEntrega ?? ''}</div>
        </div>
      </div>
    </div>
  );
}
