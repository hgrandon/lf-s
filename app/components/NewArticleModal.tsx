'use client';

import { useEffect, useState } from 'react';

type Props = {
  open: boolean;
  initialName?: string;
  onClose: () => void;
  onCreate: (payload: { nombre: string; precio: number; qty: number }) => void;
};

export default function NewArticleModal({ open, initialName = '', onClose, onCreate }: Props) {
  const [nombre, setNombre] = useState(initialName);
  const [precio, setPrecio] = useState<string>('');
  const [qty, setQty] = useState<string>('1');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (open) {
      setNombre(initialName);
      setPrecio('');
      setQty('1');
      setMsg('');
    }
  }, [open, initialName]);

  if (!open) return null;

  const save = () => {
    setMsg('');
    const nombreClean = nombre.trim();
    const p = Number(precio);
    const q = Math.max(1, Number(qty) || 1);

    if (!nombreClean) return setMsg('Escribe el nombre del artículo.');
    if (!Number.isFinite(p) || p <= 0) return setMsg('Precio inválido.');
    if (!Number.isFinite(q) || q <= 0) return setMsg('Cantidad inválida.');

    onCreate({ nombre: nombreClean, precio: p, qty: q });
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-center text-xl font-bold text-gray-800">Nuevo Artículo</h2>

        <div className="grid gap-3">
          <input
            placeholder="NOMBRE DEL ARTÍCULO"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded border px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            placeholder="VALOR UNITARIO"
            inputMode="numeric"
            value={precio}
            onChange={(e) => setPrecio(e.target.value.replace(/[^\d]/g, ''))}
            className="w-full rounded border px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            placeholder="CANTIDAD"
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ''))}
            className="w-full rounded border px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
          />
          {msg && <div className="text-sm text-gray-600">{msg}</div>}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={save}
            className="rounded-xl bg-purple-600 py-2 font-semibold text-white hover:bg-purple-700"
          >
            Guardar
          </button>
          <button
            onClick={onClose}
            className="rounded-xl bg-gray-100 py-2 font-semibold text-gray-700 hover:bg-gray-200"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}

