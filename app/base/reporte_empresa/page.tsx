'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { FileDown } from 'lucide-react';

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
  neto: number;
  iva: number;
  total: number;
};

/* =========================
   Utilidades
========================= */

function formatCLP(v: number) {
  return v.toLocaleString('es-CL');
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const IVA = 0.19;

/* =========================
   Página
========================= */

export default function ReporteEmpresaPage() {
  const [pedidos, setPedidos] = useState<PedidoEmpresa[]>([]);
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

  async function cargarPedidos() {
    setLoading(true);

    const { data } = await supabase
      .from('pedido')
      .select('nro, total, fecha_ingreso, es_empresa, empresa_nombre')
      .eq('es_empresa', true);

    if (data) setPedidos(data);

    setLoading(false);
  }

  useEffect(() => {
    cargarPedidos();
  }, []);

  /* =========================
     Empresas
  ========================= */

  const empresas = useMemo(() => {
    return Array.from(
      new Set(pedidos.map((p) => p.empresa_nombre).filter(Boolean)),
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
        const total = p.total ?? 0;
        const neto = Math.round(total / (1 + IVA));
        const iva = total - neto;

        return {
          fecha: p.fecha_ingreso!
            .slice(0, 10)
            .split('-')
            .reverse()
            .join('-'),
          empresa: p.empresa_nombre || 'SIN EMPRESA',
          numeroServicio: p.nro,
          neto,
          iva,
          total,
        };
      });
  }, [pedidos, empresaSel, desde, hasta]);

  /* =========================
     Totales
  ========================= */

  const totalNeto = filas.reduce((a, b) => a + b.neto, 0);
  const totalIva = filas.reduce((a, b) => a + b.iva, 0);
  const totalGeneral = filas.reduce((a, b) => a + b.total, 0);

  function exportarPDF() {
    window.print();
  }

  /* =========================
     Render
  ========================= */

  return (
    <main className="bg-white text-black p-8 max-w-[1000px] mx-auto">
      {/* HEADER */}
      <header className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold">Resumen de Servicios</h1>
        <p className="text-sm text-gray-600">
          Desde {desde.split('-').reverse().join('-')} hasta{' '}
          {hasta.split('-').reverse().join('-')}
        </p>
      </header>

      {/* CONTROLES */}
      <section className="flex gap-3 mb-6 print:hidden">
        <select
          value={empresaSel}
          onChange={(e) => setEmpresaSel(e.target.value)}
          className="border px-3 py-2 rounded"
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
          className="border px-3 py-2 rounded"
        />

        <input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="border px-3 py-2 rounded"
        />

        <button
          onClick={exportarPDF}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded"
        >
          <FileDown size={16} />
          Generar PDF
        </button>
      </section>

      {/* TABLA */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Fecha</th>
            <th className="text-left py-2">Empresa</th>
            <th className="text-right py-2">N° Servicio</th>
            <th className="text-right py-2">Neto</th>
            <th className="text-right py-2">IVA 19%</th>
            <th className="text-right py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b">
              <td className="py-1">{f.fecha}</td>
              <td className="py-1">{f.empresa}</td>
              <td className="py-1 text-right">{f.numeroServicio}</td>
              <td className="py-1 text-right">${formatCLP(f.neto)}</td>
              <td className="py-1 text-right">${formatCLP(f.iva)}</td>
              <td className="py-1 text-right font-semibold">
                ${formatCLP(f.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* RESUMEN FINAL */}
      <section className="mt-6 flex justify-end">
        <div className="w-64 text-sm space-y-1">
          <div className="flex justify-between">
            <span>Neto</span>
            <span>${formatCLP(totalNeto)}</span>
          </div>
          <div className="flex justify-between">
            <span>IVA 19%</span>
            <span>${formatCLP(totalIva)}</span>
          </div>
          <div className="flex justify-between font-bold border-t pt-1">
            <span>Total</span>
            <span>${formatCLP(totalGeneral)}</span>
          </div>
        </div>
      </section>

      {/* PRINT */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 1.5cm;
          }
        }
      `}</style>
    </main>
  );
}
