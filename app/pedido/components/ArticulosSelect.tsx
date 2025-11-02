'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AddItemModal, { AddItemPayload } from './AddItemModal';

export type Articulo = {
  id: number;
  nombre: string;
  precio: number | null; // puede venir null si aún no lo definen
  activo?: boolean | null;
};

export default function ArticulosSelect({
  onAddItem,
}: {
  onAddItem: (payload: { articulo: string; precio: number; cantidad: number }) => void;
}) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [selId, setSelId] = useState<number | ''>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{ id: number; nombre: string; precio: number | null } | null>(null);

  // Carga de artículos (sin duplicados por nombre)
  useEffect(() => {
    (async () => {
      setCargando(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('articulo') // usa tu tabla actual
          .select('id,nombre,precio,activo')
          .order('nombre', { ascending: true });

        if (error) throw error;

        const rows = (data ?? []) as Articulo[];

        // normalizamos: deduplicamos por nombre (último gana)
        const map = new Map<string, Articulo>();
        for (const r of rows) map.set((r.nombre || '').toString(), r);
        setArticulos(Array.from(map.values()));
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? 'No se pudieron cargar artículos.');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  // al elegir un artículo → abrir modal con precio por defecto y cantidad=1
  const handleChange = (v: string) => {
    if (!v) {
      setSelId('');
      return;
    }
    const id = Number(v);
    setSelId(id);
    const art = articulos.find((a) => a.id === id);
    if (art) {
      setModalData({ id: art.id, nombre: art.nombre, precio: art.precio ?? 0 });
      setModalOpen(true);
    }
  };

  const handleConfirm = (p: AddItemPayload) => {
    onAddItem({
      articulo: p.articuloNombre,
      precio: p.precio,
      cantidad: p.cantidad,
    });
    // limpiar selección para poder volver a abrir el modal con el mismo artículo si se desea
    setSelId('');
  };

  const opciones = useMemo(() => {
    return articulos.map((a) => ({ value: a.id, label: a.nombre }));
  }, [articulos]);

  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-2">
        Seleccionar artículo
      </label>
      <select
        value={selId === '' ? '' : selId}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500"
      >
        <option value="">Seleccionar artículo…</option>
        {opciones.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {error && (
        <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 text-sm">
          {error}
        </div>
      )}
      {!error && !cargando && articulos.length === 0 && (
        <div className="mt-2 text-sm text-slate-500">No hay artículos disponibles.</div>
      )}

      {/* Modal para confirmar precio/cantidad */}
      <AddItemModal
        open={modalOpen}
        articuloId={modalData?.id ?? null}
        articuloNombre={modalData?.nombre ?? ''}
        precioInicial={modalData?.precio ?? 0}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
