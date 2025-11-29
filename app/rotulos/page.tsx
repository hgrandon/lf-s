// app/rotulos/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
};

const ESTADOS_VALIDOS: EstadoKey[] = ['LAVAR', 'LAVANDO', 'GUARDAR', 'GUARDADO', 'ENTREGADO', 'ENTREGAR'];

function normalizeEstado(v: string | null): EstadoKey | null {
  if (!v) return null;
  const key = v.trim().toUpperCase();
  return ESTADOS_VALIDOS.includes(key as EstadoKey) ? (key as EstadoKey) : null;
}

function formatFechaDisplay(iso: string | null): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}-${month}-${year}`;
}

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export default function RotulosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<PedidoRotulo[]>([]);

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
      // 1) Traer pedidos en estados LAVAR / LAVANDO
      const { data: pedData, error: pedErr } = await supabase
        .from('pedido')
        .select(
          'nro, telefono, total, estado, tipo_entrega, fecha_ingreso, fecha_entrega',
        )
        .in('estado', ['LAVAR', 'LAVANDO'])
        .order('nro', { ascending: true });

      if (pedErr) throw pedErr;

      const pedidosRaw = (pedData as PedidoDb[]) || [];
      if (!pedidosRaw.length) {
        if (mountedRef.current) {
          setPedidos([]);
        }
        return;
      }

      // 2) Telefonos únicos para buscar clientes
      const telefonos = Array.from(
        new Set(
          pedidosRaw
            .map((p) => (p.telefono || '').toString().trim())
            .filter((t) => t.length > 0),
        ),
      );

      let clientesMap = new Map<string, ClienteDb>();

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

      // 3) Combinar pedidos + cliente
      const list: PedidoRotulo[] = pedidosRaw
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
              ? (p.tipo_entrega.toString().toUpperCase() === 'DOMICILIO'
                  ? 'DOMICILIO'
                  : 'LOCAL')
              : null,
            fechaIngreso: p.fecha_ingreso,
            fechaEntrega: p.fecha_entrega,
          } as PedidoRotulo;
        })
        .filter((x): x is PedidoRotulo => x !== null)
        .sort((a, b) => a.nro - b.nro);

      if (mountedRef.current) {
        setPedidos(list);
      }
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
  }, []);

  const cantidad = useMemo(() => pedidos.length, [pedidos]);

  function handlePrint() {
    if (!pedidos.length) {
      alert('No hay pedidos en LAVAR / LAVANDO para imprimir rótulos.');
      return;
    }
    window.print();
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white pb-28">
      {/* Fondo suave */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* HEADER (oculto en impresión) */}
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
              Pedidos en estado <span className="font-semibold">LAVAR / LAVANDO</span>
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
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl bg-white text-violet-800 px-3 py-2 text-xs sm:text-sm font-semibold shadow hover:bg-violet-50 print:hidden"
          >
            <Printer size={16} />
            Imp Rotulo
          </button>
        </div>
      </header>

      {/* MENSAJE DE ERROR (no se imprime) */}
      {err && (
        <div className="relative z-10 mx-auto max-w-6xl px-4 print:hidden">
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-red-100">
            <AlertTriangle size={16} />
            <span>{err}</span>
          </div>
        </div>
      )}

      {/* INFO ARRIBA (oculta en impresión) */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 mb-2 print:hidden">
        <p className="text-xs sm:text-sm text-white/85">
          Total rótulos a imprimir:{' '}
          <span className="font-bold text-yellow-200">{cantidad}</span>
        </p>
        <p className="text-[0.7rem] sm:text-xs text-white/70 mt-1">
          En el cuadro de impresión puedes elegir &quot;Guardar como PDF&quot; para generar el archivo.
        </p>
      </section>

      {/* CONTENIDO IMPRIMIBLE */}
      <section className="relative z-10 mx-auto max-w-6xl px-2 sm:px-4 pb-8">
        {loading && (
          <div className="mt-10 text-center text-sm print:hidden">
            Cargando pedidos para rótulos…
          </div>
        )}

        {!loading && !pedidos.length && (
          <div className="mt-10 text-center text-sm print:hidden">
            No hay pedidos en LAVAR / LAVANDO para imprimir rótulos.
          </div>
        )}

        {/* GRID de rótulos (en impresión se ve en blanco/negro según impresora) */}
        <div
          className="
            grid gap-3 sm:gap-4
            grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
            print:grid-cols-2 print:gap-2
          "
        >
          {pedidos.map((p) => (
            <RotuloCard key={p.nro} pedido={p} />
          ))}
        </div>
      </section>
    </main>
  );
}

/* =========================
   Tarjeta de Rótulo
========================= */

function RotuloCard({ pedido }: { pedido: PedidoRotulo }) {
  const estadoColor = (() => {
    switch (pedido.estado) {
      case 'LAVAR':
        return 'bg-red-500';
      case 'LAVANDO':
        return 'bg-orange-500';
      case 'GUARDADO':
        return 'bg-emerald-500';
      case 'ENTREGAR':
        return 'bg-blue-500';
      case 'ENTREGADO':
        return 'bg-slate-500';
      default:
        return 'bg-violet-500';
    }
  })();

  const tipoEntrega = pedido.tipoEntrega || 'LOCAL';

  return (
    <div
      className="
        bg-white text-slate-900 rounded-xl border border-slate-300 shadow-sm
        p-3 sm:p-4
        break-inside-avoid
        print:shadow-none print:rounded-none print:border-black
      "
      style={{
        // aprox tamaño tipo etiqueta
        minHeight: '8.5cm',
      }}
    >
      {/* Header: logo + nro + estado */}
      <div className="flex items-start justify-between mb-2 border-b border-slate-300 pb-1.5">
        <div className="flex flex-col">
          <span className="text-[0.7rem] font-semibold text-slate-600">
            LAVANDERÍA
          </span>
          <span className="text-[0.95rem] font-extrabold tracking-wide">
            FABIOLA
          </span>
          <span className="text-[0.65rem] text-slate-500">
            SERVICIO DE LAVADO
          </span>
        </div>
        <div className="text-right">
          <div className="text-[0.7rem] text-slate-600">SERVICIO</div>
          <div className="text-[1.1rem] font-black leading-tight">
            #{pedido.nro}
          </div>
          <div
            className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] font-bold text-white ${estadoColor}`}
          >
            {pedido.estado}
          </div>
        </div>
      </div>

      {/* Cliente / Teléfono / Dirección */}
      <div className="mb-1.5">
        <div className="text-[0.7rem] font-semibold text-slate-600">
          CLIENTE
        </div>
        <div className="text-[0.9rem] font-bold uppercase">
          {pedido.clienteNombre || 'SIN NOMBRE'}
        </div>
      </div>
      <div className="mb-1">
        <span className="text-[0.7rem] font-semibold text-slate-600">
          TEL:
        </span>{' '}
        <span className="text-[0.85rem] font-semibold">
          {pedido.telefono || '-'}
        </span>
      </div>
      <div className="mb-2">
        <div className="text-[0.7rem] font-semibold text-slate-600">
          DIRECCIÓN
        </div>
        <div className="text-[0.75rem] uppercase">
          {pedido.direccion || 'SIN DIRECCIÓN REGISTRADA'}
        </div>
      </div>

      {/* Fechas + Tipo entrega + Total */}
      <div className="grid grid-cols-2 gap-2 mb-2 text-[0.7rem]">
        <div>
          <div className="font-semibold text-slate-600">INGRESO</div>
          <div className="font-bold text-[0.8rem]">
            {pedido.fechaIngreso ? formatFechaDisplay(pedido.fechaIngreso) : '-'}
          </div>
        </div>
        <div>
          <div className="font-semibold text-slate-600">ENTREGA</div>
          <div className="font-bold text-[0.8rem]">
            {pedido.fechaEntrega ? formatFechaDisplay(pedido.fechaEntrega) : '-'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2 text-[0.7rem]">
        <div>
          <div className="font-semibold text-slate-600">TIPO ENTREGA</div>
          <div className="font-bold text-[0.8rem]">
            {tipoEntrega}
          </div>
        </div>
        <div>
          <div className="font-semibold text-slate-600">TOTAL APROX.</div>
          <div className="font-bold text-[0.8rem]">
            {pedido.total != null ? CLP.format(pedido.total) : '-'}
          </div>
        </div>
      </div>

      {/* NOTA */}
      <div className="mt-1 pt-1 border-t border-dashed border-slate-300 text-[0.6rem] leading-snug">
        <div className="font-semibold text-slate-700">
          IMPORTANTE
        </div>
        <p className="text-slate-600">
          Revise su ropa al retirar. No se responde por objetos dejados en los bolsillos.
        </p>
      </div>
    </div>
  );
}
