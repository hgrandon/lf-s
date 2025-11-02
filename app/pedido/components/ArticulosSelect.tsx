'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type Articulo = { id: number; nombre: string; valor: number };
const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

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
        // En tu BD la columna de precio es "precio", no "valor"
        const { data, error } = await supabase
          .from('articulo')
          .select('id,nombre,precio')
          .order('nombre', { ascending: true });

        if (error) throw error;

        const list = (data || []).map((r: any) => ({
          id: r.id,
          nombre: r.nombre,
          valor: Number(r.precio || 0), // mapeamos precio -> valor
        })) as Articulo[];

        setArticulos(list);
        if (!list.length) setMsg('No hay artículos en public.articulo.');
      } catch (e: any) {
        setMsg(e?.message || 'No se pudieron cargar artículos.');
      }
    })();
  }, []);

  // Al elegir, agrega 1 unidad automáticamente
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
            {a.nombre} — {CLP.format(a.valor)}
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
