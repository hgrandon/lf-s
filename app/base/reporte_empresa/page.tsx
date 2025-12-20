'use client'

import { useEffect, useState } from 'react'
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

type ResumenPedido = {
  pedido: number
  fecha: string
  empresa: string
  neto: number
  iva: number
  total: number
}

type ResumenEmpresa = {
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
     Cargar empresas (una vez)
     ========================= */
  useEffect(() => {
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

    cargarEmpresas()
  }, [])

  /* =========================
     Cargar reporte
     ========================= */
  const cargarReporte = async () => {
    if (!desde || !hasta) return

    setLoading(true)

    let query = supabase
      .from('vw_reporte_empresa')
      .select('*')
      .gte('fecha', desde)
      .lte('fecha', hasta)

    if (empresaSeleccionada !== 'TODAS') {
      query = query.eq('empresa_nombre', empresaSeleccionada)
    }

    const { data, error } = await query
      .order('fecha', { ascending: true })
      .order('pedido', { ascending: true })

    if (error) {
      console.error(error)
      setData([])
    } else {
      setData(data ?? [])
    }

    setLoading(false)
  }

  /* =========================
     Resumen por pedido
     ========================= */
  const resumenPedido = data.reduce<Record<number, ResumenPedido>>(
    (acc, row) => {
      if (!acc[row.pedido]) {
        acc[row.pedido] = {
          pedido: row.pedido,
          fecha: row.fecha,
          empresa: row.empresa_nombre,
          neto: 0,
          iva: 0,
          total: 0
        }
      }

      acc[row.pedido].neto += row.neto
      acc[row.pedido].iva += row.iva
      acc[row.pedido].total += row.total

      return acc
    },
    {}
  )

  /* =========================
     Resumen por empresa
     ========================= */
  const resumenEmpresa = data.reduce<Record<string, ResumenEmpresa>>(
    (acc, row) => {
      if (!acc[row.empresa_nombre]) {
        acc[row.empresa_nombre] = { neto: 0, iva: 0, total: 0 }
      }

      acc[row.empresa_nombre].neto += row.neto
      acc[row.empresa_nombre].iva += row.iva
      acc[row.empresa_nombre].total += row.total

      return acc
    },
    {}
  )

  /* =========================
     Exportar PDF PRO CLIENTE
     ========================= */
  const exportarPDF = async () => {
    const jsPDF = (await import('jspdf')).default
    const autoTable = (await import('jspdf-autotable')).default

    const doc = new jsPDF('l')

    const COLOR_PRINCIPAL: [number, number, number] = [88, 28, 135]
    const COLOR_HEADER: [number, number, number] = [245, 243, 255]

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

    autoTable(doc, {
      startY: 36,
      head: [['Fecha', 'Pedido', 'Empresa', 'Neto', 'IVA', 'Total']],
      body: Object.values(resumenPedido).map(r => [
        formatearFecha(r.fecha),
        r.pedido,
        r.empresa,
        `$${r.neto.toLocaleString()}`,
        `$${r.iva.toLocaleString()}`,
        `$${r.total.toLocaleString()}`
      ]),
      headStyles: { fillColor: COLOR_PRINCIPAL, textColor: 255 },
      alternateRowStyles: { fillColor: COLOR_HEADER },
      styles: { fontSize: 9 }
    })

    doc.addPage('l')

    autoTable(doc, {
      startY: 20,
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
      headStyles: { fillColor: COLOR_PRINCIPAL, textColor: 255 },
      alternateRowStyles: { fillColor: COLOR_HEADER },
      styles: { fontSize: 8 }
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📊 Reporte Empresas</h1>
        <button
          onClick={() => router.push('/base')}
          className="bg-gray-700 text-white px-4 py-2 rounded"
        >
          ⬅ Volver a base
        </button>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />

        <select
          value={empresaSeleccionada}
          onChange={e => setEmpresaSeleccionada(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="TODAS">Todas las empresas</option>
          {empresas.map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        <button
          onClick={cargarReporte}
          className="bg-purple-600 text-white px-4 py-2 rounded"
        >
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
    </div>
  )
}
