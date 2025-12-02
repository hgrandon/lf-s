'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Filter,
  Plus,
  Search,
  ChevronRight,
  UserCircle2,
  Pencil,
  Trash2,
} from 'lucide-react';

export type Cliente = {
  telefono: string;
  nombre: string;
  direccion: string;
};

type Props = {
  /** Lista a mostrar (visual solamente) */
  items?: Cliente[];

  /** Callbacks opcionales (visual dispara eventos, tú decides qué hacer) */
  onBack?: () => void;
  onFilter?: () => void;
  onAdd?: () => void;
  onSelect?: (cli: Cliente) => void;
  onEdit?: (cli: Cliente) => void;
  onDelete?: (cli: Cliente) => void;

  /** Búsqueda controlada externa (opcional) */
  query?: string;
  onQueryChange?: (q: string) => void;

  /** Placeholder de búsqueda */
  searchPlaceholder?: string;

  /** Modo compacto para web/desk */
  compact?: boolean;
};

/**
 * Componente 100% visual de clientes.
 */
export default function ClientesVisual({
  items = [],
  onBack,
  onFilter,
  onAdd,
  onSelect,
  onEdit,
  onDelete,
  query,
  onQueryChange,
  searchPlaceholder = 'Buscar por nombre, teléfono o dirección…',
  compact,
}: Props) {
  // Estado interno de búsqueda si no te pasan controlado
  const [qLocal, setQLocal] = useState('');
  const q = query ?? qLocal;

  const filtered = useMemo(() => {
    const t = (q || '').trim().toLowerCase();
    if (!t) return items;
    return items.filter(
      (c) =>
        c.telefono.toLowerCase().includes(t) ||
        c.nombre.toLowerCase().includes(t) ||
        c.direccion.toLowerCase().includes(t),
    );
  }, [items, q]);

  const handleQuery = (v: string) => {
    if (onQueryChange) onQueryChange(v);
    else setQLocal(v);
  };

  return (
    <div className="w-full min-h-svh bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white flex justify-center">
      <div
        className={[
          'w-full',
          compact ? 'max-w-5xl' : 'max-w-md',
          'flex flex-col',
        ].join(' ')}
      >
        {/* HEADER MORADO FIJO */}
        <div className="sticky top-0 z-20 bg-gradient-to-r from-violet-800/95 via-fuchsia-700/95 to-indigo-800/95 backdrop-blur border-b border-white/10">
          <div className="px-4 pt-4 pb-3 space-y-3">
            {/* fila título + volver */}
            <div className="flex items-center justify-between">
              <h1 className="font-bold text-lg lg:text-2xl">Clientes</h1>
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1 text-sm text-white/90 hover:text-white"
              >
                <ArrowLeft className="size-4" />
                <span>Volver</span>
              </button>
            </div>

            {/* fila botón agregar + filtro (opcional) */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={onAdd}
                className="inline-flex items-center gap-2 px-4 h-9 rounded-full bg-white/10 border border-white/30 text-xs lg:text-sm font-medium hover:bg-white/20 active:scale-[0.98] transition"
              >
                <Plus className="size-4" />
                <span>Agregar cliente</span>
              </button>

              {onFilter && (
                <button
                  onClick={onFilter}
                  className="p-2 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 active:scale-[0.98] transition"
                  aria-label="Filtros"
                >
                  <Filter className="size-4" />
                </button>
              )}
            </div>

            {/* buscador */}
            <div>
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50" />
                <input
                  value={q}
                  onChange={(e) => handleQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-11 pr-3 h-10 rounded-3xl bg-white/10 border border-white/25 text-sm placeholder:text-white/60 text-white focus:bg-white/15 focus:border-white focus:ring-2 focus:ring-white/40 outline-none transition"
                />
              </label>
            </div>
          </div>
        </div>

        {/* LISTA */}
        <ul className="flex-1 divide-y divide-white/10">
          {filtered.length === 0 ? (
            <li className="px-4 py-10 text-center text-white/70">
              Sin resultados
            </li>
          ) : (
            filtered.map((c) => (
              <li key={c.telefono} className="bg-white/5">
                <div className="px-4 py-3 flex items-center gap-3">
                  {/* Avatar */}
                  <div className="shrink-0">
                    <div className="size-11 rounded-full bg-white/15 flex items-center justify-center border border-white/30">
                      <UserCircle2 className="size-6 text-white" />
                    </div>
                  </div>

                  {/* Datos */}
                  <button
                    onClick={() => onSelect?.(c)}
                    className="flex-1 text-left group"
                  >
                    <div className="font-semibold leading-5 group-hover:text-white">
                      {c.nombre || '—'}
                    </div>
                    <div className="text-[13px] text-white/80 leading-5">
                      +56 {prettyPhone(c.telefono)}
                    </div>
                    <div className="text-[13px] text-white/60 leading-5 truncate">
                      {c.direccion || 'Sin dirección'}
                    </div>
                  </button>

                  {/* Acciones rápidas */}
                  <div className="flex items-center gap-1">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(c)}
                        className="p-2 rounded-lg hover:bg-white/10 transition"
                        aria-label="Editar"
                      >
                        <Pencil className="size-5 text-white/90" />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(c)}
                        className="p-2 rounded-lg hover:bg-red-500/20 transition"
                        aria-label="Eliminar"
                        title="Eliminar"
                      >
                        <Trash2 className="size-5 text-red-200" />
                      </button>
                    )}
                    <ChevronRight className="size-5 text-white/40 ml-1" />
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

/** Formatea 9–10 dígitos chilenos a 3-4-4 (visual) */
function prettyPhone(tel: string) {
  const s = (tel || '').replace(/\D+/g, '');
  if (s.length < 7) return s;
  if (s.length === 9) return `${s.slice(0, 1)} ${s.slice(1, 5)} ${s.slice(5)}`;
  if (s.length === 10) return `${s.slice(0, 2)} ${s.slice(2, 6)} ${s.slice(6)}`;
  return s;
}
