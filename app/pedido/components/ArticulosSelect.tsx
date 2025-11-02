'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Item } from './DetallePedido';

export type ArticuloRow = {
  nombre: string;
  precio: number | null;
  activo?: boolean | null;
};

export default function ArticulosSelect({
  onAddItem,
}: {
  onAddItem: (item: Item) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<ArticuloRow[]>([]);
  const [sel, setSel] = useState<string>(''); // nombre elegido o __NEW__

  // Modal (reutilizable) para agregar/editar antes de insertar al detalle
  const [modal, setModal] = useState<{
    open: boolean;
    isNew: boolean;
    nombre: string;
    precio: string; // texto para input
    qty: string;    // texto para input
  }>({ open: false, isNew: false, nombre: '', precio: '', qty: '1' });

  // Cargar artículos desde _bak_articulo
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const { data, error } = await supabase
          .from('_bak_articulo')
          .select('nombre, precio, activo')
          .eq('activo', true)
          .order('nombre', { ascending: true });

        if (error) throw error;

        // Deduplicar por nombre y filtrar nulos
        const list = (data || [])
          .filter(r => r && r.nombre)
          .reduce<Record<string, ArticuloRow>>((acc, r) => {
            if (!acc[r.nombre]) acc[r.nombre] = r as ArticuloRow;
            return acc;
          }, {});
        setRows(Object.values(list));
      } catch (e: any) {
        setErr(e?.message ?? 'No se pudieron cargar artículos.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const opciones = useMemo(() => {
    const base = rows.map(r => ({ value: r.nombre, label: r.nombre }));
    return [
      { value: '', label: 'Seleccionar artículo…' },
      { value: '__NEW__', label: '➕ Agregar artículo…' },
      ...base,
    ];
  }, [rows]);

  // Al cambiar el select
  const handleChange = (v: string) => {
    setSel(v);

    if (v === '__NEW__') {
      // Abrir modal vacío para crear nuevo artículo
      setModal({
        open: true,
        isNew: true,
        nombre: '',
        precio: '',
        qty: '1',
      });
      return;
    }

    // Si es un artículo existente, abrir modal con precio precargado y qty=1
    const found = rows.find(r => r.nombre === v);
    if (found) {
      setModal({
        open: true,
        isNew: false,
        nombre: found.nombre,
        precio: String(found.precio ?? ''),
        qty: '1',
      });
    }
  };

  // Guardar desde modal (tanto nuevo como existente)
  const handleModalSave = async () => {
    const nombre = modal.nombre.trim().toUpperCase();
    const precioNum = Math.max(0, Number(modal.precio || 0));
    const qtyNum = Math.max(1, Number(modal.qty || 1));

    if (!nombre) return;
    // Añadir al detalle
    onAddItem({
      articulo: nombre,
      qty: qtyNum,
      valor: precioNum,
      subtotal: precioNum * qtyNum,
      estado: 'LAVAR',
    });

    // Si es nuevo -> persistir en catálogo para futuras veces
    if (modal.isNew) {
      try {
        await supabase.from('_bak_articulo').insert({
          nombre,
          precio: precioNum,
          activo: true,
        });
        // actualizar combo en memoria
        setRows((prev) => {
          // si ya existía, no duplicar
          if (prev.some(p => p.nombre === nombre)) return prev;
          return [...prev, { nombre, precio: precioNum, activo: true }];
        });
      } catch {
        // si falla la inserción, solo ignoramos (igual queda en el pedido actual)
      }
    }

    // cerrar modal y reset select
    setModal({ open: false, isNew: false, nombre: '', precio: '', qty: '1' });
    setSel('');
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">Seleccionar artículo</label>

      <select
        className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500"
        value={sel}
        onChange={(e) => handleChange(e.target.value)}
        disabled={loading}
      >
        {opciones.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {err && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
          {err}
        </div>
      )}

      {/* Modal para confirmación de precio/cantidad o creación de artículo */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Header con degradado consistente */}
            <div className="bg-gradient-to-r from-fuchsia-600 to-violet-700 px-5 py-4">
              <h3 className="text-white font-bold text-lg">
                {modal.isNew ? 'Agregar artículo' : modal.nombre}
              </h3>
            </div>

            <div className="p-5 space-y-3 text-slate-900">
              {modal.isNew && (
                <div>
                  <label className="block text-sm font-semibold mb-1">Nombre</label>
                  <input
                    value={modal.nombre}
                    onChange={(e) => setModal(m => ({ ...m, nombre: e.target.value.toUpperCase() }))}
                    placeholder="NOMBRE DEL ARTÍCULO"
                    className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500 uppercase"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-1">Precio</label>
                <input
                  inputMode="numeric"
                  value={modal.precio}
                  onChange={(e) => {
                    const onlyNum = e.target.value.replace(/[^\d]/g, '');
                    setModal(m => ({ ...m, precio: onlyNum }));
                  }}
                  placeholder="0"
                  className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500 text-right"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Cantidad</label>
                <input
                  inputMode="numeric"
                  value={modal.qty}
                  onChange={(e) => {
                    const onlyNum = e.target.value.replace(/[^\d]/g, '');
                    setModal(m => ({ ...m, qty: onlyNum }));
                  }}
                  placeholder="1"
                  className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 outline-none focus:border-violet-500 text-right"
                />
              </div>

              <div className="pt-1 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleModalSave}
                  className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-700 text-white px-4 py-2.5 font-semibold hover:opacity-95"
                  disabled={!modal.nombre.trim() || modal.precio === '' || modal.qty === ''}
                >
                  Agregar Detalle
                </button>
                <button
                  onClick={() => {
                    setModal({ open: false, isNew: false, nombre: '', precio: '', qty: '1' });
                    setSel('');
                  }}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-violet-700 font-semibold hover:bg-slate-50"
                >
                  Salir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
