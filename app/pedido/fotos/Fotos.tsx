// app/pedido/fotos/Fotos.tsx
import { ImagePlus } from 'lucide-react';

type Props = {
  fotoUrl: string | null;
  onFileSelected: (file: File | null) => void;
};

export default function Fotos({ fotoUrl, onFileSelected }: Props) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <label className="inline-flex items-center gap-2 text-sm">
        <span className="sr-only">Seleccionar archivo</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            onFileSelected(file);
          }}
          className="block text-sm"
        />
      </label>
      <span className="text-sm text-slate-600">
        {fotoUrl ? 'Imagen cargada.' : 'SIN ARCHIVOS SELECCIONADOS'}
      </span>
      <ImagePlus className="text-violet-500" size={18} />
    </div>
  );
}
