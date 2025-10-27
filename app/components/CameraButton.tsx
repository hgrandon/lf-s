'use client';
import { useRef } from 'react';

type Props = {
  onPick: (files: FileList | null) => void;
  label?: string;
  capture?: 'environment' | 'user';
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
    if (inputRef.current) inputRef.current.value = ''; // limpiar valor
  };

  return (
    <div className="inline-flex">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        // 👇 Aunque TS no lo tipa, esta prop sí funciona en móviles
        {...({ capture } as any)}
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

