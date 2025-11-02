// app/pedido/components/ArticulosSelect.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type ArticuloLite = { id: number; nombre: string };

export default function ArticulosSelect({
  onSelect,
}: {
  onSelect: (a: ArticuloLite) => void;
}) {
  const [articulos, setArticulos] = useState<ArticuloLite[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [sel, setSel] = useState<number | ''>('');

  useEffect(() => {
    (async () => {
      try {
        setMsg(null);

        // 1) desde public.articulo
        let lista: { id: number; nombre: string }[] = [];
        const { data: a1, error: e1 } = await supabase
          .from('articulo')
          .select('id, nombre')
          .order('nombre', { ascending: true });

        if (e1) throw e1;
        if (Array.isArray(a1) && a1.length) {
          lista = a1 as any[];
        } else {
          // 2) fallback public._bak_articulo
          const { data: a2, error: e2 } = await supabase
            .from('_bak_articulo')
            .select('id, nombre')
            .order('nombre', { ascending: true });
          if (e2) throw e2;
          lista = (a2 || []) as any[];
        }

        const normal = (lista || [])
          .map((r) => ({
            id: Number(r.id),
            nombre: String(r.nombre || '').trim().toUpperCase(),
          }))
          .filter((r) => !!r.nombre);

        // sin duplicados por nombre
        const unicos: ArticuloLite[] = Array.from(
          new Map(normal.map((x) => [x.nombre, x])).values()
        );

        setArticulos(unicos);
        if (!unicos.length) setMsg('No se encontraron artículos.');
      } catch (e: any) {
        setMsg(e?.message || 'No se pudieron cargar artículos.');
      }
    })();
  }, []);

  const handleChange = (v: string) => {
    const id = v ? Number(v) : '';
    setSel(id);
    if (id === '') return;
    const a = articulos.find((x) => x.id === id);
    if (a) onSelect(a); // avisamos al padre para abrir modal
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
        onChange={(e) => handleChange(e.target.value)}
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
