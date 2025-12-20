'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, FileDown, FileSpreadsheet } from 'lucide-react';

/* =========================
   Tipos
========================= */

type PedidoEmpresa = {
  nro: number;
  total: number | null;
  fecha_ingreso: string | null;
  empresa_nombre: string | null;
};

type PedidoLinea = {
  pedido_nro: number;
  articulo: string;
  cantidad: number;
  valor: number;
};

type ResumenProducto = {
  articulo: string;
  cantidad: number;
  total: number;
};

/* =========================
   Utils
========================= */

const IVA = 0.19;
const clp = (v: number) => '$' + v.toLocaleString('es-CL');
const toISODate = (d: Date) => d.toISOString().slice(0, 10);
const formatFecha = (f: string) => f.split('-').reverse().join('-');

/* =========================
   Página
========================= */

export default function ReporteEmpresaPage() {
  const router = useRouter();

  const [pedidos, setPedidos] = useState<PedidoEmpresa[]>([]);
  const [lineas, setLineas] = useState<PedidoLinea[]>([]);
  const [empresaSel, setEmpresaSel] = useState('TODAS');

  const [desde, setDesde] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toISODate(d);
  });
  const [hasta, setHasta] = useState(() => toISODate(new Date()));

  /* =========================
     Cargar datos
  ========================= */

  useEffect(() => {
    async function cargar() {
      const { data: p } = await supabase
        .from('pedido')
        .select('nro, total, fecha_ingreso, empresa_nombre')
        .eq('es_empresa', true);

      const { data: l } = await supabase
        .from('pedido_linea')
        .select('pedido_nro, articulo, cantidad, valor');

      setPedidos(p ?? []);
      setLineas(l ?? []);
    }

    cargar();
  }, []);

  /* =========================
     Pedidos filtrados
  ========================= */

  const pedidosFiltrados = useMemo(() => {
    const dDesde = new Date(desde);
    const dHasta = new Date(hasta);
    dDesde.setHours(0, 0, 0, 0);
    dHasta.setHours(23, 59, 59, 999);

    return pedidos.filter(p => {
      if (!p.fecha_ingreso) return false;
      const f = new Date(p.fecha_ingreso);
      if (f < dDesde || f > dHasta) return false;
      if (empresaSel !== 'TODAS' && p.empresa_nombre !== empresaSel) return false;
      return true;
    });
  }, [pedidos, empresaSel, desde, hasta]);

  /* =========================
     Líneas por pedido
  ========================= */

  const lineasPorPedido = useMemo(() => {
    const map = new Map<number, PedidoLinea[]>();
    lineas.forEach(l => {
      if (!map.has(l.pedido_nro)) map.set(l.pedido_nro, []);
      map.get(l.pedido_nro)!.push(l);
    });
    return map;
  }, [lineas]);

  /* =========================
     Resumen financiero
  ========================= */

  const totalNeto = pedidosFiltrados.reduce((a, p) => a + (p.total ?? 0), 0);
  const totalIVA = Math.round(totalNeto * IVA);
  const totalGeneral = totalNeto + totalIVA;

  /* =========================
     Resumen por producto
  ========================= */

  const resumenProductos = useMemo<ResumenProducto[]>(() => {
    const map = new Map<string, ResumenProducto>();
    const pedidosSet = new Set(pedidosFiltrados.map(p => p.nro));

    lineas.forEach(l => {
      if (!pedidosSet.has(l.pedido_nro)) return;

      const r = map.get(l.articulo) ?? {
        articulo: l.articulo,
        cantidad: 0,
        total: 0,
      };

      r.cantidad += l.cantidad;
      r.total += l.cantidad * l.valor;
      map.set(l.articulo, r);
    });

    return Array.from(map.values());
  }, [lineas, pedidosFiltrados]);

  /* =========================
     Render
  ========================= */

  return (
    <main className="p-6 bg-white min-h-screen">
      <header className="flex justify-between mb-6 print:hidden">
        <button onClick={() => router.push('/')} className="flex items-center gap-2">
          <ArrowLeft size={18} /> Volver al menú
        </button>
        <h1 className="text-xl font-bold">Reporte Empresas</h1>
      </header>

      {/* RESUMEN GENERAL */}
      <section className="mb-8">
        <h2 className="font-bold text-lg mb-2">Resumen General</h2>
        <p>Total servicios: <b>{pedidosFiltrados.length}</b></p>
        <p>Total neto: <b>{clp(totalNeto)}</b></p>
        <p>IVA 19%: <b>{clp(totalIVA)}</b></p>
        <p className="text-lg"><b>Total: {clp(totalGeneral)}</b></p>
      </section>

      {/* RESUMEN PRODUCTO */}
      <section className="mb-10">
        <h2 className="font-bold text-lg mb-2">Resumen por producto</h2>
        {resumenProductos.map(r => (
          <div key={r.articulo} className="flex justify-between border-b py-1">
            <span>{r.articulo}</span>
            <span>{r.cantidad}</span>
            <span>{clp(r.total)}</span>
          </div>
        ))}
      </section>

      {/* =========================
          DETALLE REAL POR PEDIDO
      ========================= */}
      <section>
        <h2 className="font-bold text-lg mb-3">Detalle de servicios</h2>

        {pedidosFiltrados.map(p => {
          const iva = Math.round((p.total ?? 0) * IVA);
          return (
            <div key={p.nro} className="mb-6 border rounded-lg p-4">
              <div className="flex justify-between font-semibold mb-2">
                <span>
                  Servicio {p.nro} · {formatFecha(p.fecha_ingreso!.slice(0, 10))}
                </span>
                <span>{clp((p.total ?? 0) + iva)}</span>
              </div>

              <table className="w-full text-sm">
                <tbody>
                  {(lineasPorPedido.get(p.nro) ?? []).map((l, i) => (
                    <tr key={i} className="border-t">
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
            </div>
          );
        })}
      </section>
    </main>
  );
}
