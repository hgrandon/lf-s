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
  es_empresa: boolean | null;
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
   Utilidades
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
  const [loading, setLoading] = useState(false);

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

  async function cargarDatos() {
    setLoading(true);

    const { data: pedidosData } = await supabase
      .from('pedido')
      .select('nro, total, fecha_ingreso, es_empresa, empresa_nombre')
      .eq('es_empresa', true);

    const { data: lineasData } = await supabase
      .from('pedido_linea')
      .select('pedido_nro, articulo, cantidad, valor');

    setPedidos(pedidosData ?? []);
    setLineas(lineasData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  /* =========================
     Empresas
  ========================= */

  const empresas = useMemo(() => {
    return Array.from(
      new Set(
        pedidos
          .map(p => p.empresa_nombre)
          .filter((e): e is string => Boolean(e))
      )
    ).sort();
  }, [pedidos]);

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

      const actual = map.get(l.articulo) ?? {
        articulo: l.articulo,
        cantidad: 0,
        total: 0,
      };

      actual.cantidad += l.cantidad;
      actual.total += l.cantidad * l.valor;
      map.set(l.articulo, actual);
    });

    return Array.from(map.values()).sort((a, b) =>
      a.articulo.localeCompare(b.articulo)
    );
  }, [lineas, pedidosFiltrados]);

  /* =========================
     Detalle por pedido (CLAVE)
  ========================= */

  const detallePorPedido = useMemo(() => {
    return pedidosFiltrados.map(pedido => {
      const detalle = lineas.filter(l => l.pedido_nro === pedido.nro);
      const totalPedido = detalle.reduce(
        (a, l) => a + l.cantidad * l.valor,
        0
      );

      return {
        pedido,
        detalle,
        totalPedido,
      };
    });
  }, [pedidosFiltrados, lineas]);

  /* =========================
     Exportar
  ========================= */

  async function exportarExcel() {
    const XLSX = await import('xlsx');
    const rows = pedidosFiltrados.map(p => ({
      Pedido: p.nro,
      Fecha: p.fecha_ingreso?.slice(0, 10),
      Empresa: p.empresa_nombre,
      Neto: p.total ?? 0,
      IVA: Math.round((p.total ?? 0) * IVA),
      Total: (p.total ?? 0) * (1 + IVA),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, 'reporte_empresas.xlsx');
  }

  function exportarPDF() {
    window.print();
  }

  /* =========================
     Render
  ========================= */

  return (
    <main className="p-6 bg-white text-black">
      <header className="flex justify-between mb-6 print:hidden">
        <button onClick={() => router.push('/')} className="flex gap-2">
          <ArrowLeft /> Volver
        </button>
        <h1 className="text-xl font-bold">Reporte Empresas</h1>
      </header>

      {/* FILTROS */}
      <section className="flex gap-3 mb-6 print:hidden">
        <select value={empresaSel} onChange={e => setEmpresaSel(e.target.value)}>
          <option value="TODAS">Todas</option>
          {empresas.map(e => <option key={e}>{e}</option>)}
        </select>
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
        <button onClick={exportarExcel}><FileSpreadsheet /> Excel</button>
        <button onClick={exportarPDF}><FileDown /> PDF</button>
      </section>

      {/* RESUMEN */}
      <section className="mb-8">
        <h2 className="font-bold">Resumen General</h2>
        <p>Total servicios: <b>{pedidosFiltrados.length}</b></p>
        <p>Total neto: <b>{clp(totalNeto)}</b></p>
        <p>IVA 19%: <b>{clp(totalIVA)}</b></p>
        <p>Total general: <b>{clp(totalGeneral)}</b></p>
      </section>

      {/* DETALLE POR PEDIDO (COMO PDF) */}
      <section>
        <h2 className="font-bold text-lg mb-4">Detalle de servicios</h2>

        {detallePorPedido.map(({ pedido, detalle, totalPedido }) => (
          <div key={pedido.nro} className="mb-6 border-b pb-4">
            <p className="font-semibold">
              N° Pedido {pedido.nro} — {formatFecha(pedido.fecha_ingreso!.slice(0,10))}
            </p>

            <table className="w-full text-sm mt-2">
              <thead>
                <tr className="border-b">
                  <th>Descripción</th>
                  <th className="text-right">Cant.</th>
                  <th className="text-right">Unit.</th>
                  <th className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detalle.map((l, i) => (
                  <tr key={i}>
                    <td>{l.articulo}</td>
                    <td className="text-right">{l.cantidad}</td>
                    <td className="text-right">{clp(l.valor)}</td>
                    <td className="text-right">{clp(l.cantidad * l.valor)}</td>
                  </tr>
                ))}
                <tr className="font-bold border-t">
                  <td colSpan={3} className="text-right">Total</td>
                  <td className="text-right">{clp(totalPedido)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </main>
  );
}
