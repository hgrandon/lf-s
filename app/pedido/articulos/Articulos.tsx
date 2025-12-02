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
  onSelectArticulo: (nombre: string) => void;
  onRowClick: (index: number) => void;
};

export default function Articulos({
  catalogo,
  items,
  total,
  onSelectArticulo,
  onRowClick,
}: Props) {
  // usamos sel solo para poder resetear el select al placeholder
  const [sel, setSel] = useState('');

  function handleChangeSelect(e: ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (!value) {
      setSel('');
      return;
    }
    // reset al placeholder para que se pueda volver a elegir el mismo artículo
    setSel('');
    onSelectArticulo(value);
  }

  return (
    <div className="space-y-4">
      {/* === SELECTOR DE ARTÍCULOS === */}
      <div className="space-y-1">
        <select
          aria-label="Seleccionar un artículo"
          value={sel}
          onChange={handleChangeSelect}
          className="
            w-full
            rounded-2xl
            border border-white/40
            bg-gradient-to-b from-fuchsia-500/70 via-fuchsia-400/60 to-pink-300/50
            text-white font-semibold
            px-4 py-3
            text-sm
            shadow-md
            outline-none
            focus:ring-2 focus:ring-white/70 focus:border-white
          "
        >
          <option
            value=""
            className="bg-fuchsia-200 text-slate-900 font-semibold"
          >
            SELECCIONAR UN ARTÍCULO
          </option>

          {catalogo.map((a) => (
            <option
              key={a.id}
              value={a.nombre}
              className="bg-fuchsia-100 text-slate-900 font-semibold"
            >
              {a.nombre}
            </option>
          ))}

          <option
            value="__OTRO__"
            className="bg-fuchsia-100 text-slate-900 font-semibold"
          >
            OTRO (+)
          </option>
        </select>
      </div>

      {/* === TABLA A TODO EL ANCHO === */}
      <div className="rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
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
                    Sin artículos aún…
                  </td>
                </tr>
              )}

              {items.map((it, idx) => (
                <tr
                  key={`${idx}-${it.articulo}`}
                  onClick={() => onRowClick(idx)}
                  className="cursor-pointer hover:bg-white/10 transition-colors"
                >
                  {/* MÁXIMO 19 CARACTERES, MAYÚSCULAS, CON “…” */}
                  <td
                    className="px-4 py-2 max-w-[140px] truncate whitespace-nowrap font-semibold"
                    title={it.articulo}
                  >
                    {it.articulo.length > 19
                      ? `${it.articulo.slice(0, 19).toUpperCase()}…`
                      : it.articulo.toUpperCase()}
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

            <tfoot className="bg-white/10 font-bold">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right">
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
