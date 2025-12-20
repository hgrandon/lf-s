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
   Contenido real
========================= */

export default function DesgloseContenido() {
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
     Agrupar líneas
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

  if (!desde || !hasta) {
    return <p className="p-6 text-red-600">Faltan fechas para el desglose.</p>;
  }

  return (
    <main className="p-6 bg-white text-black min-h-screen">
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

      {loading && <p>Cargando…</p>}

      {!loading && pedidos.length === 0 && (
        <p className="text-gray-500">Sin pedidos para el rango seleccionado.</p>
      )}

      {pedidos.map(p => {
        const detalle = lineasPorPedido.get(p.nro) ?? [];
        const neto = detalle.reduce((a, b) => a + b.cantidad * b.valor, 0);
        const iva = Math.round(neto * IVA);
        const total = neto + iva;

        return (
          <section key={p.nro} className="mb-10 border rounded p-4">
            <div className="flex justify-between mb-3">
              <div>
                <p className="font-bold">Pedido Nº {p.nro}</p>
                <p className="text-sm text-gray-600">
                  {formatFecha(p.fecha_ingreso)} · {p.empresa_nombre ?? 'SIN EMPRESA'}
                </p>
              </div>
              <div className="text-right font-bold">{clp(total)}</div>
            </div>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left">Producto</th>
                  <th className="text-right">Cantidad</th>
                  <th className="text-right">Precio</th>
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
                  <td colSpan={3} className="text-right">Total</td>
                  <td className="text-right">{clp(total)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}
