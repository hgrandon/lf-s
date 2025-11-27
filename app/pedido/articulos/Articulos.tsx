'use client';

import { useState, type ChangeEvent } from 'react';

export type Articulo = {
  id: number;
  nombre: string;
  precio: number;
  activo: boolean;
};

export type Item = {
  articulo: string;
  qty: number;
  valor: number;
  subtotal: number;
};

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

type Props = {
  catalogo: Articulo[];
  items: Item[];
  total: number;
  // se llama cuando el usuario elige un artículo en el select
  onSelectArticulo: (nombre: string) => void;
  // se llama cuando el usuario hace clic en una fila de la tabla
  onRowClick: (index: number) => void;
};

export default function Articulos({
  catalogo,
  items,
  total,
  onSelectArticulo,
  onRowClick,
}: Props) {
  const [sel, setSel] = useState('');

  function handleChangeSelect(e: ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (!value) {
      setSel('');
      return;
    }
    setSel(''); // vuelve a “SELECCIONAR…” después
    onSelectArticulo(value); // dispara modal / lógica en el padre
  }

  return (
    <div className="space-y-3">
      {/* Selector de artículo */}
      <div className="space-y-1">
        <label className="text-sm font-semibold text-slate-800">
          Seleccionar artículo
        </label>
        <select
          value={sel}
          onChange={handleChangeSelect}
          className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-300"
        >
          <option value="">SELECCIONAR UN ARTÍCULO</option>
          {catalogo.map((a) => (
            <option key={a.id} value={a.nombre}>
              {a.nombre}
            </option>
          ))}
          <option value="__OTRO__">OTRO (+)</option>
        </select>
      </div>

      {/* Tabla detalle con fondo degradado, ocupando TODO el ancho del recuadro blanco */}
      <div className="rounded-3xl bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-[0_8px_20px_rgba(0,0,0,0.25)]">
        {/* Scroll de seguridad en celus muy angostos */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs sm:text-sm">
            <thead className="bg-white/10">
              <tr>
                <th className="text-left px-4 py-2 w-[45%]">Artículo</th>
                <th className="text-center px-2 py-2 w-[10%]">Can.</th>
                <th className="text-right px-3 py-2 w-[20%]">Valor</th>
                <th className="text-right px-3 py-2 w-[25%]">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-4 text-center text-white/80"
                  >
                    Sin artículos todavía.
                  </td>
                </tr>
              )}

              {items.map((it, idx) => (
                <tr
                  key={`${idx}-${it.articulo}`}
                  onClick={() => onRowClick(idx)}
                  className="cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <td
                    className="px-4 py-2 max-w-[220px] truncate whitespace-nowrap"
                    title={it.articulo}
                  >
                    {it.articulo.length > 18
                      ? it.articulo.slice(0, 18) + '…'
                      : it.articulo}
                  </td>
                  <td className="px-2 py-2 text-center">{it.qty}</td>
                  <td className="px-3 py-2 text-right">
                    {CLP.format(it.valor)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {CLP.format(it.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-3 text-right font-bold"
                >
                  Total:
                </td>
                <td className="px-3 py-3 text-right font-extrabold">
                  {CLP.format(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
