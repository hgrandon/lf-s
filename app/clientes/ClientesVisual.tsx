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
 * Componente 100% visual.
 * - No trae ni guarda datos.
 * - Pensado para reusar con tu lógica actual (Supabase/localStorage, etc.).
 * - Estilos con Tailwind (tema morado).
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
  searchPlaceholder = 'BUSCAR X TEL / NOMBRE / DIRECCIÓN',
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
    <div className="w-full min-h-svh bg-slate-50 text-slate-900 flex justify-center">
      <div
        className={[
          'w-full',
          compact ? 'max-w-5xl' : 'max-w-md', // móvil por defecto, ancho mayor si compact en desktop
          'flex flex-col',
        ].join(' ')}
      >
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
          <div className="flex items-center justify-between px-4 h-14">
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl hover:bg-slate-100 active:scale-[0.98] transition"
              aria-label="Volver"
            >
              <ArrowLeft className="size-5" />
            </button>

            <h1 className="font-semibold text-slate-800">Clientes</h1>

            <button
              onClick={onFilter}
              className="p-2 -mr-2 rounded-xl hover:bg-slate-100 active:scale-[0.98] transition"
              aria-label="Filtros"
            >
              <Filter className="size-5" />
            </button>
          </div>

          {/* Buscar */}
          <div className="px-4 pb-3">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
              <input
                value={q}
                onChange={(e) => handleQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-11 pr-3 h-11 rounded-xl bg-slate-100/70 border border-slate-200 focus:bg-white focus:border-violet-400 focus:ring-4 focus:ring-violet-200 outline-none transition placeholder:text-slate-400 text-[15px]"
              />
            </label>
          </div>
        </div>

        {/* Lista */}
        <ul className="flex-1 divide-y divide-slate-200">
          {filtered.length === 0 ? (
            <li className="px-4 py-10 text-center text-slate-400">
              Sin resultados
            </li>
          ) : (
            filtered.map((c) => (
              <li key={c.telefono} className="bg-white">
                <div className="px-4 py-3 flex items-center gap-3">
                  {/* Avatar */}
                  <div className="shrink-0">
                    <div className="size-11 rounded-full bg-violet-100 flex items-center justify-center">
                      <UserCircle2 className="size-6 text-violet-600" />
                    </div>
                  </div>

                  {/* Datos */}
                  <button
                    onClick={() => onSelect?.(c)}
                    className="flex-1 text-left group"
                  >
                    <div className="font-semibold leading-5 group-hover:text-violet-700">
                      {c.nombre || '—'}
                    </div>
                    <div className="text-[13px] text-slate-500 leading-5">
                      +56 {prettyPhone(c.telefono)}
                    </div>
                    <div className="text-[13px] text-slate-400 leading-5 truncate">
                      {c.direccion || 'Sin dirección'}
                    </div>
                  </button>

                  {/* Acciones rápidas (opcional) */}
                  <div className="flex items-center gap-1">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(c)}
                        className="p-2 rounded-lg hover:bg-slate-100 transition"
                        aria-label="Editar"
                      >
                        <Pencil className="size-5 text-slate-600" />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(c)}
                        className="p-2 rounded-lg hover:bg-red-50 transition"
                        aria-label="Eliminar"
                        title="Eliminar"
                      >
                        <Trash2 className="size-5 text-red-600" />
                      </button>
                    )}
                    <ChevronRight className="size-5 text-slate-300 ml-1" />
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>

        {/* FAB Agregar */}
        <div className="fixed bottom-6 right-6">
          <button
            onClick={onAdd}
            className="size-14 rounded-full grid place-items-center shadow-lg bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white transition"
            aria-label="Agregar cliente"
            title="Agregar cliente"
          >
            <Plus className="size-7" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Formatea 9–10 dígitos chilenos a 3-4-4 (visual) */
function prettyPhone(tel: string) {
  const s = (tel || '').replace(/\D+/g, '');
  if (s.length < 7) return s;
  if (s.length === 9) return `${s.slice(0,1)} ${s.slice(1,5)} ${s.slice(5)}`;
  if (s.length === 10) return `${s.slice(0,2)} ${s.slice(2,6)} ${s.slice(6)}`;
  return s;
}
