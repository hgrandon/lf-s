'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'


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

/* =========================
   Utilidad fecha dd-mm-yyyy
   ========================= */
const formatearFecha = (fecha: string) => {
  if (!fecha) return ''
  const [y, m, d] = fecha.split('-')
  return `${d}-${m}-${y}`
}

export default function ReporteEmpresasPage() {
  const router = useRouter()

  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [empresas, setEmpresas] = useState<string[]>([])
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('TODAS')

  /* =========================
     Cargar reporte
     ========================= */
  const cargarReporte = async () => {
    if (!desde || !hasta) return

    setLoading(true)

    const { data, error } = await supabase
      .from('vw_reporte_empresa')
      .select('*')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: true })
      .order('pedido', { ascending: true })

    if (error) {
      console.error(error)
      setData([])
    } else {
      setData(data || [])
    }

    setLoading(false)
  }

  /* =========================
   Cargar listado de empresas
   ========================= */
const cargarEmpresas = async () => {
  const { data, error } = await supabase
    .from('vw_reporte_empresa')
    .select('empresa_nombre')
    .order('empresa_nombre')

  if (!error && data) {
    const unicas = Array.from(
      new Set(data.map(e => e.empresa_nombre))
    )
    setEmpresas(unicas)
  }
}

  /* =========================
     Resumen por pedido
     ========================= */
  const resumenPedido = data.reduce((acc: any, row) => {
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

  /* =========================
     Resumen por empresa
     ========================= */
  const resumenEmpresa = data.reduce((acc: any, row) => {
    const key = row.empresa_nombre
    if (!acc[key]) acc[key] = { neto: 0, iva: 0, total: 0 }
    acc[key].neto += Number(row.neto)
    acc[key].iva += Number(row.iva)
    acc[key].total += Number(row.total)
    return acc
  }, {})

    /* =========================
      Exportar PDF PRO CLIENTE
      ========================= */
    const exportarPDF = async () => {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF('l')

      const COLOR_PRINCIPAL: [number, number, number] = [88, 28, 135] // morado
      const COLOR_HEADER: [number, number, number] = [245, 243, 255]

      /* =========================
        PORTADA / ENCABEZADO
        ========================= */
      doc.setFillColor(...COLOR_PRINCIPAL)
      doc.rect(0, 0, 297, 28, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.text('Reporte Empresas', 14, 18)

      doc.setFontSize(11)
      doc.text(
        `Desde ${formatearFecha(desde)} hasta ${formatearFecha(hasta)}`,
        14,
        25
      )

      doc.setTextColor(0, 0, 0)

      let cursorY = 38

      /* =========================
        TÍTULO RESUMEN POR PEDIDO
        ========================= */
      doc.setFontSize(14)
      doc.setTextColor(...COLOR_PRINCIPAL)
      doc.text('Resumen por Pedido', 14, cursorY)

      cursorY += 6

      const resumenPedidoArr = Object.values(resumenPedido) as any[]

      autoTable(doc, {
        startY: cursorY,
        head: [['Fecha', 'Pedido', 'Empresa', 'Neto', 'IVA', 'Total']],
        body: resumenPedidoArr.map(r => [
          formatearFecha(r.fecha),
          r.pedido,
          r.empresa,
          `$${r.neto.toLocaleString()}`,
          `$${r.iva.toLocaleString()}`,
          `$${r.total.toLocaleString()}`
        ]),
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        headStyles: {
          fillColor: COLOR_PRINCIPAL,
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: COLOR_HEADER
        }
      })

      cursorY = (doc as any).lastAutoTable.finalY + 12

      /* =========================
        TÍTULO RESUMEN POR EMPRESA
        ========================= */
      doc.setFontSize(14)
      doc.setTextColor(...COLOR_PRINCIPAL)
      doc.text('Resumen por Empresa', 14, cursorY)

      cursorY += 6

      const resumenEmpresaArr = Object.entries(resumenEmpresa).map(
        ([empresa, t]: any) => ({
          empresa,
          ...t
        })
      )

      autoTable(doc, {
        startY: cursorY,
        head: [['Empresa', 'Neto', 'IVA', 'Total']],
        body: resumenEmpresaArr.map(r => [
          r.empresa,
          `$${r.neto.toLocaleString()}`,
          `$${r.iva.toLocaleString()}`,
          `$${r.total.toLocaleString()}`
        ]),
        styles: { fontSize: 9 },
        headStyles: {
          fillColor: COLOR_PRINCIPAL,
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: COLOR_HEADER
        }
      })

      /* =========================
        NUEVA PÁGINA – DESGLOSE
        ========================= */
      doc.addPage('l')

      doc.setFillColor(...COLOR_PRINCIPAL)
      doc.rect(0, 0, 297, 24, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.text('Desglose por Pedido', 14, 16)

      doc.setFontSize(10)
      doc.text(
        `Periodo: ${formatearFecha(desde)} al ${formatearFecha(hasta)}`,
        14,
        22
      )

      doc.setTextColor(0, 0, 0)

      autoTable(doc, {
        startY: 32,
        head: [
          [
            'Fecha',
            'Pedido',
            'Empresa',
            'Artículo',
            'Cant.',
            'Neto',
            'IVA',
            'Total'
          ]
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
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        headStyles: {
          fillColor: COLOR_PRINCIPAL,
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: COLOR_HEADER
        }
      })

      doc.save(`reporte_empresas_${desde}_${hasta}.pdf`)
    }


  /* =========================
     Exportar Excel
     ========================= */
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
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Empresas')

    XLSX.writeFile(wb, `reporte_empresas_${desde}_${hasta}.xlsx`)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📊 Reporte Empresas</h1>

        <button
          onClick={() => router.push('/base')}
          className="bg-gray-700 text-white px-4 py-2 rounded"
        >
          ⬅ Volver a base
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={e => setDesde(e.target.value)}
            className="border p-2 rounded"
          />
        </div>

        <div>
          <label className="block text-sm">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={e => setHasta(e.target.value)}
            className="border p-2 rounded"
          />
        </div>

        <button
          onClick={cargarReporte}
          className="bg-purple-600 text-white px-4 py-2 rounded"
        >
          Buscar
        </button>

        {data.length > 0 && (
          <>
            <button
              onClick={exportarPDF}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              PDF
            </button>

            <button
              onClick={exportarExcel}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Excel
            </button>
          </>
        )}
      </div>

      {/* =========================
          Resumen por Pedido
         ========================= */}
      {Object.keys(resumenPedido).length > 0 && (
        <div className="border rounded p-4">
          <h2 className="font-semibold mb-2">Resumen por Pedido</h2>
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">Fecha</th>
                <th className="border p-2">Pedido</th>
                <th className="border p-2">Empresa</th>
                <th className="border p-2">Neto</th>
                <th className="border p-2">IVA</th>
                <th className="border p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(resumenPedido).map((r: any) => (
                <tr key={r.pedido}>
                  <td className="border p-2">{formatearFecha(r.fecha)}</td>
                  <td className="border p-2">{r.pedido}</td>
                  <td className="border p-2">{r.empresa}</td>
                  <td className="border p-2">${r.neto.toLocaleString()}</td>
                  <td className="border p-2">${r.iva.toLocaleString()}</td>
                  <td className="border p-2 font-semibold">
                    ${r.total.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* =========================
          Resumen por Empresa
         ========================= */}
      {Object.keys(resumenEmpresa).length > 0 && (
        <div className="border rounded p-4">
          <h2 className="font-semibold mb-2">Resumen por Empresa</h2>
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">Empresa</th>
                <th className="border p-2">Neto</th>
                <th className="border p-2">IVA</th>
                <th className="border p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(resumenEmpresa).map(([empresa, t]: any) => (
                <tr key={empresa}>
                  <td className="border p-2">{empresa}</td>
                  <td className="border p-2">${t.neto.toLocaleString()}</td>
                  <td className="border p-2">${t.iva.toLocaleString()}</td>
                  <td className="border p-2 font-semibold">
                    ${t.total.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* =========================
          Tabla Detalle
         ========================= */}
      <div className="border rounded overflow-auto">
        {loading ? (
          <p className="p-4">Cargando...</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">Fecha</th>
                <th className="border p-2">Pedido</th>
                <th className="border p-2">Empresa</th>
                <th className="border p-2">Artículo</th>
                <th className="border p-2">Cant.</th>
                <th className="border p-2">Neto</th>
                <th className="border p-2">IVA</th>
                <th className="border p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i}>
                  <td className="border p-2">{formatearFecha(r.fecha)}</td>
                  <td className="border p-2">{r.pedido}</td>
                  <td className="border p-2">{r.empresa_nombre}</td>
                  <td className="border p-2">{r.articulo}</td>
                  <td className="border p-2 text-center">{r.cantidad}</td>
                  <td className="border p-2">${r.neto.toLocaleString()}</td>
                  <td className="border p-2">${r.iva.toLocaleString()}</td>
                  <td className="border p-2 font-semibold">
                    ${r.total.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
