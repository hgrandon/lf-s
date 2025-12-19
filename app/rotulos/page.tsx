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
  clienteNombre: string;
  direccion: string;
  bolsas: number;
};

type RotuloConBolsa = {
  pedido: PedidoRotulo;
  bolsaIndex: number;
  bolsasTotal: number;
};

/* =========================
   UTIL
========================= */

function formatDireccion(raw?: string | null) {
  if (!raw) return 'LAVANDERÍA FABIOLA';
  return raw.toUpperCase();
}

/* =========================
   PAGE
========================= */

export default function RotulosPage() {
  return (
    <Suspense fallback={<div className="p-4">Cargando…</div>}>
      <RotulosInner />
    </Suspense>
  );
}

function RotulosInner() {
  const router = useRouter();
  const params = useSearchParams();

  const nro = params.get('nro');
  const copies = Math.max(1, Number(params.get('copies')) || 1);

  const [rotulos, setRotulos] = useState<RotuloConBolsa[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  async function fetchRotulos() {
    setLoading(true);
    setErr(null);

    try {
      let query = supabase
        .from('pedido')
        .select('nro, telefono, estado, bolsas')
        .order('nro');

      if (nro) query = query.eq('nro', Number(nro));
      else query = query.in('estado', ['LAVAR', 'LAVANDO']);

      const { data: pedidos, error } = await query;
      if (error) throw error;
      if (!pedidos) return setRotulos([]);

      const tels = pedidos.map(p => p.telefono).filter(Boolean) as string[];

      const { data: clientes } = await supabase
        .from('clientes')
        .select('telefono, nombre, direccion')
        .in('telefono', tels);

      const map = new Map<string, ClienteDb>();
      clientes?.forEach(c => map.set(c.telefono, c));

      const out: RotuloConBolsa[] = [];

      pedidos.forEach(p => {
        const cli = p.telefono ? map.get(p.telefono) : undefined;
        const total = nro ? copies : Math.max(1, p.bolsas || 1);

        for (let i = 1; i <= total; i++) {
          out.push({
            pedido: {
              nro: p.nro,
              clienteNombre: cli?.nombre?.toUpperCase() || '',
              direccion: cli?.direccion || '',
              bolsas: total,
            },
            bolsaIndex: i,
            bolsasTotal: total,
          });
        }
      });

      if (mounted.current) setRotulos(out);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      mounted.current && setLoading(false);
    }
  }

  useEffect(() => {
    fetchRotulos();
  }, [nro, copies]);

  return (
    <main>
      <div className="controls print:hidden">
        <button onClick={() => router.push('/base')}><ArrowLeft size={16}/> Volver</button>
        <button onClick={fetchRotulos}><RefreshCw size={16}/> Actualizar</button>
        <button onClick={() => window.print()}><Printer size={16}/> Imprimir</button>
      </div>

      {err && <div className="error"><AlertTriangle size={16}/> {err}</div>}
      {loading && <div>Cargando…</div>}

      <div className="print-root">
        {rotulos.map((r, i) => <RotuloCard key={i} {...r} />)}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0.5cm;
          }
        }

        .controls {
          padding: 12px;
          display: flex;
          gap: 12px;
        }

        .print-root {
          width: 18cm;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(2, 8.5cm);
          grid-auto-rows: 3.5cm;
          gap: 0.5cm;
        }
      `}</style>
    </main>
  );
}

/* =========================
   RÓTULO
========================= */

function RotuloCard({ pedido, bolsaIndex, bolsasTotal }: RotuloConBolsa) {
  const frac = bolsasTotal > 1 ? `${bolsaIndex}/${bolsasTotal}` : '';

  return (
    <div className="rotulo">
      <div className="top">
        <img src="/logo.png" />
        <div className="data">
          <div className="name">{pedido.clienteNombre || 'SIN NOMBRE'}</div>
          <div className="number">{pedido.nro}</div>
        </div>
        {frac && <div className="frac">{frac}</div>}
      </div>

      <div className="addr">{formatDireccion(pedido.direccion)}</div>

      <style jsx>{`
        .rotulo {
          width: 100%;
          height: 100%;
          border: 1px solid #6d28d9;
          padding: 0.3cm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .top {
          display: flex;
          align-items: center;
          gap: 0.3cm;
        }

        img {
          width: 3.2cm;
          height: 3.2cm;
        }

        .data {
          flex: 1;
        }

        .name {
          font-size: 20px;
          font-weight: 900;
          color: #6d28d9;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .number {
          font-size: 78px;
          font-weight: 900;
          line-height: 0.9;
          color: #6d28d9;
        }

        .frac {
          font-size: 42px;
          font-weight: 900;
          color: #6d28d9;
        }

        .addr {
          text-align: right;
          font-size: 18px;
          font-weight: 800;
          color: #6d28d9;
        }
      `}</style>
    </div>
  );
}
