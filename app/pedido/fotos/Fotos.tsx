// app/pedido/fotos/Fotos.tsx
'use client';

import { RefObject } from 'react';

type Props = {
  fotoUrl: string | null;
  onFileSelected: (file: File | null) => void;
  inputRef: RefObject<HTMLInputElement>;
};

export default function Fotos({ onFileSelected, inputRef }: Props) {
  return (
    <div className="hidden">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          onFileSelected(file);
          // para poder volver a seleccionar la misma foto
          e.target.value = '';
        }}
      />
    </div>
  );
}
