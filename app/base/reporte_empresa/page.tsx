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

type FilaReporte = {
  fecha: string;
  empresa: string;
  numeroServicio: number;
  valorNeto: number;
  iva: number;
  valorTotal: number;
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

const formatFecha = (f: string) =>
  f.split('-').reverse().join('-');

/* =========================
   Página
========================= */

export default function ReporteEmpresaPage() {
  const router = useRouter();

  const [pedidos, setPedidos] = useState<PedidoEmpresa[]>([]);
  const [lineas, setLineas] = useState<PedidoLinea[]>([]);
  const [loading, setLoading] = useState(false);
  const [verDesglose, setVerDesglose] = useState(false);

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

  const empresas = useMemo<string[]>(() => {
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
      if (empresaSel !== 'TODAS' && p.empresa_nombre !== empresaSel)
        return false;
      return true;
    });
  }, [pedidos, empresaSel, desde, hasta]);

  /* =========================
     Filas del detalle
  ========================= */

  const filas: FilaReporte[] = useMemo(() => {
    return pedidosFiltrados.map(p => {
      const neto = p.total ?? 0;
      const iva = Math.round(neto * IVA);
      return {
        fecha: formatFecha(p.fecha_ingreso!.slice(0, 10)),
        empresa: p.empresa_nombre || 'SIN EMPRESA',
        numeroServicio: p.nro,
        valorNeto: neto,
        iva,
        valorTotal: neto + iva,
      };
    });
  }, [pedidosFiltrados]);

  /* =========================
     Resumen financiero
  ========================= */

  const totalNeto = filas.reduce((a, b) => a + b.valorNeto, 0);
  const totalIVA = filas.reduce((a, b) => a + b.iva, 0);
  const totalGeneral = totalNeto + totalIVA;

  /* =========================
     Resumen por producto (FIX)
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
     Exportar Excel
  ========================= */

  async function exportarExcel() {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Empresas');
    XLSX.writeFile(wb, `reporte_empresas_${desde}_al_${hasta}.xlsx`);
  }

  function exportarPDF() {
    window.print();
  }

  /* =========================
     Render
  ========================= */

  return (
    <main className="p-6 bg-white text-black min-h-screen">
      {/* HEADER */}
      <header className="flex items-center justify-between mb-6 print:hidden">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <ArrowLeft size={18} />
          Volver al menú
        </button>
        <h1 className="text-xl font-bold">Reporte Empresas</h1>
      </header>

      {/* FILTROS */}
      <section className="flex flex-wrap gap-3 mb-6 print:hidden">
        <select
          value={empresaSel}
          onChange={e => setEmpresaSel(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="TODAS">Todas las empresas</option>
          {empresas.map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />

        <button
          onClick={exportarExcel}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded"
        >
          <FileSpreadsheet size={16} />
          Excel
        </button>

        <button
          onClick={exportarPDF}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded"
        >
          <FileDown size={16} />
          PDF
        </button>
      </section>

      {/* =========================
          RESUMEN GENERAL
      ========================= */}
      <section className="mb-8">
        <h2 className="font-bold text-lg mb-2">Resumen General</h2>
        <p>Total servicios: <b>{filas.length}</b></p>
        <p>Total neto: <b>{clp(totalNeto)}</b></p>
        <p>IVA 19%: <b>{clp(totalIVA)}</b></p>
        <p className="text-lg mt-1">
          Total general: <b>{clp(totalGeneral)}</b>
        </p>
      </section>

          {/* BOTÓN DESGLOSE */}
          <div className="mb-8 print:hidden">
            <button
              onClick={() => setVerDesglose(v => !v)}
              className="px-4 py-2 bg-slate-800 text-white rounded text-sm"
            >
              {verDesglose ? 'Ocultar desglose por pedido' : 'Ver desglose por pedido'}
            </button>
          </div>

          {verDesglose && (
              <section className="mb-12 border-t pt-6">
                <iframe
                  src={`/base/reporte_empresa/desglose?desde=${desde}&hasta=${hasta}&empresa=${empresaSel}`}
                  className="w-full h-[900px] border"
                />
              </section>
            )}

      {/* =========================
          RESUMEN POR PRODUCTO
      ========================= */}
      <section className="mb-10">
        <h2 className="font-bold text-lg mb-2">Resumen por producto</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Producto</th>
              <th className="text-right py-2">Cantidad</th>
              <th className="text-right py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {resumenProductos.map((r, i) => (
              <tr key={i} className="border-b">
                <td>{r.articulo}</td>
                <td className="text-right">{r.cantidad}</td>
                <td className="text-right">{clp(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* =========================
          DETALLE DE SERVICIOS
      ========================= */}
      <section>
        <h2 className="font-bold text-lg mb-2">Detalle de servicios</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th>Fecha</th>
              <th>Empresa</th>
              <th className="text-right">Servicio</th>
              <th className="text-right">Neto</th>
              <th className="text-right">IVA</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr
                key={i}
                className="border-b hover:bg-slate-100 cursor-pointer"
                onClick={() =>
                  router.push(`/servicio?nro=${f.numeroServicio}`)
                }
              >
                <td>{f.fecha}</td>
                <td>{f.empresa}</td>
                <td className="text-right">{f.numeroServicio}</td>
                <td className="text-right">{clp(f.valorNeto)}</td>
                <td className="text-right">{clp(f.iva)}</td>
                <td className="text-right">{clp(f.valorTotal)}</td>
              </tr>
            ))}

            {filas.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-gray-500">
                  Sin datos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>


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
