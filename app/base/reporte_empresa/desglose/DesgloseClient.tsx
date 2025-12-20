'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Pedido = {
  nro: number;
  fecha_ingreso: string | null;
  empresa_nombre: string | null;
};

type Linea = {
  pedido_nro: number;
  articulo: string;
  cantidad: number;
  valor: number;
};

const clp = (v: number) => '$' + v.toLocaleString('es-CL');

export default function DesgloseClient() {
  const params = useSearchParams();

  const desde = params.get('desde');
  const hasta = params.get('hasta');
  const empresa = params.get('empresa');

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargar() {
      setLoading(true);

      const { data: pedidosData } = await supabase
        .from('pedido')
        .select('nro, fecha_ingreso, empresa_nombre')
        .eq('es_empresa', true);

      const { data: lineasData } = await supabase
        .from('pedido_linea')
        .select('pedido_nro, articulo, cantidad, valor');

      setPedidos(pedidosData ?? []);
      setLineas(lineasData ?? []);
      setLoading(false);
    }

    cargar();
  }, []);

  const pedidosFiltrados = useMemo(() => {
    if (!desde || !hasta) return [];

    const dDesde = new Date(desde);
    const dHasta = new Date(hasta);
    dDesde.setHours(0, 0, 0, 0);
    dHasta.setHours(23, 59, 59, 999);

    return pedidos.filter(p => {
      if (!p.fecha_ingreso) return false;
      const f = new Date(p.fecha_ingreso);
      if (f < dDesde || f > dHasta) return false;
      if (empresa && empresa !== 'TODAS' && p.empresa_nombre !== empresa)
        return false;
      return true;
    });
  }, [pedidos, desde, hasta, empresa]);

  if (loading) {
    return <p className="p-4 text-gray-500">Cargando datos…</p>;
  }

  return (
    <main className="p-4 bg-white text-black">
      <h2 className="text-lg font-bold mb-4">
        Desglose por pedido
      </h2>

      {pedidosFiltrados.map(p => {
        const lineasPedido = lineas.filter(
          l => l.pedido_nro === p.nro
        );

        const total = lineasPedido.reduce(
          (a, b) => a + b.cantidad * b.valor,
          0
        );

        return (
          <section key={p.nro} className="mb-6 border rounded p-4">
            <div className="flex justify-between mb-2">
              <div>
                <p className="font-semibold">
                  Servicio #{p.nro}
                </p>
                <p className="text-sm text-gray-600">
                  {p.empresa_nombre}
                </p>
              </div>
              <p className="font-bold">{clp(total)}</p>
            </div>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1">Artículo</th>
                  <th className="text-right py-1">Cant.</th>
                  <th className="text-right py-1">Valor</th>
                  <th className="text-right py-1">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineasPedido.map((l, i) => (
                  <tr key={i} className="border-b">
                    <td>{l.articulo}</td>
                    <td className="text-right">{l.cantidad}</td>
                    <td className="text-right">{clp(l.valor)}</td>
                    <td className="text-right">
                      {clp(l.cantidad * l.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      {pedidosFiltrados.length === 0 && (
        <p className="text-gray-500">Sin datos para el período.</p>
      )}
    </main>
  );
}
