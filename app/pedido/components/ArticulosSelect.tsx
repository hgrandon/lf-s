// app/pedido/components/ArticulosSelect.tsx
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

        // 1) Intentar desde public.articulo
        let lista: { id: number; nombre: string; precio?: number | null }[] = [];
        const { data: a1, error: e1 } = await supabase
          .from('articulo')
          .select('id, nombre, precio')
          .order('nombre', { ascending: true });

        if (e1) throw e1;
        if (Array.isArray(a1) && a1.length) {
          lista = a1 as any[];
        } else {
          // 2) Fallback: public._bak_articulo (tu screenshot)
          const { data: a2, error: e2 } = await supabase
            .from('_bak_articulo')
            .select('id, nombre, pre as precio') // en _bak_articulo la columna se llama "pre"
            .order('nombre', { ascending: true });
          if (e2) throw e2;
          lista = (a2 || []) as any[];
        }

        // Normalizar a MAYÚSCULAS y eliminar duplicados por nombre
        const normalizados = (lista || [])
          .map((r) => ({
            id: Number(r.id),
            nombre: String(r.nombre || '').trim().toUpperCase(),
            valor: 0, // No mostramos ni usamos precio acá
          }))
          .filter((r) => !!r.nombre);

        const unicos: Articulo[] = Array.from(
          new Map(normalizados.map((x) => [x.nombre, x])).values()
        );

        setArticulos(unicos);
        if (!unicos.length) {
          setMsg('No se encontraron artículos en la base.');
        }
      } catch (e: any) {
        setMsg(e?.message || 'No se pudieron cargar artículos.');
      }
    })();
  }, []);

  // Al elegir un artículo, lo agregamos con cantidad por defecto en el padre (que maneje la cantidad)
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
      <label className="block text-sm font-semibold text-slate-700 mb-2">
        Seleccionar artículo
      </label>

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
