// app/rotulos/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Printer, RefreshCw, ArrowLeft, AlertTriangle } from 'lucide-react';

type EstadoKey =
  | 'LAVAR'
  | 'LAVANDO'
  | 'GUARDAR'
  | 'GUARDADO'
  | 'ENTREGADO'
  | 'ENTREGAR';

type PedidoDb = {
  nro: number;
  telefono: string | null;
  total: number | null;
  estado: string | null;
  tipo_entrega: string | null;
  fecha_ingreso: string | null;
  fecha_entrega: string | null;
  bolsas: number | null;
};

type ClienteDb = {
  telefono: string;
  nombre: string | null;
  direccion: string | null;
};

type PedidoRotulo = {
  nro: number;
  telefono: string;
  clienteNombre: string;
  direccion: string;
  total: number | null;
  estado: EstadoKey;
  tipoEntrega: 'LOCAL' | 'DOMICILIO' | null;
  fechaIngreso: string | null;
  fechaEntrega: string | null;
  bolsas: number;
};

type RotuloConBolsa = {
  pedido: PedidoRotulo;
  bolsaIndex: number; // 1, 2, 3…
  bolsasTotal: number; // total de bolsas de ese pedido
};

const ESTADOS_VALIDOS: EstadoKey[] = [
  'LAVAR',
  'LAVANDO',
  'GUARDAR',
  'GUARDADO',
  'ENTREGADO',
  'ENTREGAR',
];

