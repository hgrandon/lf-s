'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Printer, RefreshCw, ArrowLeft, AlertTriangle } from 'lucide-react';

/* =========================
   TIPOS
========================= */

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
  bolsas: number;
};

type RotuloConBolsa = {
  pedido: PedidoRotulo;
  bolsaIndex: number;
  bolsasTotal: number;
};

/* =========================
   FORMATOS
========================= */

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
  return out.join(' ');
}

/* =========================
   WRAPPER
========================= */

export default function RotulosPage() {
  return (
    <Suspense fallback={<div className="p-4">Cargando rótulos…</div>}>
      <RotulosInner />
    </Suspense>
  );
}

/* =========================
   COMPONENTE PRINCIPAL
========================= */

function RotulosInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nroParam = searchParams.get('nro');
  const copiesParam = searchParams.get('copies');

  const pedidoFiltrado = nroParam ? Number(nroParam) : null;
  const copies = Math.max(1, Number(copiesParam) || 1);
  const modoIndividual = !!pedidoFiltrado;

  const [rotulos, setRotulos] = useState<RotuloConBolsa[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* =========================
     FETCH
  ========================= */

  async function fetchRotulos() {
    setLoading(true);
    setErr(null);

    try {
      let query = supabase
        .from('pedido')
        .select('nro, telefono, total, estado, bolsas')
        .order('nro');

      if (modoIndividual) {
        query = query.eq('nro', pedidoFiltrado);
      } else {
        query = query.in('estado', ['LAVAR', 'LAVANDO']);
      }

      const { data: pedidos, error } = await query;
      if (error) throw error;
      if (!pedidos || pedidos.length === 0) {
        setRotulos([]);
        return;
      }

      const telefonos = Array.from(
        new Set(pedidos.map((p) => p.telefono).filter(Boolean))
      ) as string[];

      const { data: clientes } = await supabase
        .from('clientes')
        .select('telefono, nombre, direccion')
        .in('telefono', telefonos);

      const clientesMap = new Map<string, ClienteDb>();
      clientes?.forEach((c) => clientesMap.set(c.telefono, c as ClienteDb));

      const final: RotuloConBolsa[] = [];

      pedidos.forEach((p) => {
        const cli = p.telefono ? clientesMap.get(p.telefono) : undefined;

        const bolsas = modoIndividual
          ? copies
          : Math.max(1, p.bolsas || 1);

        for (let i = 1; i <= bolsas; i++) {
          final.push({
            pedido: {
              nro: p.nro,
              telefono: p.telefono || '',
              clienteNombre: cli?.nombre?.toUpperCase() || '',
              direccion: cli?.direccion?.toUpperCase() || '',
              total: p.total,
              estado: p.estado as EstadoKey,
              bolsas,
            },
            bolsaIndex: i,
            bolsasTotal: bolsas,
          });
        }
      });

      if (mountedRef.current) setRotulos(final);
    } catch (e: any) {
      setErr(e?.message || 'Error cargando rótulos');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    fetchRotulos();
  }, [nroParam, copiesParam]);

  function handlePrint() {
    window.print();
  }

  /* =========================
     RENDER
  ========================= */

  return (
    <main className="bg-white text-black">
      <div className="p-3 flex gap-3 print:hidden items-center">
        <button onClick={() => router.push('/base')}>
          <ArrowLeft size={16} /> Volver
        </button>
        <button onClick={fetchRotulos}>
          <RefreshCw size={16} /> Actualizar
        </button>
        <button onClick={handlePrint}>
          <Printer size={16} /> Imprimir
        </button>
      </div>

      {err && (
        <div className="p-3 text-red-600 flex gap-2">
          <AlertTriangle size={16} /> {err}
        </div>
      )}

      {loading && <div className="p-3">Cargando…</div>}

      <div className="print-root">
        {rotulos.map((r, i) => (
          <RotuloCard key={i} {...r} />
        ))}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }

          body {
            margin: 0;
          }

          .print-root {
            display: grid;
            grid-template-columns: repeat(3, 8cm);
            grid-auto-rows: 4cm;
            width: 21cm;
          }
        }

        .print-root {
          display: grid;
          grid-template-columns: repeat(3, 8cm);
          grid-auto-rows: 4cm;
        }
      `}</style>
    </main>
  );
}

/* =========================
   TARJETA RÓTULO
========================= */

function RotuloCard({ pedido, bolsaIndex, bolsasTotal }: RotuloConBolsa) {
  const fraccion = bolsasTotal > 1 ? `${bolsaIndex}/${bolsasTotal}` : '';

  return (
    <div
      style={{
        width: '8cm',
        height: '3cm',
        border: '1px solid #6d28d9',
        padding: '0.2cm',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', gap: '0.25cm' }}>
        <img
          src="/logo.png"
          alt="Logo"
          style={{ width: '2.0cm', height: '2.0cm' }}
        />

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#6d28d9',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {pedido.clienteNombre || 'SIN NOMBRE'}
          </div>

          <div
            style={{
              fontSize: '48px',
              fontWeight: 900,
              lineHeight: 1,
              color: '#6d28d9',
            }}
          >
            {pedido.nro}
          </div>
        </div>

        {fraccion && (
          <div
            style={{
              fontSize: '26px',
              fontWeight: 900,
              color: '#6d28d9',
            }}
          >
            {fraccion}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          fontWeight: 700,
          color: '#6d28d9',
        }}
      >
        <span>
          {pedido.total != null ? CLP.format(pedido.total) : '$0'}
        </span>
        <span>{formatDireccionForRotulo(pedido.direccion)}</span>
      </div>
    </div>
  );
}
