'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
  bolsas: number;
};

type RotuloConBolsa = {
  pedido: PedidoRotulo;
  bolsaIndex: number;
  bolsasTotal: number;
};

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

export default function RotulosPage() {
  return (
    <Suspense fallback={<div>Cargando…</div>}>
      <RotulosInner />
    </Suspense>
  );
}

function RotulosInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nroParam = searchParams.get('nro');

  const [rotulos, setRotulos] = useState<RotuloConBolsa[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  async function fetchRotulos() {
    setLoading(true);
    setErr(null);

    try {
      const { data: pedidos, error } = await supabase
        .from('pedido')
        .select('nro, telefono, total, estado, bolsas')
        .in('estado', ['LAVAR', 'LAVANDO'])
        .order('nro');

      if (error) throw error;
      if (!pedidos) return;

      const telefonos = [
        ...new Set(pedidos.map((p) => p.telefono).filter(Boolean)),
      ];

      const { data: clientes } = await supabase
        .from('clientes')
        .select('telefono, nombre, direccion')
        .in('telefono', telefonos);

      const mapClientes = new Map<string, ClienteDb>();
      clientes?.forEach((c) =>
        mapClientes.set(c.telefono, c as ClienteDb)
      );

      const final: RotuloConBolsa[] = [];

      pedidos.forEach((p) => {
        const cli = p.telefono ? mapClientes.get(p.telefono) : null;
        const bolsas = Math.max(1, p.bolsas || 1);

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

      if (mounted.current) setRotulos(final);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRotulos();
  }, [nroParam]);

  function handlePrint() {
    window.print();
  }

  return (
    <main className="bg-white text-black">
      {/* CONTROLES */}
      <div className="p-3 flex gap-2 print:hidden">
        <button onClick={() => router.push('/base')}>
          <ArrowLeft /> Volver
        </button>
        <button onClick={fetchRotulos}>
          <RefreshCw /> Actualizar
        </button>
        <button onClick={handlePrint}>
          <Printer /> Imprimir
        </button>
      </div>

      {err && <div>{err}</div>}
      {loading && <div>Cargando…</div>}

      {/* ROTULOS */}
      <div className="print-root">
        {rotulos.map((r, i) => (
          <RotuloCard key={i} {...r} />
        ))}
      </div>

      {/* CSS IMPRESIÓN */}
      <style jsx global>{`
        @media print {
          @page {
            size: 6cm 4cm;
            margin: 0;
          }
          body {
            margin: 0;
          }
        }

        .print-root {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
      `}</style>
    </main>
  );
}

function RotuloCard({
  pedido,
  bolsaIndex,
  bolsasTotal,
}: RotuloConBolsa) {
  const fraccion =
    bolsasTotal > 1 ? `${bolsaIndex}/${bolsasTotal}` : '';

  return (
    <div
      style={{
        width: '6cm',
        height: '4cm',
        border: '1px solid #6d28d9',
        padding: '0.2cm',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        pageBreakAfter: 'always',
      }}
    >
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2cm' }}>
        <img
          src="/logo.png"
          alt="Logo"
          style={{ width: '1.4cm', height: '1.4cm' }}
        />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: '9px',
              fontWeight: 700,
              color: '#6d28d9',
            }}
          >
            {pedido.clienteNombre || 'SIN NOMBRE'}
          </div>
          <div
            style={{
              fontSize: '32px',
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
              fontSize: '16px',
              fontWeight: 900,
              color: '#6d28d9',
            }}
          >
            {fraccion}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '9px',
          fontWeight: 700,
          color: '#6d28d9',
        }}
      >
        <span>{pedido.total ? CLP.format(pedido.total) : '$0'}</span>
        <span>{formatDireccionForRotulo(pedido.direccion)}</span>
      </div>
    </div>
  );
}
