// app/pedido/articulos/Articulos.tsx
import { Plus, Trash2 } from 'lucide-react';

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
  selArt: string;
  onSelArtChange: (v: string) => void;
  onAgregar: () => void;
  onDeleteItem: (index: number) => void;
  total: number;
};

export default function Articulos({
  catalogo,
  items,
  selArt,
  onSelArtChange,
  onAgregar,
  onDeleteItem,
  total,
}: Props) {
  return (
    <>
      {/* Selector de artículo */}
      <div className="grid gap-2 mb-3">
        <label className="text-sm font-semibold">Seleccionar artículo</label>
        <div className="flex gap-2 items-center">
          <select
            value={selArt}
            onChange={(e) => onSelArtChange(e.target.value)}
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
          <button
            onClick={onAgregar}
            disabled={!selArt}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 disabled:opacity-60"
          >
            <Plus size={16} /> Agregar
          </button>
        </div>
      </div>

      {/* Tabla detalle (solo lectura, estilo app local) */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-violet-100 text-violet-900">
            <tr>
              <th className="text-left px-3 py-2 w-[45%]">Artículo</th>
              <th className="text-center px-3 py-2 w-[12%]">Cantidad</th>
              <th className="text-right px-3 py-2 w-[15%]">Valor</th>
              <th className="text-right px-3 py-2 w-[18%]">Subtotal</th>
              <th className="text-center px-3 py-2 w-[10%]">Estado</th>
              <th className="px-3 py-2 w-[7%]" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-4 text-center text-slate-500"
                >
                  Sin artículos todavía.
                </td>
              </tr>
            )}
            {items.map((it, idx) => (
              <tr key={`${idx}-${it.articulo}`}>
                <td className="px-3 py-2">{it.articulo}</td>
                <td className="px-3 py-2 text-center">{it.qty}</td>
                <td className="px-3 py-2 text-right">
                  {CLP.format(it.valor)}
                </td>
                <td className="px-3 py-2 text-right">
                  {CLP.format(it.subtotal)}
                </td>
                <td className="px-3 py-2 text-center">LAVAR</td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => onDeleteItem(idx)}
                    className="inline-flex items-center rounded-lg px-2 py-1 hover:bg-slate-100"
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={3}
                className="px-3 py-3 text-right font-bold"
              >
                Total
              </td>
              <td className="px-3 py-3 text-right font-extrabold">
                {CLP.format(total)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
