'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { FileDown, ArrowLeft } from 'lucide-react';

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

type FilaReporte = {
  fecha: string;
  empresa: string;
  numeroServicio: number;
  valorNeto: number;
  iva: number;
  valorTotal: number;
};

/* =========================
   Utilidades
========================= */

const IVA_PORCENTAJE = 0.19;

function formatCLP(v: number) {
  return v.toLocaleString('es-CL');
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatFecha(fecha: string) {
  return fecha.split('-').reverse().join('-');
}

/* =========================
   Página
========================= */

export default function ReporteEmpresaPage() {
  const router = useRouter();

  const [pedidos, setPedidos] = useState<PedidoEmpresa[]>([]);
  const [loading, setLoading] = useState(false);

  const [empresaSel, setEmpresaSel] = useState<string>('TODAS');
  const [desde, setDesde] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toISODate(d);
  });
  const [hasta, setHasta] = useState<string>(() => toISODate(new Date()));

  /* =========================
     Cargar pedidos
  ========================= */

  async function cargarPedidos() {
    setLoading(true);

    const { data, error } = await supabase
      .from('pedido')
      .select('nro, total, fecha_ingreso, es_empresa, empresa_nombre')
      .eq('es_empresa', true);

    if (!error && data) {
      setPedidos(data as PedidoEmpresa[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    cargarPedidos();
  }, []);

  /* =========================
     Empresas (fix TS)
  ========================= */

  const empresas = useMemo((): string[] => {
    return Array.from(
      new Set(
        pedidos
          .map((p) => p.empresa_nombre)
          .filter((e): e is string => Boolean(e))
      )
    ).sort();
  }, [pedidos]);

  /* =========================
     Filas del reporte
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
        const iva = Math.round(neto * IVA_PORCENTAJE);
        const total = neto + iva;

        return {
          fecha: formatFecha(p.fecha_ingreso!.slice(0, 10)),
          empresa: p.empresa_nombre || 'SIN EMPRESA',
          numeroServicio: p.nro,
          valorNeto: neto,
          iva,
          valorTotal: total,
        };
      });
  }, [pedidos, empresaSel, desde, hasta]);

  /* =========================
     Totales
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

  function exportarPDF() {
    window.print();
  }

  /* =========================
     Render
  ========================= */

  return (
    <main className="min-h-screen p-6 bg-white text-black">
      {/* HEADER */}
      <header className="flex items-center justify-between mb-6 print:hidden">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-black"
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
          onClick={exportarPDF}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded"
        >
          <FileDown size={16} />
          Generar PDF
        </button>
      </section>

      {/* RESUMEN */}
      <section className="mb-6 text-sm">
        <h2 className="font-bold text-lg mb-2">Resumen</h2>
        <p>Total servicios: <b>{filas.length}</b></p>
        <p>Total neto: <b>${formatCLP(totalNeto)}</b></p>
        <p>IVA 19%: <b>${formatCLP(totalIVA)}</b></p>
        <p className="text-base mt-1">
          Total general: <b>${formatCLP(totalGeneral)}</b>
        </p>
      </section>

      {/* TABLA */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Fecha</th>
            <th className="text-left py-2">Empresa</th>
            <th className="text-right py-2">N° Servicio</th>
            <th className="text-right py-2">Neto</th>
            <th className="text-right py-2">IVA</th>
            <th className="text-right py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b">
              <td className="py-1">{f.fecha}</td>
              <td className="py-1">{f.empresa}</td>
              <td className="py-1 text-right">{f.numeroServicio}</td>
              <td className="py-1 text-right">${formatCLP(f.valorNeto)}</td>
              <td className="py-1 text-right">${formatCLP(f.iva)}</td>
              <td className="py-1 text-right">${formatCLP(f.valorTotal)}</td>
            </tr>
          ))}

          {filas.length === 0 && !loading && (
            <tr>
              <td colSpan={6} className="text-center py-6 text-gray-500">
                Sin datos para el rango seleccionado
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* PRINT */}
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
