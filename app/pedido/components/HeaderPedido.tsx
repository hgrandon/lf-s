'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeftCircle, Loader2, Phone } from 'lucide-react';

export type Cliente = { telefono: string; nombre: string; direccion: string };
export type NextNumber = { nro: number; fecha: string; entrega: string };

const telClean = (v: string) => v.replace(/\D+/g, '').slice(0, 9);
const isoToday = () => new Date().toISOString().slice(0, 10);

function addBusinessDays(fromISO: string, days = 3) {
  const d = new Date(fromISO + 'T00:00:00');
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

export default function HeaderPedido({
  onCliente,
  onNroInfo,
}: {
  onCliente: (c: Cliente | null) => void;
  onNroInfo: (n: NextNumber) => void;
}) {
  const router = useRouter();

  const [tel, setTel] = useState('');
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loadingCliente, setLoadingCliente] = useState(false);
  const [nroInfo, setNroInfo] = useState<NextNumber>({
    nro: 1,
    fecha: isoToday(),
    entrega: addBusinessDays(isoToday(), 3),
  });

  /** ===============================
   *  Correlativo robusto:
   *  1) RPC next_pedido_number (si existe)
   *  2) MAX(nro) + 1   (columna nro)
   *  3) MAX(id)  + 1   (fallback si no hay nro)
   * =============================== */
  async function computeNextNumber(): Promise<NextNumber> {
    const today = isoToday();
    const entrega = addBusinessDays(today, 3);

    // 1) RPC (si la tienes creada)
    try {
      const { data, error } = await supabase.rpc('next_pedido_number');
      if (!error && data && typeof (data as any).nro === 'number') {
        return { nro: (data as any).nro, fecha: today, entrega };
      }
    } catch {
      /* ignore */
    }

    // 2) MAX(nro)
    try {
      const { data: maxNroRow, error: maxNroErr } = await supabase
        .from('pedido')
        .select('nro')
        .order('nro', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!maxNroErr && maxNroRow && typeof (maxNroRow as any).nro === 'number') {
        return { nro: (maxNroRow as any).nro + 1, fecha: today, entrega };
      }
    } catch {
      /* ignore */
    }

    // 3) Fallback MAX(id)
    try {
      const { data: maxIdRow } = await supabase
        .from('pedido')
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxIdRow && typeof (maxIdRow as any).id === 'number') {
        return { nro: (maxIdRow as any).id + 1, fecha: today, entrega };
      }
    } catch {
      /* ignore */
    }

    // Si no hay filas aún
    return { nro: 1, fecha: today, entrega };
  }

  useEffect(() => {
    (async () => {
      const info = await computeNextNumber();
      setNroInfo(info);
      onNroInfo(info);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Buscar cliente en public.clientes cuando hay 9 dígitos
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    onCliente(null);
    setCliente(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const t = telClean(tel);
    if (t.length === 9) {
      debounceRef.current = setTimeout(() => void lookupCliente(t), 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tel]);

  async function lookupCliente(tlf: string) {
    try {
      setLoadingCliente(true);
      const { data, error } = await supabase
        .from('clientes') // OJO: tabla plural
        .select('*')
        .eq('telefono', tlf);

      if (error) throw error;

      const row = data?.[0];
      if (row) {
        const c: Cliente = {
          telefono: row.telefono,
          nombre: (row.nombre || '').toString().toUpperCase(),
          direccion: (row.direccion || '').toString().toUpperCase(),
        };
        setCliente(c);
        onCliente(c);
      } else {
        setCliente(null);
        onCliente(null);
      }
    } finally {
      setLoadingCliente(false);
    }
  }

  return (
    <>
      {/* Fechas arriba-derecha */}
      <div className="absolute right-4 top-4 z-20 text-right leading-tight">
        <div className="text-xl sm:text-2xl font-black">{nroInfo.fecha}</div>
        <div className="text-xl sm:text-2xl font-black">{nroInfo.entrega}</div>
      </div>

      <header className="relative z-10 mx-auto max-w-6xl px-6 pt-10">
        <div className="flex items-center justify-between">
          <div className="text-4xl sm:text-5xl font-black tracking-tight">{`N° ${nroInfo.nro}`}</div>
          <button
            onClick={() => router.push('/menu')}
            className="inline-flex items-center justify-center rounded-full bg-white/10 border border-white/20 w-10 h-10 hover:bg-white/15"
            aria-label="Volver"
          >
            <ArrowLeftCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Teléfono + Nombre/Dirección (ligeramente más pequeño) */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-white/90 w-4 h-4" />
            <input
              value={tel}
              onChange={(e) => setTel(telClean(e.target.value))}
              inputMode="numeric"
              placeholder="9 dígitos…"
              className="w-[280px] rounded-xl border border-white/25 bg-white/10 text-white placeholder-white/70 pl-9 pr-3 py-2 outline-none focus:border-white/60"
            />
            {loadingCliente && (
              <Loader2 className="absolute -right-6 top-1/2 -translate-y-1/2 animate-spin text-white/90" />
            )}
          </div>

          {cliente && (
            <div className="text-[22px] sm:text-2xl font-extrabold tracking-tight">
              {cliente.nombre}
              <span className="ml-3 text-[18px] sm:text-xl font-semibold text-white/90">
                {cliente.direccion}
              </span>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
