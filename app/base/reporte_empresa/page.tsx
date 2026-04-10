'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/* ======================================================
   TIPOS
   ====================================================== */
type Row = {
  pedido: number
  fecha: string
  empresa_nombre: string
  articulo: string
  cantidad: number
  neto: number
  iva: number
  total: number
}

/* ======================================================
   UTILIDAD FECHA dd-mm-yyyy
   ====================================================== */
const formatearFecha = (fecha: string) => {
  if (!fecha) return ''
  const [y, m, d] = fecha.split('-')
  return `${d}-${m}-${y}`
}

/* ======================================================
   COLORES CORPORATIVOS
   ====================================================== */
const COLOR_PRINCIPAL = 'bg-purple-800'
const COLOR_PRINCIPAL_TEXTO = 'text-purple-800'
const COLOR_HEADER_TABLA = 'bg-purple-700 text-white'

/* ======================================================
   COMPONENTE PRINCIPAL
   ====================================================== */
export default function ReporteEmpresasPage() {
  const router = useRouter()

  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)

  /* ======================================================
     CARGAR REPORTE
     ====================================================== */
  const cargarReporte = async () => {
    if (!desde || !hasta) return;

    setLoading(true);

    try {
      // 1. Fetch pedidos en el rango
      const { data: pedidos, error: errPedidos } = await supabase
        .from('pedido')
        .select('nro, fecha, empresa_nombre, es_empresa')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha', { ascending: true })
        .order('nro', { ascending: true });

      if (errPedidos) throw errPedidos;

      if (!pedidos || pedidos.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // Tomamos solo los que tienen es_empresa o un nombre de empresa
      const pedidosEmpresa = pedidos.filter(p => p.es_empresa || p.empresa_nombre);
      const nros = pedidosEmpresa.map(p => p.nro);

      if (nros.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // 2. Fetch de líneas para esos pedidos
      const { data: lineas, error: errLineas } = await supabase
        .from('pedido_linea')
        .select('pedido_nro, articulo, qty, valor')
        .in('pedido_nro', nros);

      if (errLineas) throw errLineas;

      // 3. Procesar y combinar (con IVA del 19%)
      const results: Row[] = [];
      const IVA_RATE = 0.19;

      const lineasArr = lineas || [];

      pedidosEmpresa.forEach(p => {
        const lineasPedido = lineasArr.filter(l => l.pedido_nro === p.nro);
        
        lineasPedido.forEach(l => {
          const qty = Number(l.qty || 0);
          const valor = Number(l.valor || 0);
          const neto = Math.round(qty * valor);
          const iva = Math.round(neto * IVA_RATE);
          const total = neto + iva;

          results.push({
            pedido: p.nro,
            fecha: p.fecha || '',
            empresa_nombre: (p.empresa_nombre && p.empresa_nombre.trim() !== '') ? p.empresa_nombre : 'SIN EMPRESA',
            articulo: l.articulo || '',
            cantidad: qty,
            neto: neto,
            iva: iva,
            total: total
          });
        });
      });

      setData(results);
    } catch (err: any) {
      console.error("Error cargando reporte:", err);
      alert("Hubo un problema al cargar el reporte: " + err.message);
      setData([]);
    }

    setLoading(false);
  }

  /* ======================================================
     RESUMEN POR PEDIDO
     ====================================================== */
  const resumenPedido = useMemo(() => {
    return data.reduce((acc: any, row) => {
      const key = row.pedido
      if (!acc[key]) {
        acc[key] = {
          pedido: row.pedido,
          fecha: row.fecha,
          empresa: row.empresa_nombre,
          neto: 0,
          iva: 0,
          total: 0
        }
      }
      acc[key].neto += Number(row.neto)
      acc[key].iva += Number(row.iva)
      acc[key].total += Number(row.total)
      return acc
    }, {})
  }, [data])

  /* ======================================================
     RESUMEN POR EMPRESA
     ====================================================== */
  const resumenEmpresa = useMemo(() => {
    return data.reduce((acc: any, row) => {
      const key = row.empresa_nombre
      if (!acc[key]) acc[key] = { neto: 0, iva: 0, total: 0 }
      acc[key].neto += Number(row.neto)
      acc[key].iva += Number(row.iva)
      acc[key].total += Number(row.total)
      return acc
    }, {})
  }, [data])

  /* ======================================================
     EXPORTAR PDF – NIVEL CLIENTE
     ====================================================== */
  const exportarPDF = async () => {
    const jsPDF = (await import('jspdf')).default
    const autoTable = (await import('jspdf-autotable')).default

    const doc = new jsPDF('l')

    const MORADO: [number, number, number] = [88, 28, 135]
    const CLARO: [number, number, number] = [245, 243, 255]

    /* ---------- PORTADA ---------- */
    doc.setFillColor(...MORADO)
    doc.rect(0, 0, 297, 30, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.text('INFORME DE PEDIDOS', 14, 20)

    doc.setFontSize(11)
    doc.text(
      `Periodo: ${formatearFecha(desde)} al ${formatearFecha(hasta)}`,
      14,
      27
    )

    let cursorY = 40

    /* ---------- RESUMEN POR PEDIDO ---------- */
    doc.setTextColor(...MORADO)
    doc.setFontSize(15)
    doc.text('Resumen por Pedido', 14, cursorY)
    cursorY += 6

    autoTable(doc, {
      startY: cursorY,
      head: [['Fecha', 'Pedido', 'Empresa', 'Neto', 'IVA', 'Total']],
      body: Object.values(resumenPedido).map((r: any) => [
        formatearFecha(r.fecha),
        r.pedido,
        r.empresa,
        `$${r.neto.toLocaleString()}`,
        `$${r.iva.toLocaleString()}`,
        `$${r.total.toLocaleString()}`
      ]),
      headStyles: { fillColor: MORADO, textColor: 255 },
      alternateRowStyles: { fillColor: CLARO },
      styles: { fontSize: 9 }
    })

    cursorY = (doc as any).lastAutoTable.finalY + 12

    /* ---------- RESUMEN POR EMPRESA ---------- */
    doc.text('Resumen por Empresa', 14, cursorY)
    cursorY += 6

    autoTable(doc, {
      startY: cursorY,
      head: [['Empresa', 'Neto', 'IVA', 'Total']],
      body: Object.entries(resumenEmpresa).map(([empresa, t]: any) => [
        empresa,
        `$${t.neto.toLocaleString()}`,
        `$${t.iva.toLocaleString()}`,
        `$${t.total.toLocaleString()}`
      ]),
      headStyles: { fillColor: MORADO, textColor: 255 },
      alternateRowStyles: { fillColor: CLARO },
      styles: { fontSize: 9 }
    })

    /* ---------- DESGLOSE ---------- */
    doc.addPage('l')

    doc.setFillColor(...MORADO)
    doc.rect(0, 0, 297, 26, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.text('Desglose por Pedido', 14, 18)

    autoTable(doc, {
      startY: 32,
      head: [
        ['Fecha', 'Pedido', 'Empresa', 'Artículo', 'Cant.', 'Neto', 'IVA', 'Total']
      ],
      body: data.map(r => [
        formatearFecha(r.fecha),
        r.pedido,
        r.empresa_nombre,
        r.articulo,
        r.cantidad,
        `$${r.neto.toLocaleString()}`,
        `$${r.iva.toLocaleString()}`,
        `$${r.total.toLocaleString()}`
      ]),
      headStyles: { fillColor: MORADO, textColor: 255 },
      alternateRowStyles: { fillColor: CLARO },
      styles: { fontSize: 8 }
    })

    doc.save(`reporte_empresas_${desde}_${hasta}.pdf`)
  }

  /* ======================================================
     EXPORTAR EXCEL
     ====================================================== */
  const exportarExcel = async () => {
    const XLSX = await import('xlsx')

    const ws = XLSX.utils.json_to_sheet(
      data.map(r => ({
        Fecha: formatearFecha(r.fecha),
        Pedido: r.pedido,
        Empresa: r.empresa_nombre,
        Artículo: r.articulo,
        Cantidad: r.cantidad,
        Neto: r.neto,
        IVA: r.iva,
        Total: r.total
      }))
    )

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte')

    XLSX.writeFile(wb, `reporte_empresas_${desde}_${hasta}.xlsx`)
  }

  /* ======================================================
     RENDER
     ====================================================== */
  return (
    <div className="p-6 space-y-10">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">📊 Reporte Empresas</h1>
        <button
          onClick={() => router.push('/base')}
          className="bg-gray-700 text-white px-4 py-2 rounded"
        >
          ⬅ Volver
        </button>
      </div>

      {/* FILTROS */}
      <div className="flex gap-4 items-end">
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="border p-2 rounded" />
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="border p-2 rounded" />

        <button onClick={cargarReporte} className="bg-purple-700 text-white px-4 py-2 rounded">
          Buscar
        </button>

        {data.length > 0 && (
          <>
            <button onClick={exportarPDF} className="bg-red-600 text-white px-4 py-2 rounded">PDF</button>
            <button onClick={exportarExcel} className="bg-green-600 text-white px-4 py-2 rounded">Excel</button>
          </>
        )}
      </div>

      {/* ================= RESUMEN POR PEDIDO ================= */}
      {Object.keys(resumenPedido).length > 0 && (
        <section>
          <div className={`p-3 ${COLOR_PRINCIPAL} text-white rounded-t`}>
            <h2 className="text-xl font-semibold">📌 Resumen por Pedido</h2>
          </div>
          <table className="w-full text-sm border">
            <thead className={COLOR_HEADER_TABLA}>
              <tr>
                <th className="p-2">Fecha</th>
                <th className="p-2">Pedido</th>
                <th className="p-2">Empresa</th>
                <th className="p-2">Neto</th>
                <th className="p-2">IVA</th>
                <th className="p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(resumenPedido).map((r: any) => (
                <tr key={r.pedido} className="border-t">
                  <td className="p-2">{formatearFecha(r.fecha)}</td>
                  <td className="p-2">{r.pedido}</td>
                  <td className="p-2">{r.empresa}</td>
                  <td className="p-2">${r.neto.toLocaleString()}</td>
                  <td className="p-2">${r.iva.toLocaleString()}</td>
                  <td className="p-2 font-bold">${r.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
