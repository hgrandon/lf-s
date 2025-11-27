// app/pedido/articulos/Articulos.tsx
import { useState } from 'react';

export type Articulo = {
  id: number;
  nombre: string;
  precio: number;
  activo: boolean;
};

export type Item = { articulo: string; qty: number; valor: number; subtotal: number };

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

  function handleChangeSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (!value) {
      setSel('');
      return;
    }
    setSel(''); // vuelve a "SELECCIONAR…" después
    onSelectArticulo(value); // dispara modal / lógica en el padre
  }

  return (
    <>
      {/* Selector de artículo */}
      <div className="grid gap-2 mb-3">
        <label className="text-sm font-semibold">Seleccionar artículo</label>
        <div className="flex gap-2 items-center">
          <select
            value={sel}
            onChange={handleChangeSelect}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none"
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
      </div>

      {/* Tabla detalle con fondo degradado estilo base */}
      <div className="mt-2 overflow-hidden rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white">
        <table className="w-full text-sm">
          <thead className="bg-white/10">
            <tr>
              <th className="text-left px-4 py-2 w-[45%]">Artículo</th>
              <th className="text-center px-2 py-2 w-[10%]">Cant.</th>
              <th className="text-right px-3 py-2 w-[15%]">Valor</th>
              <th className="text-right px-3 py-2 w-[20%]">Subtotal</th>
              <th className="text-center px-3 py-2 w-[10%]">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={5}
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
                <td className="px-4 py-2">{it.articulo}</td>
                <td className="px-2 py-2 text-center">{it.qty}</td>
                <td className="px-3 py-2 text-right">
                  {CLP.format(it.valor)}
                </td>
                <td className="px-3 py-2 text-right">
                  {CLP.format(it.subtotal)}
                </td>
                <td className="px-3 py-2 text-center">LAVAR</td>
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
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
