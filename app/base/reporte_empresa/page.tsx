'use client'

import { useEffect, useState } from 'react'
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

export default function ReporteEmpresasPage() {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)

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

    if (!error && data) setData(data)
    setLoading(false)
  }

  // 🔢 Resumen por empresa
  const resumen = data.reduce((acc: any, row) => {
    const key = row.empresa_nombre
    if (!acc[key]) acc[key] = { neto: 0, iva: 0, total: 0 }
    acc[key].neto += row.neto
    acc[key].iva += row.iva
    acc[key].total += row.total
    return acc
  }, {})

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">📊 Reporte Empresas</h1>

      {/* Filtros */}
      <div className="flex gap-4 items-end">
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

        <button className="bg-gray-800 text-white px-4 py-2 rounded">
          PDF
        </button>

        <button className="bg-green-600 text-white px-4 py-2 rounded">
          Excel
        </button>
      </div>

      {/* Resumen */}
      {Object.keys(resumen).length > 0 && (
        <div className="border rounded p-4">
          <h2 className="font-semibold mb-2">Resumen por Empresa</h2>
          <table className="w-full text-sm border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">Empresa</th>
                <th className="border p-2">Neto</th>
                <th className="border p-2">IVA</th>
                <th className="border p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(resumen).map(([empresa, t]: any) => (
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

      {/* Tabla Detalle */}
      <div className="border rounded">
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
                  <td className="border p-2">{r.fecha}</td>
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
