'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ContenidoDesglose from './contenido';

export default function Page() {
  const params = useSearchParams();

  const desde = params.get('desde');
  const hasta = params.get('hasta');
  const empresa = params.get('empresa');

  const [pedidos, setPedidos] = useState<any[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      let q = supabase
        .from('pedido')
        .select(`
          nro,
          total,
          pedido_linea (
            articulo,
            cantidad,
            valor
          )
        `)
        .gte('fecha', desde)
        .lte('fecha', hasta);

      if (empresa) q = q.eq('empresa_id', empresa);

      const { data } = await q;

      const mapped =
        data?.map((p: any) => ({
          id: p.nro,
          total: p.total,
          items: (p.pedido_linea ?? []).map((i: any) => ({
            articulo: i.articulo,
            qty: i.cantidad,
            valor: i.valor,
          })),
        })) ?? [];

      setPedidos(mapped);
    })();
  }, [desde, hasta, empresa]);

  return (
    <ContenidoDesglose
      pedidos={pedidos}
      openId={openId}
      setOpenId={setOpenId}
    />
  );
}
