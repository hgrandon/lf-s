'use client';

import { useId } from 'react';

type Props = {
  /** Llama tu handler existente: recibe FileList | null */
  onPick: (files: FileList | null) => void;
  /** Texto del botón (opcional) */
  label?: string;
  /** Acepta solo imágenes (por defecto) */
  accept?: string;
  /** Forzar cámara trasera en móviles compatibles */
  capture?: 'environment' | 'user' | undefined;
  /** Permitir varias fotos (por defecto false) */
  multiple?: boolean;
  /** Clases extra para el botón */
  className?: string;
};

export default function CameraButton({
  onPick,
  label = 'Tomar foto',
  accept = 'image/*',
  capture = 'environment',
  multiple = false,
  className = '',
}: Props) {
  const inputId = useId();

  return (
    <div className="inline-block">
      {/* input oculto */}
      <input
        id={inputId}
        type="file"
        accept={accept}
        capture={capture}
        multiple={multiple}
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />

      {/* botón visible */}
      <button
        type="button"
        onClick={() => document.getElementById(inputId)?.click()}
        className={
          className ||
          'rounded-lg bg-purple-600 px-3 py-2 text-white text-sm font-semibold hover:bg-purple-700'
        }
      >
        {label}
      </button>
    </div>
  );
}
