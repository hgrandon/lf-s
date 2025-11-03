// app/pedido/components/ArticulosSelect.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type Articulo = { id: number; nombre: string; precio: number };

// Payload que envía el combo (lo importa page.tsx)
export type AddItemPayload = {
  articulo: string;
  precio: number;
  cantidad: number; // puede ser 0
};

type Props = {
  onAddItem: (item: AddItemPayload) => void;
};

export default function ArticulosSelect({ onAddItem }: Props) {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [sel, setSel] = useState<string>(''); // id en string o 'NEW'
  const [open, setOpen] = useState(false);

  // estado modal (sirve tanto para existente como para nuevo)
  const [modalTitle, setModalTitle] = useState('');
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState<number | ''>('');
  const [cantidad, setCantidad] = useState<number | ''>(''); // permite vacío/0

  // Cargar artículos activos y sin duplicados por nombre
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('articulo')
        .select('id,nombre,precio,activo')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (!error && Array.isArray(data)) {
        const vistos = new Set<string>();
        const unicos: Articulo[] = [];
        for (const r of data as any[]) {
          const nom = String(r.nombre || '').trim().toUpperCase();
          if (!vistos.has(nom)) {
            vistos.add(nom);
            unicos.push({
              id: Number(r.id),
              nombre: nom,
              precio: Number(r.precio || 0),
            });
          }
        }
        setArticulos(unicos);
      }
    })();
  }, []);

  const opciones = useMemo(
    () => [{ id: -1, nombre: '➕ Agregar artículo…', precio: 0 }, ...articulos],
    [articulos]
  );

  const resetModalState = () => {
    setNombre('');
    setPrecio('');
    setCantidad('');
  };

  function abrirModalPara(idOrNew: string) {
    resetModalState();

    if (idOrNew === 'NEW') {
      setModalTitle('Agregar artículo');
      setOpen(true);
      return;
    }

    const id = Number(idOrNew);
    const a = articulos.find((x) => x.id === id);
    if (!a) return;

    setModalTitle(a.nombre);
    setPrecio(a.precio);
    setCantidad(1); // sugerido; editable y puede ser 0
    setOpen(true);
  }

  function onSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setSel(value);

    if (value === 'NEW') {
      abrirModalPara('NEW');
      return;
    }
    if (value) abrirModalPara(value);
  }

  async function confirmarNuevo() {
    const nom = nombre.trim().toUpperCase();
    const p = Number(precio || 0);
    const c = Number(cantidad || 0);
    if (!nom) return;

    try {
      const { error } = await supabase.from('articulo').insert({
        nombre: nom,
        precio: p,
        activo: true,
      });
      if (!error) {
        // Refresca lista local (evita duplicado por nombre)
        setArticulos((prev) => {
          if (prev.some((x) => x.nombre === nom)) return prev;
          return [...prev, { id: Date.now(), nombre: nom, precio: p }];
        });
      }
    } finally {
      onAddItem({ articulo: nom, precio: p, cantidad: c });
      setOpen(false);
      setSel('');
    }
  }

  function confirmarExistente() {
    const id = Number(sel);
    const a = articulos.find((x) => x.id === id);
    if (!a) return;

    const p = Number(precio || 0);
    const c = Number(cantidad || 0);

    onAddItem({ articulo: a.nombre, precio: p, cantidad: c });
    setOpen(false);
    setSel('');
  }

  return (
    <>
      <label className="block text-sm font-semibold text-slate-700 mb-2">
        Seleccionar artículo
      </label>
      <select
        value={sel}
        onChange={onSelectChange}
        className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500"
      >
        <option value="">{'Seleccionar artículo…'}</option>
        <option value="NEW">{'➕ Agregar artículo…'}</option>
        {opciones.slice(1).map((a) => (
          <option key={a.id} value={a.id}>
            {a.nombre}
          </option>
        ))}
      </select>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Cabecera con un solo tono/gradiente */}
            <div className="bg-gradient-to-r from-violet-700 to-violet-600 px-5 py-4 text-center text-white font-extrabold tracking-wide">
              {modalTitle || 'Detalle'}
            </div>

            <div className="p-5 space-y-3">
              {/* En nuevo: pedir nombre; placeholders, sin labels visibles */}
              {modalTitle === 'Agregar artículo' && (
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value.toUpperCase())}
                  placeholder="NOMBRE DEL ARTÍCULO"
                  className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500 uppercase"
                />
              )}

              <input
                inputMode="numeric"
                value={precio === '' ? '' : precio}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D+/g, '');
                  setPrecio(v === '' ? '' : Number(v));
                }}
                placeholder="PRECIO"
                className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500"
              />

              <input
                inputMode="numeric"
                value={cantidad === '' ? '' : cantidad}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D+/g, '');
                  setCantidad(v === '' ? '' : Number(v));
                }}
                placeholder="CANTIDAD"
                className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500"
              />

              <button
                onClick={modalTitle === 'Agregar artículo' ? confirmarNuevo : confirmarExistente}
                className="mt-2 w-full rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-600 text-white py-2.5 font-semibold hover:opacity-95"
              >
                Agregar Detalle
              </button>

              <button
                onClick={() => {
                  setOpen(false);
                  setSel('');
                }}
                className="w-full rounded-xl border border-slate-300 py-2.5 text-violet-700 font-semibold hover:bg-violet-50"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
