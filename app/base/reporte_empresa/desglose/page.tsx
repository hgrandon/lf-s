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

const IVA = 0.19;

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
     Cargar datos
  ========================= */

  useEffect(() => {
    if (!desde || !hasta) return;

    async function cargar() {
      setLoading(true);

      let query = supabase
        .from('pedido')
        .select('nro, fecha_ingreso, empresa_nombre')
        .eq('es_empresa', true)
        .gte('fecha_ingreso', desde)
        .lte('fecha_ingreso', hasta)
        .order('fecha_ingreso', { ascending: true });

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

    cargar();
  }, [desde, hasta, empresa]);

  /* =========================
     Lineas agrupadas
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

      {/* VALIDACIÓN */}
      {!desde || !hasta ? (
        <p className="text-red-600">
          Falta rango de fechas para mostrar el desglose.
        </p>
      ) : loading ? (
        <p className="text-gray-500">Cargando desglose…</p>
      ) : pedidos.length === 0 ? (
        <p className="text-gray-500">
          No hay pedidos para el rango seleccionado.
        </p>
      ) : (
        pedidos.map(pedido => {
          const detalle = lineasPorPedido.get(pedido.nro) ?? [];

          const neto = detalle.reduce(
            (a, b) => a + b.cantidad * b.valor,
            0
          );
          const iva = Math.round(neto * IVA);
          const total = neto + iva;

          return (
            <section
              key={pedido.nro}
              className="mb-10 border rounded p-4"
            >
              {/* ENCABEZADO PEDIDO */}
              <div className="flex justify-between mb-3">
                <div>
                  <p className="font-bold">
                    Pedido Nº {pedido.nro}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatFecha(pedido.fecha_ingreso)} ·{' '}
                    {pedido.empresa_nombre ?? 'SIN EMPRESA'}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm">Total</p>
                  <p className="font-bold text-lg">
                    {clp(total)}
                  </p>
                </div>
              </div>

              {/* TABLA DETALLE */}
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1">Producto</th>
                    <th className="text-right py-1">Cantidad</th>
                    <th className="text-right py-1">Precio</th>
                    <th className="text-right py-1">Subtotal</th>
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

                  {/* TOTALES */}
                  <tr className="font-semibold">
                    <td colSpan={3} className="text-right pt-2">
                      Neto
                    </td>
                    <td className="text-right pt-2">
                      {clp(neto)}
                    </td>
                  </tr>
                  <tr className="font-semibold">
                    <td colSpan={3} className="text-right">
                      IVA 19%
                    </td>
                    <td className="text-right">
                      {clp(iva)}
                    </td>
                  </tr>
                  <tr className="font-bold">
                    <td colSpan={3} className="text-right">
                      Total pedido
                    </td>
                    <td className="text-right">
                      {clp(total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          );
        })
      )}

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
