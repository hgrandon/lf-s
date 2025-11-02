'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, User, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type Cliente = {
  telefono: string;
  nombre: string | null;
  direccion: string | null;
  tipo?: string | null; // LOCAL/DOMICILIO si lo tienes
};

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function onlyDigits(s: string): string {
  return (s || '').replace(/\D+/g, '');
}

export default function ClientesPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Evita setState post-unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Debounce de 300ms
  const debouncedQ = useDebouncedValue(q, 300);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const term = debouncedQ.trim();
        const filters: string[] = [];

        if (term.length >= 1) {
          const like = `%${term}%`;
          filters.push(`nombre.ilike.${like}`);
          filters.push(`telefono.ilike.${like}`);
          filters.push(`direccion.ilike.${like}`);
        }

        // Si no hay término, traemos un tope razonable (p.ej. 200)
        const base = supabase
          .from('clientes')
          .select('telefono,nombre,direccion', { count: 'exact' });

        const query = filters.length
          ? base.or(filters.join(',')).limit(200)
          : base.order('nombre', { ascending: true }).limit(200);

        const { data, error } = await query;

        if (error) throw error;

        if (!cancelled && mountedRef.current) {
          setRows((data || []) as Cliente[]);
        }
      } catch (e: any) {
        if (!cancelled && mountedRef.current) {
          setErr(e?.message ?? 'Error al buscar clientes');
        }
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  // Filtro y orden local (mejora precisión: acentos/teléfono)
  const list = useMemo(() => {
    const term = normalize(q);
    const digits = onlyDigits(q);
    if (!term && !digits) {
      return rows.sort((a, b) => normalize(a.nombre || '').localeCompare(normalize(b.nombre || '')));
    }

    const scored = rows
      .map((c) => {
        const n = normalize(c.nombre || '');
        const d = onlyDigits(c.telefono);
        const addr = normalize(c.direccion || '');

        let score = 0;
        if (n.includes(term)) score += 3; // nombre pesa más
        if (addr.includes(term)) score += 1;
        if (digits && d.includes(digits)) score += 4; // teléfono pesa mucho
        if (!term && digits && d.startsWith(digits)) score += 2;

        return { c, score };
      })
      .filter((s) => s.score > 0 || (!term && !digits)); // si no hay término, deja todos
    scored.sort((a, b) => b.score - a.score || normalize(a.c.nombre || '').localeCompare(normalize(b.c.nombre || '')));
    return scored.map((s) => s.c);
  }, [rows, q]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-900 via-fuchsia-800 to-indigo-900 text-white">
      <header className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <button
          onClick={() => router.push('/clientes/nuevo')}
          className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/15 px-3 py-2 hover:bg-white/15"
        >
          <Plus size={16} />
          Agregar cliente
        </button>
      </header>

      <section className="max-w-3xl mx-auto px-4 pb-28">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70" size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, teléfono o dirección…"
            className="w-full rounded-xl pl-9 pr-3 py-3 bg-white/10 border border-white/15 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
        </div>

        {err && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-300/30 bg-red-500/20 px-4 py-3 text-sm">
            <AlertTriangle size={16} />
            <span>{err}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-white/90">
            <Loader2 className="animate-spin" size={18} />
            Buscando…
          </div>
        ) : list.length === 0 ? (
          <div className="text-white/80">Sin resultados.</div>
        ) : (
          <div className="grid gap-2">
            {list.map((c) => (
              <button
                key={c.telefono}
                onClick={() => router.push(`/clientes/${onlyDigits(c.telefono)}`)}
                className="group w-full text-left rounded-2xl bg-white/10 border border-white/15 p-3 hover:bg-white/14 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 border border-white/20">
                      <User size={16} />
                    </span>
                    <div>
                      <div className="font-semibold">{c.nombre || 'SIN NOMBRE'}</div>
                      <div className="text-xs text-white/80">+56 {onlyDigits(c.telefono)}</div>
                      <div className="text-[11px] text-white/70">{c.direccion || '—'}</div>
                    </div>
                  </div>
                  <ChevronRight className="text-white/70 group-hover:text-white" size={16} />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
