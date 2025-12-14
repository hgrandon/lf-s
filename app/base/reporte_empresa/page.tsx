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
  valorNeto: number;
  valorTotal: number;
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

/* =========================
   Página
========================= */

export default function ReporteEmpresaPage() {
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
     Carga datos
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
     Empresas disponibles
  ========================= */

  const empresas = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach((p) => {
      if (p.empresa_nombre) set.add(p.empresa_nombre);
    });
    return Array.from(set).sort();
  }, [pedidos]);

  /* =========================
     Procesar reporte
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
        const fecha = p.fecha_ingreso!.slice(0, 10).split('-').reverse().join('-');
        const total = p.total ?? 0;

        return {
          fecha,
          empresa: p.empresa_nombre || 'SIN EMPRESA',
          numeroServicio: p.nro,
          valorNeto: total,
          valorTotal: total,
        };
      });
  }, [pedidos, empresaSel, desde, hasta]);

  /* =========================
     Totales
  ========================= */

  const totalGeneral = useMemo(
    () => filas.reduce((a, b) => a + b.valorTotal, 0),
    [filas],
  );

  function exportarPDF() {
    window.print();
  }

  /* =========================
     Render
  ========================= */

  return (
    <main className="p-4 bg-white text-black">
      {/* CONTROLES */}
      <section className="flex flex-wrap gap-3 mb-4 print:hidden">
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
      <section className="mb-4">
        <h2 className="font-bold text-lg">Resumen</h2>
        <p className="text-sm">
          Total servicios: <b>{filas.length}</b>
        </p>
        <p className="text-sm">
          Total general: <b>${formatCLP(totalGeneral)}</b>
        </p>
      </section>

      {/* TABLA */}
      <section className="overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Fecha</th>
              <th className="text-left py-2">Empresa</th>
              <th className="text-right py-2">N° Servicio</th>
              <th className="text-right py-2">Valor Neto</th>
              <th className="text-right py-2">Valor Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i} className="border-b">
                <td className="py-1">{f.fecha}</td>
                <td className="py-1">{f.empresa}</td>
                <td className="py-1 text-right">{f.numeroServicio}</td>
                <td className="py-1 text-right">${formatCLP(f.valorNeto)}</td>
                <td className="py-1 text-right">${formatCLP(f.valorTotal)}</td>
              </tr>
            ))}

            {filas.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="text-center py-4 text-gray-500">
                  Sin datos para el rango seleccionado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

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
