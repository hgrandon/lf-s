'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (file: File | null) => void;
};

export default function FotoModal({ open, onClose, onPick }: Props) {
  const refCam = useRef<HTMLInputElement | null>(null);
  const refFile = useRef<HTMLInputElement | null>(null);
  const refFirstButton = useRef<HTMLButtonElement | null>(null);
  const titleId = 'foto-modal-title';

  // Cierra y limpia los inputs (para poder seleccionar el mismo archivo otra vez)
  const handleClose = useCallback(() => {
    if (refCam.current) refCam.current.value = '';
    if (refFile.current) refFile.current.value = '';
    onClose();
  }, [onClose]);

  const handlePick = useCallback(
    (file: File | null) => {
      onPick(file);
      handleClose();
    },
    [onPick, handleClose]
  );

  // Enfoque inicial y tecla ESC
  useEffect(() => {
    if (!open) return;
    refFirstButton.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()} // evita cerrar al hacer click dentro
      >
        {/* Cabecera (un solo tono/gradiente) */}
        <div className="relative bg-gradient-to-r from-violet-700 to-violet-600 px-6 py-4 text-center text-white font-extrabold">
          <span id={titleId}>FOTO</span>
          <button
            type="button"
            className="absolute right-3 top-3 rounded-full bg-white/20 p-1 hover:bg-white/30 outline-none focus:ring-2 focus:ring-white/60"
            onClick={handleClose}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          {/* Sacar foto (cámara) */}
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-violet-800 hover:bg-violet-100">
            <Camera className="h-5 w-5" />
            <span>Sacar foto</span>
            <input
              ref={refCam}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handlePick(e.target.files?.[0] || null)}
            />
          </label>

          {/* Cargar desde archivos */}
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 hover:bg-slate-50">
            <ImagePlus className="h-5 w-5" />
            <span>Cargar imagen</span>
            <input
              ref={refFile}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePick(e.target.files?.[0] || null)}
            />
          </label>

          {/* Botón salir (primer foco para accesibilidad) */}
          <button
            ref={refFirstButton}
            type="button"
            onClick={handleClose}
            className="w-full rounded-xl border border-slate-300 py-2.5 font-semibold text-violet-700 hover:bg-violet-50"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
