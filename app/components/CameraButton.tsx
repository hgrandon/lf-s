// appweb/app/components/CameraButton.tsx
'use client';

import { useRef, useState } from 'react';
import { uploadPhoto } from '@/lib/uploadPhoto';

type Props = {
  orderId: string | number;
  onUploaded?: (url: string) => void; // te devuelve la URL pública
  label?: string;
};

export default function CameraButton({ orderId, onUploaded, label = 'Tomar foto / Elegir archivo' }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      setMsg('');
      const file = e.target.files?.[0];
      if (!file) return;

      setLoading(true);
      const { publicUrl } = await uploadPhoto(file, orderId);
      onUploaded?.(publicUrl);
      setMsg('✅ Foto subida correctamente');
    } catch (err: any) {
      console.error(err);
      setMsg(`❌ Error subiendo fotos: ${err?.message || err}`);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"    // cámara trasera en móvil
        onChange={handleSelectFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="px-3 py-2 rounded bg-violet-600 text-white disabled:opacity-60"
        disabled={loading}
      >
        {loading ? 'Subiendo…' : label}
      </button>
      {msg && <span className="text-xs">{msg}</span>}
    </div>
  );
}

