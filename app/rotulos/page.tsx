'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Printer, RefreshCw, ArrowLeft, AlertTriangle } from 'lucide-react';

/* ================= TIPOS ================= */

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
  bolsaIndex: number;
  bolsasTotal: number;
};

/* ================= HELPERS ================= */

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

function formatDireccionForRotulo(raw?: string | null): string {
  if (!raw) return 'LAVANDERÍA FABIOLA';
  const upper = raw.toUpperCase().trim();
  if (upper === 'LOCAL') return 'LAVANDERÍA FABIOLA';

  const parts = upper.split(/\s+/);
  const out: string[] = [];
  for (const p of parts) {
    out.push(p);
    if (/\d/.test(p)) break;
  }
  return out.join(' ').slice(0, 40);
}

/* ================= PAGE ================= */

export default function RotulosPage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando rótulos…</div>}>
      <RotulosPageInner />
    </Suspense>
  );
}

function RotulosPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nroParam = searchParams.get('nro');
  const copiesParam = searchParams.get('copies');

  const pedidoFiltrado = nroParam ? Number(nroParam) : null;
  const copies = Math.max(1, Math.min(50, Number(copiesParam) || 1));
  const esModoIndividual = !!pedidoFiltrado;

  const [rotulos, setRotulos] = useState<RotuloConBolsa[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function fetchRotulos() {
    setLoading(true);
    setErr(null);

    try {
      const { data: pedidos, error } = await supabase
        .from('pedido')
        .select(
          'nro, telefono, total, estado, tipo_entrega, fecha_ingreso, fecha_entrega, bolsas'
        )
        .in('estado', ['LAVAR', 'LAVANDO'])
        .order('nro');

      if (error) throw error;
      if (!pedidos?.length) {
        setRotulos([]);
        return;
      }

      const telefonos = Array.from(
        new Set(pedidos.map((p) => p.telefono).filter(Boolean))
      );

      const { data: clientes } = await supabase
        .from('clientes')
        .select('telefono,nombre,direccion')
        .in('telefono', telefonos as string[]);

      const clientesMap = new Map(
        clientes?.map((c) => [c.telefono, c]) || []
      );

      const salida: RotuloConBolsa[] = [];

      pedidos.forEach((p) => {
        const estado = normalizeEstado(p.estado);
        if (!estado) return;

        const cli = clientesMap.get(p.telefono || '');
        const bolsas = Math.max(1, p.bolsas || 1);

        for (let i = 1; i <= bolsas * copies; i++) {
          salida.push({
            pedido: {
              nro: p.nro,
              telefono: p.telefono || '',
              clienteNombre: cli?.nombre?.toUpperCase() || '',
              direccion: cli?.direccion?.toUpperCase() || '',
              total: p.total,
              estado,
              tipoEntrega:
                p.tipo_entrega?.toUpperCase() === 'DOMICILIO'
                  ? 'DOMICILIO'
                  : 'LOCAL',
              fechaIngreso: p.fecha_ingreso,
              fechaEntrega: p.fecha_entrega,
              bolsas,
            },
            bolsaIndex: i,
            bolsasTotal: bolsas * copies,
          });
        }
      });

      setRotulos(salida);
    } catch (e: any) {
      setErr(e.message || 'Error cargando rótulos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRotulos();
  }, []);

  function handlePrint() {
    window.print();
  }

  return (
    <main className="p-4 print:p-0">
      <header className="flex gap-3 mb-4 print:hidden">
        <button onClick={() => router.push('/base')}>
          <ArrowLeft size={16} />
        </button>
        <button onClick={fetchRotulos}>
          <RefreshCw size={16} />
        </button>
        <button onClick={handlePrint}>
          <Printer size={16} />
        </button>
      </header>

      {err && (
        <div className="text-red-600 mb-3 flex gap-2 print:hidden">
          <AlertTriangle size={16} /> {err}
        </div>
      )}

      {/* CONTENIDO IMPRIMIBLE REAL */}
      <section className="flex flex-col items-center gap-2">
        {rotulos.map((r, i) => (
          <RotuloCard key={i} {...r} />
        ))}
      </section>
    </main>
  );
}

/* ================= RÓTULO ================= */

function RotuloCard({ pedido, bolsaIndex, bolsasTotal }: RotuloConBolsa) {
  const direccion = formatDireccionForRotulo(pedido.direccion);
  const frac = bolsasTotal > 1 ? `${bolsaIndex}/${bolsasTotal}` : '';

  return (
    <div
      style={{
        width: '6cm',
        height: '4cm',
        padding: '0.2cm',
      }}
      className="bg-white border border-violet-700 text-violet-700 flex flex-col justify-between"
    >
      <div className="flex justify-between items-center">
        <div>
          <div className="text-[0.7rem] font-bold">
            {pedido.clienteNombre || 'SIN NOMBRE'}
          </div>
          <div className="text-[2.4rem] font-black leading-none">
            {pedido.nro}
          </div>
        </div>
        {frac && <div className="text-[1.4rem] font-black">{frac}</div>}
      </div>

      <div className="flex justify-between text-[0.65rem] font-bold">
        <span>{pedido.total ? CLP.format(pedido.total) : '$0'}</span>
        <span className="text-right flex-1 ml-2">{direccion}</span>
      </div>
    </div>
  );
}
