'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  FileDown,
  ArrowLeft,
  FileSpreadsheet,
} from 'lucide-react';

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

function formatCLP(v: number) {
  return v.toLocaleString('es-CL');
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatFecha(f: string) {
  return f.split('-').reverse().join('-');
}

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

    if (pedidosData) setPedidos(pedidosData);
    if (lineasData) setLineas(lineasData);

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
          .map((p) => p.empresa_nombre)
          .filter((e): e is string => Boolean(e))
      )
    ).sort();
  }, [pedidos]);

  /* =========================
     Filas reporte
  ========================= */

  const filas: FilaReporte[] = useMemo(() => {
    const dDesde = new Date(desde);
    const dHasta = new Date(hasta);
    dDesde.setHours(0, 0, 0, 0);
    dHasta.setHours(23, 59, 59, 999);

    return pedidos
      .filter((p) => {
        if (!p.fecha_ingreso) return false;
        const f = new Date(p.fecha_ingreso);
        if (f < dDesde || f > dHasta) return false;
        if (empresaSel !== 'TODAS' && p.empresa_nombre !== empresaSel)
          return false;
        return true;
      })
      .map((p) => {
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
  }, [pedidos, empresaSel, desde, hasta]);

  /* =========================
     Resumen financiero
  ========================= */

  const totalNeto = useMemo(
    () => filas.reduce((a, b) => a + b.valorNeto, 0),
    [filas]
  );

  const totalIVA = useMemo(
    () => filas.reduce((a, b) => a + b.iva, 0),
    [filas]
  );

  const totalGeneral = totalNeto + totalIVA;

  /* =========================
     Resumen por producto
  ========================= */

  const resumenProductos = useMemo<ResumenProducto[]>(() => {
    const map = new Map<string, ResumenProducto>();

    lineas.forEach((l) => {
      const actual = map.get(l.articulo) || {
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
  }, [lineas]);

  /* =========================
     Exportar Excel (IMPORT DINÁMICO)
  ========================= */

  async function exportarExcel() {
    const XLSX = await import('xlsx');

    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Empresas');
    XLSX.writeFile(
      wb,
      `reporte_empresas_${desde}_al_${hasta}.xlsx`
    );
  }

  function exportarPDF() {
    window.print();
  }

  /* =========================
     Render
  ========================= */

  return (
    <main className="p-6 bg-white text-black">
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

      {/* CONTROLES */}
      <section className="flex flex-wrap gap-3 mb-6 print:hidden">
        <select
          value={empresaSel}
          onChange={(e) => setEmpresaSel(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="TODAS">Todas las empresas</option>
          {empresas.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="border rounded px-3 py-2"
        />

        <input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="border rounded px-3 py-2"
        />

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

      {/* RESUMEN */}
      <section className="mb-8">
        <h2 className="font-bold text-lg mb-2">Resumen General</h2>
        <p>Total servicios: <b>{filas.length}</b></p>
        <p>Total neto: <b>${formatCLP(totalNeto)}</b></p>
        <p>IVA 19%: <b>${formatCLP(totalIVA)}</b></p>
        <p className="text-lg mt-1">
          Total general: <b>${formatCLP(totalGeneral)}</b>
        </p>
      </section>

      {/* RESUMEN PRODUCTOS */}
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
                <td className="text-right">${formatCLP(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* DETALLE */}
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
                className="border-b cursor-pointer hover:bg-slate-100"
                onClick={() =>
                  router.push(`/servicio?nro=${f.numeroServicio}`)
                }
              >
                <td>{f.fecha}</td>
                <td>{f.empresa}</td>
                <td className="text-right">{f.numeroServicio}</td>
                <td className="text-right">${formatCLP(f.valorNeto)}</td>
                <td className="text-right">${formatCLP(f.iva)}</td>
                <td className="text-right">${formatCLP(f.valorTotal)}</td>
              </tr>
            ))}
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
