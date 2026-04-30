'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ArrowLeft,
  Calendar,
  Search,
  Building2,
  DollarSign,
  FileText,
  Loader2,
  PackageCheck,
  CheckCircle2,
  Download,
} from 'lucide-react';

type PedidoEmpresa = {
  nro: number;
  empresa_nombre: string | null;
  fecha_ingreso: string | null;
  fecha_entrega: string | null;
  estado: string;
  pagado: boolean;
  total: number;
};

type PedidoLinea = {
  pedido_id: number;
  articulo: string;
  qty: number;
  valor: number;
};

// Utilidad para formatear CLP
const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '-';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}-${m}-${y}`;
}

export default function ReporteEmpresaPage() {
  const router = useRouter();

  // Fechas por defecto: mes actual
  const hoy = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0];

  const [fechaInicio, setFechaInicio] = useState(primerDia);
  const [fechaFin, setFechaFin] = useState(ultimoDia);

  const [loading, setLoading] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoEmpresa[]>([]);
  const [lineas, setLineas] = useState<PedidoLinea[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function buscarReporte() {
    try {
      setLoading(true);
      setError(null);

      if (!fechaInicio || !fechaFin) {
        throw new Error('Debes seleccionar un rango de fechas.');
      }

      // 1. Obtener Pedidos
      const { data, error: err } = await supabase
        .from('pedido')
        .select('nro, empresa_nombre, fecha_ingreso, fecha_entrega, estado, pagado, total')
        .eq('es_empresa', true)
        .gte('fecha_ingreso', fechaInicio)
        .lte('fecha_ingreso', fechaFin)
        .order('nro', { ascending: false });

      if (err) throw err;
      
      const pedidosData = (data as PedidoEmpresa[]) || [];
      const nros = pedidosData.map((p) => p.nro);

      // 2. Obtener Líneas (Desglose)
      let lineasData: PedidoLinea[] = [];
      if (nros.length > 0) {
        const { data: lineasResult, error: errLineas } = await supabase
          .from('pedido_linea')
          .select('pedido_id, articulo, qty, valor')
          .in('pedido_id', nros);

        if (!errLineas && lineasResult) {
          lineasData = lineasResult as PedidoLinea[];
        }
      }

      setPedidos(pedidosData);
      setLineas(lineasData);
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar el reporte.');
    } finally {
      setLoading(false);
    }
  }

  // Cargar por defecto al entrar
  useEffect(() => {
    buscarReporte();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Función para generar PDF (estilo clásico) ---
  function descargarPDF() {
    if (pedidos.length === 0) {
      alert('No hay datos para exportar en este rango de fechas.');
      return;
    }

    // Configurar PDF horizontal para mejor espacio
    const doc = new jsPDF('landscape');
    const purpleHex = '#5b2b82'; // Color institucional del reporte

    // 1. Encabezado
    doc.setFillColor(purpleHex);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 30, 'F');
    doc.setTextColor('#ffffff');
    doc.setFontSize(18);
    doc.text('INFORME DE PEDIDOS', 14, 15);
    doc.setFontSize(11);
    doc.text(`Periodo: ${formatFecha(fechaInicio)} al ${formatFecha(fechaFin)}`, 14, 24);

    let finalY = 40;

    function checkPageBreak(extraSpace: number) {
      if (finalY + extraSpace > doc.internal.pageSize.getHeight() - 15) {
        doc.addPage();
        finalY = 20;
      }
    }

    // 2. Resumen por Pedido
    doc.setTextColor(purpleHex);
    doc.setFontSize(14);
    doc.text('Resumen por Pedido', 14, finalY);
    finalY += 5;

    const pedidosBody = pedidos.map(p => {
      const neto = Number(p.total) || 0;
      const iva = Math.round(neto * 0.19);
      const total = neto + iva;
      return [
        formatFecha(p.fecha_ingreso),
        p.nro.toString(),
        p.empresa_nombre || 'Sin nombre',
        CLP.format(neto),
        CLP.format(iva),
        CLP.format(total)
      ];
    });

    autoTable(doc, {
      startY: finalY,
      head: [['Fecha', 'Pedido', 'Empresa', 'Neto', 'IVA', 'Total']],
      body: pedidosBody,
      headStyles: { fillColor: purpleHex, textColor: '#ffffff' },
      alternateRowStyles: { fillColor: '#f8f4fa' },
    });
    
    finalY = (doc as any).lastAutoTable.finalY + 15;
    checkPageBreak(20);

    // 3. Resumen por Empresa
    const empMap = new Map<string, { neto: number; iva: number; total: number }>();
    pedidos.forEach(p => {
      const emp = p.empresa_nombre || 'Sin nombre';
      const neto = Number(p.total) || 0;
      const iva = Math.round(neto * 0.19);
      const total = neto + iva;
      if (!empMap.has(emp)) empMap.set(emp, { neto: 0, iva: 0, total: 0 });
      const current = empMap.get(emp)!;
      current.neto += neto;
      current.iva += iva;
      current.total += total;
    });

    const empresasBody = Array.from(empMap.entries()).map(([emp, vals]) => [
      emp,
      CLP.format(vals.neto),
      CLP.format(vals.iva),
      CLP.format(vals.total)
    ]);

    doc.setTextColor(purpleHex);
    doc.setFontSize(14);
    doc.text('Resumen por Empresa', 14, finalY);
    finalY += 5;

    autoTable(doc, {
      startY: finalY,
      head: [['Empresa', 'Neto', 'IVA', 'Total']],
      body: empresasBody,
      headStyles: { fillColor: purpleHex, textColor: '#ffffff' },
      alternateRowStyles: { fillColor: '#f8f4fa' },
    });

    finalY = (doc as any).lastAutoTable.finalY + 15;
    checkPageBreak(20);

    // 4. Desglose por Pedido
    doc.setTextColor(purpleHex);
    doc.setFontSize(14);
    doc.text('Desglose por Pedido', 14, finalY);
    finalY += 5;

    const desgloseBody: any[] = [];
    pedidos.forEach(p => {
      const pLineas = lineas.filter(l => l.pedido_id === p.nro);
      pLineas.forEach(l => {
        const neto = (Number(l.qty) || 0) * (Number(l.valor) || 0);
        const iva = Math.round(neto * 0.19);
        const total = neto + iva;
        desgloseBody.push([
          formatFecha(p.fecha_ingreso),
          p.nro.toString(),
          p.empresa_nombre || 'Sin nombre',
          l.articulo,
          l.qty.toString(),
          CLP.format(neto),
          CLP.format(iva),
          CLP.format(total)
        ]);
      });
    });

    autoTable(doc, {
      startY: finalY,
      head: [['Fecha', 'Pedido', 'Empresa', 'Artículo', 'Cant.', 'Neto', 'IVA', 'Total']],
      body: desgloseBody,
      headStyles: { fillColor: purpleHex, textColor: '#ffffff' },
      alternateRowStyles: { fillColor: '#f8f4fa' },
    });

    doc.save(`Informe_Empresas_${fechaInicio}_al_${fechaFin}.pdf`);
  }

  // --- Cálculos del Resumen ---
  const totalPedidos = pedidos.length;
  const totalRecaudado = pedidos.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
  const totalPagados = pedidos.filter(p => p.pagado).length;
  const totalEmpresas = new Set(pedidos.map(p => p.empresa_nombre).filter(Boolean)).size;

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 pb-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* HEADER */}
      <header className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push('/menu')}
          className="inline-flex items-center gap-1 rounded-xl bg-white/10 border border-white/15 px-3 py-1.5 text-xs sm:text-sm hover:bg-white/15 transition"
        >
          <ArrowLeft size={16} />
          MENÚ
        </button>
        <h1 className="font-extrabold text-lg sm:text-2xl tracking-wide flex items-center gap-2">
          <FileText size={24} className="text-fuchsia-300" />
          REPORTE EMPRESAS
        </h1>
        <div className="w-16" />
      </header>

      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 mt-4 space-y-6">
        
        {/* FILTROS DE FECHA Y BOTÓN DESCARGA */}
        <div className="bg-white/10 border border-white/20 rounded-3xl p-5 shadow-lg backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <h2 className="text-sm font-semibold text-fuchsia-200 flex items-center gap-2">
              <Calendar size={18} />
              RANGO DE FECHAS
            </h2>
            
            <button
              onClick={descargarPDF}
              disabled={loading || pedidos.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 shadow-lg disabled:opacity-50 transition"
            >
              <Download size={18} />
              Descargar PDF
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="w-full sm:w-auto flex-1">
              <label className="block text-xs font-medium mb-1 opacity-80">Desde</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400"
              />
            </div>
            <div className="w-full sm:w-auto flex-1">
              <label className="block text-xs font-medium mb-1 opacity-80">Hasta</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400"
              />
            </div>
            <button
              onClick={buscarReporte}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold px-6 py-3 shadow-lg disabled:opacity-60 transition"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
              Filtrar
            </button>
          </div>
          {error && (
            <p className="mt-3 text-xs text-red-300 bg-red-900/40 p-2 rounded-lg border border-red-500/30">
              {error}
            </p>
          )}
        </div>

        {/* RESUMEN NUMÉRICO */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 border border-white/20 rounded-3xl p-5 shadow-lg backdrop-blur-sm flex flex-col items-center text-center">
            <PackageCheck size={28} className="text-emerald-400 mb-2" />
            <span className="text-2xl font-black">{totalPedidos}</span>
            <span className="text-[10px] sm:text-xs uppercase font-semibold opacity-75 mt-1 tracking-wider">
              Pedidos Totales
            </span>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-3xl p-5 shadow-lg backdrop-blur-sm flex flex-col items-center text-center">
            <DollarSign size={28} className="text-yellow-400 mb-2" />
            <span className="text-2xl font-black">{CLP.format(totalRecaudado)}</span>
            <span className="text-[10px] sm:text-xs uppercase font-semibold opacity-75 mt-1 tracking-wider">
              Generado Neto
            </span>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-3xl p-5 shadow-lg backdrop-blur-sm flex flex-col items-center text-center">
            <Building2 size={28} className="text-sky-400 mb-2" />
            <span className="text-2xl font-black">{totalEmpresas}</span>
            <span className="text-[10px] sm:text-xs uppercase font-semibold opacity-75 mt-1 tracking-wider">
              Empresas
            </span>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-3xl p-5 shadow-lg backdrop-blur-sm flex flex-col items-center text-center">
            <CheckCircle2 size={28} className="text-fuchsia-400 mb-2" />
            <span className="text-2xl font-black">{totalPagados}</span>
            <span className="text-[10px] sm:text-xs uppercase font-semibold opacity-75 mt-1 tracking-wider">
              Pagados
            </span>
          </div>
        </div>

        {/* HISTORIAL / DETALLE WEB */}
        <div className="bg-white/10 border border-white/20 rounded-3xl overflow-hidden shadow-lg backdrop-blur-md">
          <div className="px-5 py-4 border-b border-white/10 bg-black/20 flex justify-between items-center">
            <h2 className="font-semibold text-sm">DETALLE DEL PERÍODO</h2>
            <span className="text-xs bg-fuchsia-600/50 text-fuchsia-100 px-3 py-1 rounded-full border border-fuchsia-400/30 font-medium">
              {totalPedidos} registros
            </span>
          </div>
          
          <div className="overflow-x-auto">
            {pedidos.length === 0 ? (
              <div className="p-10 text-center text-sm opacity-60 font-medium">
                No hay pedidos de empresas en el rango seleccionado.
              </div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-wider text-fuchsia-200">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Nro</th>
                    <th className="px-5 py-3 font-semibold">Empresa</th>
                    <th className="px-5 py-3 font-semibold">Fecha Ing.</th>
                    <th className="px-5 py-3 font-semibold">Estado</th>
                    <th className="px-5 py-3 font-semibold">Pago</th>
                    <th className="px-5 py-3 font-semibold text-right">Neto</th>
                    <th className="px-5 py-3 font-semibold text-right">+ IVA (19%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {pedidos.map((p) => {
                    const iva = Math.round((Number(p.total) || 0) * 0.19);
                    const totalConIva = (Number(p.total) || 0) + iva;
                    return (
                      <tr key={p.nro} className="hover:bg-white/5 transition">
                        <td className="px-5 py-3 font-bold text-fuchsia-300">
                          #{p.nro}
                        </td>
                        <td className="px-5 py-3 font-medium">
                          {p.empresa_nombre || 'Sin nombre'}
                        </td>
                        <td className="px-5 py-3 opacity-90">
                          {formatFecha(p.fecha_ingreso)}
                        </td>
                        <td className="px-5 py-3">
                          <span className="bg-white/10 px-2.5 py-1 rounded-lg text-xs font-semibold tracking-wide border border-white/15">
                            {p.estado}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide border ${p.pagado ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'}`}>
                            {p.pagado ? 'PAGADO' : 'PENDIENTE'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-white/90">
                          {CLP.format(p.total)}
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-yellow-300">
                          {CLP.format(totalConIva)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </section>
    </main>
  );
}
