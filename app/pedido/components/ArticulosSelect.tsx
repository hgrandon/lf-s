'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type Articulo = { id: number; nombre: string; valor: number };

export default function ArticulosSelect({
  onAddArticulo,
}: {
  onAddArticulo: (a: Articulo) => void;
}) {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [sel, setSel] = useState<number | ''>('');

  useEffect(() => {
    (async () => {
      try {
        setMsg(null);
        // Tomamos id, nombre y precio (tu campo real)
        const { data, error } = await supabase
          .from('articulo')
          .select('id, nombre, precio')
          .order('nombre', { ascending: true });

        if (error) throw error;

        // Filtrar solo los que no tienen precio (precio nulo o 0)
        const filtrados = (data || [])
          .filter((r: any) => !r.precio || Number(r.precio) === 0)
          .map((r: any) => ({
            id: r.id,
            nombre: (r.nombre || '').trim().toUpperCase(),
            valor: Number(r.precio || 0),
          }));

        // Eliminar duplicados por nombre
        const unicos: Articulo[] = Array.from(
          new Map(filtrados.map((a) => [a.nombre, a])).values()
        );

        setArticulos(unicos);
        if (!unicos.length) setMsg('No hay artículos sin valor asignado.');
      } catch (e: any) {
        setMsg(e?.message || 'No se pudieron cargar artículos.');
      }
    })();
  }, []);

  // Al elegir, agrega directamente 1 unidad
  const onChange = (v: string) => {
    const id = v ? Number(v) : '';
    setSel(id);
    if (id === '') return;
    const a = articulos.find((x) => x.id === id);
    if (a) onAddArticulo(a);
    setSel('');
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-2">Seleccionar artículo</label>
      <select
        className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500"
        value={sel === '' ? '' : sel}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Seleccionar artículo…</option>
        {articulos.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nombre}
          </option>
        ))}
      </select>

      {msg && (
        <div className="mt-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
          {msg}
        </div>
      )}
    </div>
  );
}
