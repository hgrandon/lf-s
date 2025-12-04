// app/pedido/articulos/Articulos.tsx
'use client';

import { useMemo, useState } from 'react';

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
  // Modal de selección
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Dejamos nombres únicos, respetando el orden que ya viene de Supabase
  const articulosUnicos = useMemo(() => {
    const vistos = new Set<string>();
    const unicos: Articulo[] = [];

    for (const a of catalogo) {
      const key = a.nombre.trim().toUpperCase();
      if (!key) continue;
      if (vistos.has(key)) continue;
      vistos.add(key);
      unicos.push(a);
    }
    return unicos;
  }, [catalogo]);

  // Filtro por texto (prefijo, pero si quieres también contiene)
  const filtrados = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return articulosUnicos;

    return articulosUnicos.filter((a) => {
      const n = a.nombre.trim().toUpperCase();
      // primero comienza con, si no, dejamos contiene como apoyo
      return n.startsWith(q) || n.includes(q);
    });
  }, [articulosUnicos, search]);

  function handleSelect(nombre: string) {
    onSelectArticulo(nombre);
    setModalOpen(false);
    setSearch('');
  }

  return (
    <div className="space-y-4">
      {/* === BOTÓN QUE ABRE MODAL DE BÚSQUEDA === */}
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
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
            hover:brightness-105
            active:scale-[0.99]
            transition
          "
        >
          <div className="flex items-center justify-between">
            <span>SELECCIONAR UN ARTÍCULO</span>
            <span className="text-[0.65rem] opacity-90">
              Buscar / OTRO (+)
            </span>
          </div>
        </button>
        <p className="text-[0.7rem] text-white/80 mt-1">
          Artículos disponibles: <span className="font-semibold">{articulosUnicos.length}</span>
        </p>
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

      {/* === MODAL DE BÚSQUEDA FILTRADA === */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3">
          <div className="w-full max-w-md rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-sm sm:text-base font-bold">
                Buscar artículo
              </h2>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setSearch('');
                }}
                className="text-slate-500 hover:bg-slate-100 rounded-full px-2 py-1 text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>

            {/* Filtro */}
            <div className="px-4 pt-3 pb-2">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value.toUpperCase())}
                className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 text-sm uppercase"
                placeholder="ESCRIBE PARA FILTRAR (EJ: COBER)"
              />
              <p className="text-[0.7rem] text-slate-500 mt-1">
                Se mostrarán los artículos que comiencen o contengan ese texto.
              </p>
            </div>

            {/* Lista scrollable */}
            <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2">
              {/* OTRO (+) SIEMPRE ARRIBA */}
              <button
                type="button"
                onClick={() => handleSelect('__OTRO__')}
                className="w-full rounded-xl border border-dashed border-violet-300 bg-violet-50 px-3 py-2 text-left text-xs sm:text-sm font-semibold text-violet-800 hover:bg-violet-100"
              >
                OTRO (+) NUEVO ARTÍCULO
              </button>

              {filtrados.length === 0 && (
                <div className="mt-3 text-xs text-slate-500">
                  No hay artículos que coincidan con &quot;{search}&quot;.
                </div>
              )}

              {filtrados.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleSelect(a.nombre)}
                  className="w-full rounded-xl bg-slate-50 hover:bg-slate-100 px-3 py-2 text-left text-xs sm:text-sm flex justify-between items-center"
                >
                  <span className="font-semibold">
                    {a.nombre.toUpperCase()}
                  </span>
                  {a.precio != null && (
                    <span className="text-[0.7rem] text-slate-500">
                      {CLP.format(a.precio)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
