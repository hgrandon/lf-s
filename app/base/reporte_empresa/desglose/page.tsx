'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

type Item = {
  articulo: string;
  cantidad: number;
  valor: number;
};

type Pedido = {
  id: number;
  fecha: string;
  empresa: string;
  items: Item[];
};

export default function DesgloseReporteEmpresa() {
  const params = useSearchParams();

  const desde = params.get('desde');
  const hasta = params.get('hasta');
  const empresa = params.get('empresa');

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!desde || !hasta) return;

    (async () => {
      setLoading(true);

      // 1️⃣ pedidos
      let q = supabase
        .from('pedido')
        .select('nro, fecha_ingreso, empresa_nombre')
        .gte('fecha_ingreso', desde)
        .lte('fecha_ingreso', hasta)
        .eq('es_empresa', true)
        .order('nro', { ascending: true });

      if (empresa && empresa !== 'TODAS') {
        q = q.eq('empresa_nombre', empresa);
      }

      const { data: pedidosData } = await q;

      if (!pedidosData?.length) {
        setPedidos([]);
        setLoading(false);
        return;
      }

      const ids = pedidosData.map(p => p.nro);

      // 2️⃣ líneas
      const { data: lineas } = await supabase
        .from('pedido_linea')
        .select('pedido_nro, articulo, cantidad, valor')
        .in('pedido_nro', ids);

      // 3️⃣ unir
      const map = new Map<number, Item[]>();
      (lineas ?? []).forEach(l => {
        const arr = map.get(l.pedido_nro) ?? [];
        arr.push({
          articulo: l.articulo,
          cantidad: l.cantidad,
          valor: l.valor,
        });
        map.set(l.pedido_nro, arr);
      });

      const final: Pedido[] = pedidosData.map(p => ({
        id: p.nro,
        fecha: p.fecha_ingreso,
        empresa: p.empresa_nombre,
        items: map.get(p.nro) ?? [],
      }));

      setPedidos(final);
      setLoading(false);
    })();
  }, [desde, hasta, empresa]);

  return (
    <main className="p-6 bg-white text-black">
      <h1 className="text-xl font-bold mb-4">Desglose por pedido</h1>

      {loading && <p>Cargando…</p>}

      {!loading && pedidos.length === 0 && (
        <p className="text-gray-500">No hay pedidos para el rango seleccionado</p>
      )}

      {pedidos.map(p => {
        const total = p.items.reduce(
          (a, i) => a + i.cantidad * i.valor,
          0
        );

        return (
          <section key={p.id} className="mb-8 border rounded p-4">
            <h2 className="font-bold mb-2">
              Pedido #{p.id} — {p.fecha.slice(0, 10)} — {p.empresa}
            </h2>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left">Artículo</th>
                  <th className="text-right">Cant</th>
                  <th className="text-right">Valor</th>
                  <th className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {p.items.map((i, idx) => (
                  <tr key={idx} className="border-b">
                    <td>{i.articulo}</td>
                    <td className="text-right">{i.cantidad}</td>
                    <td className="text-right">{CLP.format(i.valor)}</td>
                    <td className="text-right">
                      {CLP.format(i.cantidad * i.valor)}
                    </td>
                  </tr>
                ))}

                <tr className="font-bold">
                  <td colSpan={3} className="text-right pt-2">
                    Total pedido
                  </td>
                  <td className="text-right pt-2">
                    {CLP.format(total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}
