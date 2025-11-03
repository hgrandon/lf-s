'use client';

import { Camera, ImagePlus, X } from 'lucide-react';
import { useRef } from 'react';

export default function FotoModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (file: File | null) => void;
}) {
  const refCam = useRef<HTMLInputElement | null>(null);
  const refFile = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Cabecera en un solo tono/gradiente */}
        <div className="relative bg-gradient-to-r from-violet-700 to-violet-600 px-6 py-4 text-center text-white font-extrabold">
          FOTO
          <button
            className="absolute right-3 top-3 rounded-full bg-white/20 p-1 hover:bg-white/30"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {/* Sacar foto (cámara) */}
          <label className="flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-violet-800 cursor-pointer hover:bg-violet-100">
            <Camera className="w-5 h-5" />
            Sacar foto
            <input
              ref={refCam}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                onPick(file);
                onClose();
              }}
            />
          </label>

          {/* Cargar desde archivos */}
          <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 cursor-pointer hover:bg-slate-50">
            <ImagePlus className="w-5 h-5" />
            Cargar imagen
            <input
              ref={refFile}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                onPick(file);
                onClose();
              }}
            />
          </label>

          <button
            onClick={onClose}
            className="w-full rounded-xl border border-slate-300 py-2.5 text-violet-700 font-semibold hover:bg-violet-50"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
