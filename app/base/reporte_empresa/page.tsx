'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft } from 'lucide-react';

/* =========================
   Tipos
========================= */

type Pedido = {
  nro: number;
  total: number | null;
  fecha_ingreso: string | null;
  empresa_nombre: string | null;
};

type PedidoLinea = {
  pedido_nro: number;
  descripcion: string;
  cantidad: number;
  subtotal: number;
};

type ResumenProducto = {
  producto: string;
  cantidad: number;
  total: number;
};

/* =========================
   Utilidades
========================= */

const IVA = 0.19;

const clp = (v: number) =>
  '$' + v.toLocaleString('es-CL');

const fechaCL = (f: string) =>
  f.split('-').reverse().join('-');

/* =========================
   Página
========================= */

export default function ReporteEmpresaPage() {
  const router = useRouter();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [lineas, setLineas] = useState<PedidoLinea[]>([]);
  const [empresaSel, setEmpresaSel] = useState('TODAS');
  const [desde, setDesde] = useState('2025-01-01');
  const [hasta, setHasta] = useState('2025-12-31');
  const [loading, setLoading] = useState(false);

  /* =========================
     Cargar datos
  ========================= */

  async function cargarDatos() {
    setLoading(true);

    const { data: p } = await supabase
      .from('pedido')
      .select('nro, total, fecha_ingreso, empresa_nombre')
      .eq('es_empresa', true);

    const { data: l } = await supabase
      .from('pedido_linea')
      .select('pedido_nro, descripcion, cantidad, subtotal');

    setPedidos(p ?? []);
    setLineas(l ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  /* =========================
     Empresas
  ========================= */

  const empresas = useMemo(() => {
    return Array.from(
      new Set(
        pedidos
          .map(p => p.empresa_nombre)
          .filter((e): e is string => Boolean(e))
      )
    );
  }, [pedidos]);

  /* =========================
     Filtro pedidos
  ========================= */

  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter(p => {
      if (!p.fecha_ingreso) return false;

      const f = new Date(p.fecha_ingreso);
      if (f < new Date(desde) || f > new Date(hasta)) return false;
      if (empresaSel !== 'TODAS' && p.empresa_nombre !== empresaSel)
        return false;

      return true;
    });
  }, [pedidos, empresaSel, desde, hasta]);

  /* =========================
     Resumen financiero
  ========================= */

  const totalNeto = pedidosFiltrados.reduce(
    (a, p) => a + (p.total ?? 0),
    0
  );

  const totalIVA = Math.round(totalNeto * IVA);
  const totalGeneral = totalNeto + totalIVA;

  /* =========================
     Resumen por producto
  ========================= */

  const resumenProductos: ResumenProducto[] = useMemo(() => {
    const map = new Map<string, ResumenProducto>();

    lineas.forEach(l => {
      const pedido = pedidosFiltrados.find(
        p => p.nro === l.pedido_nro
      );
      if (!pedido) return;

      if (!map.has(l.descripcion)) {
        map.set(l.descripcion, {
          producto: l.descripcion,
          cantidad: 0,
          total: 0,
        });
      }

      const r = map.get(l.descripcion)!;
      r.cantidad += l.cantidad;
      r.total += l.subtotal;
    });

    return Array.from(map.values());
  }, [lineas, pedidosFiltrados]);

  /* =========================
     Render
  ========================= */

  return (
    <main className="p-6 bg-white text-black min-h-screen">
      {/* HEADER */}
      <header className="flex justify-between items-center mb-6">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-sm"
        >
          <ArrowLeft size={16} />
          Volver al menú
        </button>
        <h1 className="text-xl font-bold">Reporte Empresas</h1>
      </header>

      {/* FILTROS */}
      <section className="flex gap-3 mb-6">
        <select
          value={empresaSel}
          onChange={e => setEmpresaSel(e.target.value)}
          className="border px-2 py-1"
        >
          <option value="TODAS">Todas las empresas</option>
          {empresas.map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
      </section>

      {/* =========================
          RESUMEN GENERAL
      ========================= */}
      <section className="mb-8">
        <h2 className="font-bold text-lg mb-2">Resumen General</h2>
        <p>Total servicios: <b>{pedidosFiltrados.length}</b></p>
        <p>Total neto: <b>{clp(totalNeto)}</b></p>
        <p>IVA 19%: <b>{clp(totalIVA)}</b></p>
        <p className="text-lg mt-1">
          Total general: <b>{clp(totalGeneral)}</b>
        </p>
      </section>

      {/* =========================
          RESUMEN POR PRODUCTO
      ========================= */}
      <section className="mb-10">
        <h2 className="font-bold text-lg mb-2">Resumen por producto</h2>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1">Producto</th>
              <th className="text-right py-1">Cantidad</th>
              <th className="text-right py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {resumenProductos.map((r, i) => (
              <tr key={i} className="border-b">
                <td>{r.producto}</td>
                <td className="text-right">{r.cantidad}</td>
                <td className="text-right">{clp(r.total)}</td>
              </tr>
            ))}

            {resumenProductos.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-4 text-gray-500">
                  Sin productos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* =========================
          DETALLE DE SERVICIOS
      ========================= */}
      <section>
        <h2 className="font-bold text-lg mb-2">Detalle de servicios</h2>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th>Fecha</th>
              <th>Empresa</th>
              <th>Servicio</th>
              <th className="text-right">Neto</th>
              <th className="text-right">IVA</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {pedidosFiltrados.map(p => {
              const neto = p.total ?? 0;
              const iva = Math.round(neto * IVA);
              const total = neto + iva;

              return (
                <tr key={p.nro} className="border-b">
                  <td>{p.fecha_ingreso ? fechaCL(p.fecha_ingreso.slice(0, 10)) : '-'}</td>
                  <td>{p.empresa_nombre}</td>
                  <td className="text-center">{p.nro}</td>
                  <td className="text-right">{clp(neto)}</td>
                  <td className="text-right">{clp(iva)}</td>
                  <td className="text-right">{clp(total)}</td>
                </tr>
              );
            })}

            {pedidosFiltrados.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-gray-500">
                  Sin datos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
