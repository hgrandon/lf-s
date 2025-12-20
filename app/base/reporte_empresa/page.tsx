'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, FileDown, FileSpreadsheet } from 'lucide-react';

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

type PedidoLinea = {
  pedido_nro: number;
  articulo: string;
  cantidad: number;
  valor: number;
};

type FilaReporte = {
  fecha: string;
  empresa: string;
  numeroServicio: number;
  valorNeto: number;
  iva: number;
  valorTotal: number;
};

type ResumenProducto = {
  articulo: string;
  cantidad: number;
  total: number;
};

/* =========================
   Utilidades
========================= */

const IVA = 0.19;
const clp = (v: number) => '$' + v.toLocaleString('es-CL');
const toISODate = (d: Date) => d.toISOString().slice(0, 10);
const formatFecha = (f: string) => f.split('-').reverse().join('-');

/* =========================
   Página
========================= */

export default function ReporteEmpresaPage() {
  const router = useRouter();

  const [pedidos, setPedidos] = useState<PedidoEmpresa[]>([]);
  const [lineas, setLineas] = useState<PedidoLinea[]>([]);
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

  async function cargarDatos() {
    setLoading(true);

    const { data: pedidosData } = await supabase
      .from('pedido')
      .select('nro, total, fecha_ingreso, es_empresa, empresa_nombre')
      .eq('es_empresa', true);

    const { data: lineasData } = await supabase
      .from('pedido_linea')
      .select('pedido_nro, articulo, cantidad, valor');

    setPedidos(pedidosData ?? []);
    setLineas(lineasData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  /* =========================
     Empresas
  ========================= */

  const empresas = useMemo<string[]>(() => {
    return Array.from(
      new Set(
        pedidos
          .map(p => p.empresa_nombre)
          .filter((e): e is string => Boolean(e))
      )
    ).sort();
  }, [pedidos]);

  /* =========================
     Pedidos filtrados
  ========================= */

  const pedidosFiltrados = useMemo(() => {
    const dDesde = new Date(desde);
    const dHasta = new Date(hasta);
    dDesde.setHours(0, 0, 0, 0);
    dHasta.setHours(23, 59, 59, 999);

    return pedidos.filter(p => {
      if (!p.fecha_ingreso) return false;
      const f = new Date(p.fecha_ingreso);
      if (f < dDesde || f > dHasta) return false;
      if (empresaSel !== 'TODAS' && p.empresa_nombre !== empresaSel)
        return false;
      return true;
    });
  }, [pedidos, empresaSel, desde, hasta]);

  /* =========================
     Filas del detalle
  ========================= */

  const filas: FilaReporte[] = useMemo(() => {
    return pedidosFiltrados.map(p => {
      const neto = p.total ?? 0;
      const iva = Math.round(neto * IVA);
      return {
        fecha: formatFecha(p.fecha_ingreso!.slice(0, 10)),
        empresa: p.empresa_nombre || 'SIN EMPRESA',
        numeroServicio: p.nro,
        valorNeto: neto,
        iva,
        valorTotal: neto + iva,
      };
    });
  }, [pedidosFiltrados]);

  /* =========================
     Resumen financiero
  ========================= */

  const totalNeto = filas.reduce((a, b) => a + b.valorNeto, 0);
  const totalIVA = filas.reduce((a, b) => a + b.iva, 0);
  const totalGeneral = totalNeto + totalIVA;

  /* =========================
     Resumen por producto
  ========================= */

  const resumenProductos = useMemo<ResumenProducto[]>(() => {
    const map = new Map<string, ResumenProducto>();
    const pedidosSet = new Set(pedidosFiltrados.map(p => p.nro));

    lineas.forEach(l => {
      if (!pedidosSet.has(l.pedido_nro)) return;

      const actual = map.get(l.articulo) ?? {
        articulo: l.articulo,
        cantidad: 0,
        total: 0,
      };

      actual.cantidad += l.cantidad;
      actual.total += l.cantidad * l.valor;
      map.set(l.articulo, actual);
    });

    return Array.from(map.values()).sort((a, b) =>
      a.articulo.localeCompare(b.articulo)
    );
  }, [lineas, pedidosFiltrados]);

  /* =========================
     DESGLOSE POR PEDIDO (NUEVO)
  ========================= */

  const desglosePorPedido = useMemo(() => {
    const map = new Map<number, {
      pedido: PedidoEmpresa;
      lineas: PedidoLinea[];
      total: number;
    }>();

    pedidosFiltrados.forEach(p => {
      map.set(p.nro, { pedido: p, lineas: [], total: 0 });
    });

    lineas.forEach(l => {
      const entry = map.get(l.pedido_nro);
      if (!entry) return;
      entry.lineas.push(l);
      entry.total += l.cantidad * l.valor;
    });

    return Array.from(map.values());
  }, [pedidosFiltrados, lineas]);

  /* =========================
     Exportar
  ========================= */

  async function exportarExcel() {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Empresas');
    XLSX.writeFile(wb, `reporte_empresas_${desde}_al_${hasta}.xlsx`);
  }

  function exportarPDF() {
    window.print();
  }

  /* =========================
     Render
  ========================= */

  return (
    <main className="p-6 bg-white text-black min-h-screen">
      {/* TODO LO ANTERIOR SE MANTIENE */}

      {/* =========================
          DESGLOSE POR PEDIDO
      ========================= */}
      <section className="mt-16">
        <h2 className="font-bold text-lg mb-6">Desglose por pedido</h2>

        {desglosePorPedido.map(({ pedido, lineas, total }) => (
          <div key={pedido.nro} className="mb-10">
            <p className="font-semibold mb-2">
              Pedido N° {pedido.nro} — {formatFecha(pedido.fecha_ingreso!.slice(0,10))} — {pedido.empresa_nombre}
            </p>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left">Producto</th>
                  <th className="text-right">Cantidad</th>
                  <th className="text-right">Precio unitario</th>
                  <th className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i} className="border-b">
                    <td>{l.articulo}</td>
                    <td className="text-right">{l.cantidad}</td>
                    <td className="text-right">{clp(l.valor)}</td>
                    <td className="text-right">{clp(l.cantidad * l.valor)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} className="text-right font-semibold pt-2">
                    Total pedido
                  </td>
                  <td className="text-right font-semibold pt-2">
                    {clp(total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </main>
  );
}