function normalizeEstado(v: string | null): EstadoKey | null {
  if (!v) return null;
  const key = v.trim().toUpperCase();
  return ESTADOS_VALIDOS.includes(key as EstadoKey) ? (key as EstadoKey) : null;
}

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export default function RotulosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 👉 parámetros desde la URL, por ejemplo /rotulos?nro=6351&copies=2
  const nroFiltro = useMemo(() => {
    const raw = searchParams.get('nro');
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);

  const copies = useMemo(() => {
    const raw = searchParams.get('copies');
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [searchParams]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // rótulos ya “explotados” por bolsas (y por copias si corresponde)
  const [rotulos, setRotulos] = useState<RotuloConBolsa[]>([]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function fetchRotulos() {
    if (!mountedRef.current) return;
    setLoading(true);
    setErr(null);

    try {
      // 1) Pedidos base
      let pedQuery = supabase
        .from('pedido')
        .select(
          'nro, telefono, total, estado, tipo_entrega, fecha_ingreso, fecha_entrega, bolsas',
        );

      if (nroFiltro) {
        // 👉 si viene nro, solo ese pedido (independiente del estado)
        pedQuery = pedQuery.eq('nro', nroFiltro);
      } else {
        // 👉 si no hay filtro, los de LAVAR / LAVANDO como antes
        pedQuery = pedQuery.in('estado', ['LAVAR', 'LAVANDO']);
      }

      const { data: pedData, error: pedErr } = await pedQuery.order('nro', {
        ascending: true,
      });

      if (pedErr) throw pedErr;

      const pedidosRaw = (pedData as PedidoDb[]) || [];
      if (!pedidosRaw.length) {
        if (mountedRef.current) setRotulos([]);
        return;
      }

      // 2) Teléfonos únicos -> clientes
      const telefonos = Array.from(
        new Set(
          pedidosRaw
            .map((p) => (p.telefono || '').toString().trim())
            .filter((t) => t.length > 0),
        ),
      );

      const clientesMap = new Map<string, ClienteDb>();

      if (telefonos.length) {
        const { data: cliData, error: cliErr } = await supabase
          .from('clientes')
          .select('telefono,nombre,direccion')
          .in('telefono', telefonos);

        if (cliErr) throw cliErr;

        (cliData as ClienteDb[]).forEach((c) => {
          clientesMap.set((c.telefono || '').toString().trim(), c);
        });
      }

      // 3) Combinar pedidos + clientes
      const pedidosBase: PedidoRotulo[] = pedidosRaw
        .map((p) => {
          const estadoNorm = normalizeEstado(p.estado);
          if (!estadoNorm) return null;

          const tel = (p.telefono || '').toString().trim();
          const cli = tel ? clientesMap.get(tel) : undefined;

          return {
            nro: Number(p.nro),
            telefono: tel || '',
            clienteNombre: (cli?.nombre || '').toString().toUpperCase(),
            direccion: (cli?.direccion || '').toString().toUpperCase(),
            total: p.total,
            estado: estadoNorm,
            tipoEntrega: p.tipo_entrega
              ? p.tipo_entrega.toString().toUpperCase() === 'DOMICILIO'
                ? 'DOMICILIO'
                : 'LOCAL'
              : null,
            fechaIngreso: p.fecha_ingreso,
            fechaEntrega: p.fecha_entrega,
            bolsas: Math.max(1, Number(p.bolsas || 1)), // mínimo 1
          } as PedidoRotulo;
        })
        .filter((x): x is PedidoRotulo => x !== null)
        .sort((a, b) => a.nro - b.nro);

      // 4) “Explotar” cada pedido en N rótulos (1/3, 2/3, 3/3…)
      const rotulosPorBolsa: RotuloConBolsa[] = [];
      for (const ped of pedidosBase) {
        const totalBolsas = ped.bolsas || 1;
        for (let i = 1; i <= totalBolsas; i++) {
          rotulosPorBolsa.push({
            pedido: ped,
            bolsaIndex: i,
            bolsasTotal: totalBolsas,
          });
        }
      }

      // 5) Si viene copies y hay filtro de nro, replicar ese set de rótulos
      let rotulosFinal: RotuloConBolsa[] = rotulosPorBolsa;
      if (nroFiltro && copies > 1) {
        rotulosFinal = [];
        for (let i = 0; i < copies; i++) {
          // push una copia completa de la lista
          rotulosFinal.push(...rotulosPorBolsa);
        }
      }

      if (mountedRef.current) setRotulos(rotulosFinal);
    } catch (e: any) {
      console.error('Error cargando rótulos', e);
      if (mountedRef.current) {
        setErr(e?.message ?? 'No se pudieron cargar los rótulos.');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    fetchRotulos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nroFiltro, copies]);

  const cantidad = useMemo(() => rotulos.length, [rotulos]);

  function handlePrint() {
    if (!rotulos.length) {
      alert('No hay rótulos para imprimir.');
      return;
    }

    if (typeof window === 'undefined' || typeof window.print !== 'function') {
      alert(
        'La opción de impresión solo funciona en un navegador de escritorio. ' +
          'Abre la app en el PC para generar el PDF.',
      );
      return;
    }

    setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        console.error('Error al llamar a window.print()', e);
        alert('No se pudo abrir el cuadro de impresión en este navegador.');
      }
    }, 50);
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white pb-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* HEADER (no se imprime) */}
      <header className="relative z-10 flex items-center justify-between px-4 py-4 max-w-6xl mx-auto print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/base')}
            className="inline-flex items-center gap-1 rounded-xl bg-white/10 border border-white/15 px-2 py-1 text-xs sm:text-sm hover:bg-white/15"
          >
            <ArrowLeft size={14} />
            Base
          </button>
          <div>
            <h1 className="font-bold text-xl sm:text-2xl">Rótulos</h1>
            <p className="text-xs sm:text-sm text-white/80">
              {nroFiltro
                ? `Pedido Nº ${nroFiltro}`
                : 'Pedidos en estado LAVAR / LAVANDO'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={fetchRotulos}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs sm:text-sm hover:bg-white/15 disabled:opacity-60 print:hidden"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl bg-white text-violet-800 px-3 py-2 text-xs sm:text-sm font-semibold shadow hover:bg-violet-50 print:hidden"
          >
            <Printer size={16} />
            Imp Rotulo
          </button>
        </div>
      </header>

      {/* ERROR (no se imprime) */}
      {err && (
        <div className="relative z-10 mx-auto max-w-6xl px-4 print:hidden">
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-red-100">
            <AlertTriangle size={16} />
            <span>{err}</span>
          </div>
        </div>
      )}

      {/* INFO ARRIBA (no se imprime) */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 mb-2 print:hidden">
        <p className="text-xs sm:text-sm text-white/85">
          Total rótulos a imprimir:{' '}
          <span className="font-bold text-yellow-200">{cantidad}</span>
        </p>
        <p className="text-[0.7rem] sm:text-xs text-white/70 mt-1">
          En el cuadro de impresión puedes elegir &quot;Guardar como PDF&quot; para
          generar el archivo.
        </p>
      </section>

      {/* CONTENIDO IMPRIMIBLE */}
      <section className="relative z-10 mx-auto max-w-6xl px-2 sm:px-4 pb-8">
        {loading && (
          <div className="mt-10 text-center text-sm print:hidden">
            Cargando pedidos para rótulos…
          </div>
        )}

        {!loading && !rotulos.length && (
          <div className="mt-10 text-center text-sm print:hidden">
            No hay rótulos para imprimir.
          </div>
        )}

        <div
          className="
            grid gap-3 sm:gap-3
            grid-cols-1 sm:grid-cols-2
            print:grid-cols-2
            print:gap-y-0
            print:gap-x-0
          "
        >
          {rotulos.map((r, idx) => (
            <RotuloCard
              key={`${r.pedido.nro}-${r.bolsaIndex}-${idx}`}
              pedido={r.pedido}
              bolsaIndex={r.bolsaIndex}
              bolsasTotal={r.bolsasTotal}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

/* =========================
   Tarjeta de Rótulo TIPO ETIQUETA
   Tamaño: 8.5 x 2.5 cm (ajustable)
========================= */

function RotuloCard({
  pedido,
  bolsaIndex,
  bolsasTotal,
}: {
  pedido: PedidoRotulo;
  bolsaIndex: number;
  bolsasTotal: number;
}) {
  const direccionLimpia =
    !pedido.direccion || pedido.direccion?.trim().toUpperCase() === 'LOCAL'
      ? 'LAVANDERÍA FABIOLA'
      : pedido.direccion.toUpperCase();

  // Mostrar fracción SOLO si hay más de 1 bolsa (no mostrar 1/1)
  const fraccionTexto = bolsasTotal > 1 ? `${bolsaIndex}/${bolsasTotal}` : '';

  return (
    <div
      className="
        bg-white text-slate-900 border border-violet-700
        flex flex-col justify-center items-center gap-1
        break-inside-avoid
        print:border-violet-700
      "
      style={{
        width: '8.3cm',
        height: '2.4cm',
        padding: '0.2cm',
      }}
    >
      {/* LOGO + NOMBRE + NRO + FRACCIÓN */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {/* LOGO grande */}
          <img
            src="/logo.png"
            alt="LF"
            style={{ width: '1.7cm', height: '1.7cm', objectFit: 'contain' }}
          />

          <div className="flex flex-col leading-tight">
            {/* Nombre */}
            <span className="text-[0.75rem] font-bold text-violet-700 uppercase tracking-tight">
              {pedido.clienteNombre || 'SIN NOMBRE'}
            </span>

            {/* NÚMERO DE PEDIDO MÁS GRANDE */}
            <span className="text-[3.3rem] leading-none text-violet-700 font-black">
              {pedido.nro}
            </span>
          </div>
        </div>

        {/* FRACCIÓN DE BOLSAS MÁS GRANDE */}
        {fraccionTexto && (
          <div className="pl-3 pr-1 text-violet-700 font-black text-[1.9rem] whitespace-nowrap">
            {fraccionTexto}
          </div>
        )}
      </div>

      {/* Monto + Dirección */}
      <div
        className="flex w-full items-baseline justify-between gap-3 font-medium"
        style={{ marginTop: '-2px' }}
      >
        <span className="text-[0.8rem] font-bold text-violet-700 shrink-0">
          {pedido.total != null ? CLP.format(pedido.total) : '$ 0'}
        </span>

        <span className="flex-1 text-[0.65rem] font-semibold text-violet-700 uppercase tracking-tight text-left">
          {direccionLimpia}
        </span>
      </div>
    </div>
  );
}
