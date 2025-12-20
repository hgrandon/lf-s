'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft } from 'lucide-react';

/* =========================
   Tipos
========================= */

type Pedido = {
  nro: number;
  fecha_ingreso: string;
  empresa_nombre: string | null;
  total: number | null;
};

type LineaPedido = {
  pedido_nro: number;
  articulo: string;
  cantidad: number;
  valor: number;
};

/* =========================
   Utils
========================= */

const clp = (v: number) => '$' + v.toLocaleString('es-CL');

const formatFecha = (f: string) =>
  f.slice(0, 10).split('-').reverse().join('-');

/* =========================
   Página
========================= */

export default function DesgloseReporteEmpresaPage() {
  const router = useRouter();
  const params = useSearchParams();

  const desde = params.get('desde');
  const hasta = params.get('hasta');
  const empresa = params.get('empresa');

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [lineas, setLineas] = useState<LineaPedido[]>([]);
  const [loading, setLoading] = useState(true);

  /* =========================
     Cargar datos filtrados
  ========================= */

  useEffect(() => {
    async function cargar() {
      setLoading(true);

      let query = supabase
        .from('pedido')
        .select('nro, fecha_ingreso, empresa_nombre, total')
        .eq('es_empresa', true)
        .gte('fecha_ingreso', desde!)
        .lte('fecha_ingreso', hasta!);

      if (empresa && empresa !== 'TODAS') {
        query = query.eq('empresa_nombre', empresa);
      }

      const { data: pedidosData } = await query;

      const { data: lineasData } = await supabase
        .from('pedido_linea')
        .select('pedido_nro, articulo, cantidad, valor');

      setPedidos(pedidosData ?? []);
      setLineas(lineasData ?? []);
      setLoading(false);
    }

    if (desde && hasta) cargar();
  }, [desde, hasta, empresa]);

  /* =========================
     Lineas por pedido
  ========================= */

  const lineasPorPedido = useMemo(() => {
    const map = new Map<number, LineaPedido[]>();

    lineas.forEach(l => {
      if (!map.has(l.pedido_nro)) {
        map.set(l.pedido_nro, []);
      }
      map.get(l.pedido_nro)!.push(l);
    });

    return map;
  }, [lineas]);

  /* =========================
     Render
  ========================= */

  return (
    <main className="p-6 bg-white text-black min-h-screen">
      {/* HEADER */}
      <header className="flex items-center justify-between mb-6 print:hidden">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <ArrowLeft size={18} />
          Volver
        </button>

        <h1 className="text-xl font-bold">Desglose por pedido</h1>
      </header>

      {loading && <p>Cargando...</p>}

      {!loading && pedidos.length === 0 && (
        <p className="text-gray-500">Sin pedidos para el rango seleccionado</p>
      )}

      {/* =========================
          DESGLOSE
      ========================= */}
      {pedidos.map(pedido => {
        const detalle = lineasPorPedido.get(pedido.nro) ?? [];
        const totalPedido = detalle.reduce(
          (a, b) => a + b.cantidad * b.valor,
          0
        );

        return (
          <section key={pedido.nro} className="mb-10">
            <h2 className="font-bold mb-2">
              Pedido Nº {pedido.nro} — {formatFecha(pedido.fecha_ingreso)} —{' '}
              {pedido.empresa_nombre}
            </h2>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left">Producto</th>
                  <th className="text-right">Cantidad</th>
                  <th className="text-right">Precio unitario</th>
                  <th className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detalle.map((l, i) => (
                  <tr key={i} className="border-b">
                    <td>{l.articulo}</td>
                    <td className="text-right">{l.cantidad}</td>
                    <td className="text-right">{clp(l.valor)}</td>
                    <td className="text-right">
                      {clp(l.cantidad * l.valor)}
                    </td>
                  </tr>
                ))}

                <tr className="font-bold">
                  <td colSpan={3} className="text-right pt-2">
                    Total pedido
                  </td>
                  <td className="text-right pt-2">
                    {clp(totalPedido)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        );
      })}

      <style jsx global>{`
        @media print {
          @page {
            margin: 1cm;
          }
        }
      `}</style>
    </main>
  );
}
