'use client';
import { useRef } from 'react';

type Props = {
  /** Devuelve los archivos seleccionados (o null si el usuario cancela) */
  onPick: (files: FileList | null) => void;
  /** Texto del botón */
  label?: string;
  /** Cámara a usar en móviles (environment = trasera, user = frontal) */
  capture?: 'environment' | 'user';
  /** Permitir seleccionar múltiples archivos */
  multiple?: boolean;
};

export default function CameraButton({
  onPick,
  label = 'Tomar foto',
  capture = 'environment',
  multiple = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPick(e.target.files);
    // limpiar para permitir volver a elegir el mismo archivo
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="inline-flex">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        // @ts-expect-error - prop estándar en móviles; TS no la tipa en React
        capture={capture}
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
      >
        {label}
      </button>
    </div>
  );
}

