'use client';

import { useEffect, useState, type ChangeEvent } from 'react';

type Props = {
  /** Última foto subida (URL pública) que viene desde PedidoPage */
  fotoUrl: string | null;
  /** Input oculto que se dispara con el ícono de cámara del header */
  inputRef: React.RefObject<HTMLInputElement>;
  /** Se llama por cada archivo seleccionado (puede venir más de uno) */
  onFileSelected: (file: File | null) => void;
};

export default function Fotos({ fotoUrl, inputRef, onFileSelected }: Props) {
  // Galería local de fotos del pedido
  const [galeria, setGaleria] = useState<string[]>([]);

  // Cada vez que llega una nueva fotoUrl desde arriba la agregamos a la galería
  useEffect(() => {
    if (!fotoUrl) return;
    setGaleria((prev) =>
      prev.includes(fotoUrl) ? prev : [...prev, fotoUrl]
    );
  }, [fotoUrl]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) {
      onFileSelected(null);
      return;
    }

    // Permitimos seleccionar varias fotos a la vez
    Array.from(files).forEach((file) => {
      onFileSelected(file);
    });

    // Resetea el input para poder volver a elegir la misma foto si se quiere
    e.target.value = '';
  }

  return (
    <section className="mt-6">
      {/* Input oculto: lo dispara el ícono de cámara del header */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />

      {/* Contenedor tipo tarjeta para la galería */}
      <div className="rounded-2xl border border-white/40 bg-white/5 px-3 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">
            Fotos del pedido
          </h3>
          <span className="text-[11px] text-white/70">
            Usa el ícono de cámara para agregar
          </span>
        </div>

        {galeria.length === 0 ? (
          <p className="text-xs text-white/70">Sin fotos todavía…</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {galeria.map((url, idx) => (
              <div
                key={`${idx}-${url}`}
                className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-white/40 bg-black/20"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Foto ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
