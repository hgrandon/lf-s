'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

type Row = {
  pedido: number;
  fecha: string;
  empresa_nombre: string;
  articulo: string;
  cantidad: number;
  valor_unitario: number;
  neto: number;
  iva: number;
  total: number;
};

export default function ReporteEmpresaPage() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const cargar = async () => {
    if (!desde || !hasta) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('vw_reporte_empresa')
      .select('*')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('empresa_nombre')
      .order('fecha');

    if (error) {
      console.error(error);
      alert('Error cargando reporte');
    } else {
      setData(data || []);
    }

    setLoading(false);
  };

  const totales = data.reduce(
    (acc, r) => {
      acc.neto += r.neto;
      acc.iva += r.iva;
      acc.total += r.total;
      return acc;
    },
    { neto: 0, iva: 0, total: 0 }
  );

  /* ================= PDF ================= */
  const exportarPDF = () => {
    const doc = new jsPDF('l');
    doc.text('Reporte Empresas', 14, 10);
    doc.text(`Desde ${desde} hasta ${hasta}`, 14, 18);

    autoTable(doc, {
      startY: 25,
      head: [[
        'Empresa', 'Pedido', 'Fecha', 'Artículo',
        'Cant', 'Valor', 'Neto', 'IVA', 'Total'
      ]],
      body: data.map(r => [
        r.empresa_nombre,
        r.pedido,
        r.fecha,
        r.articulo,
        r.cantidad,
        r.valor_unitario,
        r.neto,
        r.iva,
        r.total
      ]),
      styles: { fontSize: 8 }
    });

    doc.text(
      `TOTAL NETO: $${totales.neto.toLocaleString()}   IVA: $${totales.iva.toLocaleString()}   TOTAL: $${totales.total.toLocaleString()}`,
      14,
      doc.lastAutoTable.finalY + 10
    );

    doc.save(`reporte_empresas_${desde}_${hasta}.pdf`);
  };

  /* ================= EXCEL ================= */
  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, `reporte_empresas_${desde}_${hasta}.xlsx`);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Reporte Empresas</h1>

      <div className="flex gap-4 items-end">
        <div>
          <label>Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="border px-2 py-1" />
        </div>
        <div>
          <label>Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="border px-2 py-1" />
        </div>

        <button onClick={cargar} className="bg-blue-600 text-white px-4 py-2 rounded">
          Buscar
        </button>

        {data.length > 0 && (
          <>
            <button onClick={exportarPDF} className="bg-red-600 text-white px-4 py-2 rounded">
              PDF
            </button>
            <button onClick={exportarExcel} className="bg-green-600 text-white px-4 py-2 rounded">
              Excel
            </button>
          </>
        )}
      </div>

      {loading && <p>Cargando...</p>}

      {data.length > 0 && (
        <div className="overflow-auto border">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th>Empresa</th>
                <th>Pedido</th>
                <th>Fecha</th>
                <th>Artículo</th>
                <th>Cant</th>
                <th>Valor</th>
                <th>Neto</th>
                <th>IVA</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i}>
                  <td>{r.empresa_nombre}</td>
                  <td>{r.pedido}</td>
                  <td>{r.fecha}</td>
                  <td>{r.articulo}</td>
                  <td className="text-center">{r.cantidad}</td>
                  <td className="text-right">${r.valor_unitario.toLocaleString()}</td>
                  <td className="text-right">${r.neto.toLocaleString()}</td>
                  <td className="text-right">${r.iva.toLocaleString()}</td>
                  <td className="text-right font-bold">${r.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.length > 0 && (
        <div className="text-right font-bold">
          Neto: ${totales.neto.toLocaleString()} | IVA: ${totales.iva.toLocaleString()} | TOTAL: ${totales.total.toLocaleString()}
        </div>
      )}
    </div>
  );
}
