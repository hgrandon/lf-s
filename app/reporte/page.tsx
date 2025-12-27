'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Search as SearchIcon, Pencil } from 'lucide-react';

type PedidoDB = {
  nro: number;
  fecha: string;
  tipo_entrega?: string | null;
  estado_pago?: string | null;
  telefono: string;
  total?: number | null;
};

type ClienteDB = {
  telefono: string;
  nombre?: string | null;
  direccion?: string | null;
};

type Fila = PedidoDB & {
  nombre?: string | null;
  direccion?: string | null;
};

/** ✅ Líneas para resumen (SIN CANTIDAD) */
type LineaDB = {
  pedido_nro: number;
  articulo: string;
  neto: number;
  iva: number;
  total: number;
};

type ResumenItem = {
  articulo: string;
  neto: number;
  iva: number;
  total: number;
};

const CLP = new Intl.NumberFormat('es-CL');

function normArticulo(s: string) {
  return (s || '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // quita acentos
}

export default function ReportePage() {
  const router = useRouter();
  const [buscar, setBuscar] = useState('');
  const [filas, setFilas] = useState<Fila[]>([]);
  const [selNro, setSelNro] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  /** ✅ líneas para armar resumen */
  const [lineas, setLineas] = useState<LineaDB[]>([]);

  useEffect(() => {
    (async () => {
      setCargando(true);
      setError(null);
      try {
        const { data: pedidos, error: e1 } = await supabase
          .from('pedido')
          .select('nro, fecha, tipo_entrega, estado_pago, telefono, total')
          .order('nro', { ascending: false })
          .limit(200);
        if (e1) throw e1;

        const tels = Array.from(new Set((pedidos ?? []).map(p => p.telefono))).filter(Boolean);
        const clientesMap = new Map<string, ClienteDB>();
        if (tels.length) {
          const { data: clientes, error: e2 } = await supabase
            .from('clientes')
            .select('telefono, nombre, direccion')
            .in('telefono', tels);
          if (e2) throw e2;
          (clientes ?? []).forEach(c => clientesMap.set(c.telefono, c));
        }

        const out: Fila[] = (pedidos ?? []).map(p => ({
          ...p,
          nombre: clientesMap.get(p.telefono)?.nombre ?? null,
          direccion: clientesMap.get(p.telefono)?.direccion ?? null,
        }));
        setFilas(out);

        /** ✅ Cargar líneas (detalle) para construir el RESUMEN TOTAL
         *  ⚠️ Cambia 'pedido_detalle' si tu tabla se llama distinto.
         */
        const nros = Array.from(new Set((pedidos ?? []).map(p => p.nro))).filter(Boolean);
        if (nros.length) {
          const { data: det, error: e3 } = await supabase
            .from('pedido_detalle') // 👈 AJUSTA SOLO ESTE NOMBRE SI TU TABLA ES OTRA
            .select('pedido_nro, articulo, neto, iva, total')
            .in('pedido_nro', nros);

          if (e3) throw e3;
          setLineas((det ?? []) as LineaDB[]);
        } else {
          setLineas([]);
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Error cargando reporte');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const filtrados = useMemo(() => {
    const q = (buscar || '').trim().toLowerCase();
    if (!q) return filas;
    return filas.filter(p =>
      String(p.nro).includes(q) ||
      (p.telefono || '').includes(q) ||
      (p.nombre || '').toLowerCase().includes(q)
    );
  }, [filas, buscar]);

  /** ✅ RESUMEN TOTAL (SIN CANTIDAD): agrupa por ARTICULO y suma NETO/IVA/TOTAL */
  const resumen = useMemo<ResumenItem[]>(() => {
    const map = new Map<string, ResumenItem>();

    for (const l of lineas) {
      const art = normArticulo(l.articulo || '');
      if (!art) continue;

      const acc = map.get(art) || { articulo: art, neto: 0, iva: 0, total: 0 };
      acc.neto += Number(l.neto || 0);
      acc.iva += Number(l.iva || 0);
      acc.total += Number(l.total || 0);
      map.set(art, acc);
    }

    return Array.from(map.values()).sort((a, b) => a.articulo.localeCompare(b.articulo));
  }, [lineas]);

  const totalResumen = useMemo(() => {
    return resumen.reduce(
      (a, b) => {
        a.neto += b.neto;
        a.iva += b.iva;
        a.total += b.total;
        return a;
      },
      { neto: 0, iva: 0, total: 0 }
    );
  }, [resumen]);

  const abrirDetalle = () => {
    if (!selNro) return;
    router.push(`/pedido/detalle?nro=${selNro}`);
  };

  const abrirEditar = () => {
    if (!selNro) return;
    // si tu editor está en otra ruta, cámbiala aquí
    router.push(`/pedido/nuevo?edit=1&nro=${selNro}`);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-700 via-fuchsia-700 to-indigo-800 p-4">
      <div className="bg-white rounded-xl shadow-xl p-4 max-w-7xl mx-auto">
        {/* Header: flecha + título + LUPA ÚNICA + MODIFICAR */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-full hover:bg-slate-100"
              title="Volver"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
            <h1 className="text-lg font-semibold text-slate-800">REPORTE BASE</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={abrirDetalle}
              disabled={!selNro}
              className="p-2 rounded-full hover:bg-violet-100 disabled:opacity-40"
              title={selNro ? `Ver detalle #${selNro}` : 'Selecciona una fila'}
            >
              <SearchIcon className="w-5 h-5 text-violet-700" />
            </button>
            <button
              onClick={abrirEditar}
              disabled={!selNro}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
              title={selNro ? `Modificar pedido #${selNro}` : 'Selecciona una fila'}
            >
              <Pencil className="w-4 h-4" />
              <span>Modificar</span>
            </button>
          </div>
        </div>

        {/* Buscador */}
        <input
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="BUSCAR N° O NOMBRE"
          className="w-full mb-3 px-3 py-2 border rounded-lg text-sm"
        />

        {cargando && <div className="mb-3 text-sm text-slate-500">Cargando…</div>}
        {error && <div className="mb-3 text-sm text-red-600">Error: {error}</div>}

        {/* Tabla con selección UNA SOLA FILA */}
        <div className="overflow-auto rounded-lg border border-violet-200">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-violet-100 text-violet-800">
              <tr>
                <th className="px-2 py-2 text-left">N°</th>
                <th className="text-left">Total</th>
                <th className="text-left">F. Ent.</th>
                <th className="text-left">Entrega</th>
                <th className="text-left">Pago</th>
                <th className="text-left">Teléfono</th>
                <th className="text-left">Nombre</th>
                <th className="text-left">Dirección</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                    Sin resultados.
                  </td>
                </tr>
              ) : (
                filtrados.map((p) => {
                  const active = selNro === p.nro;
                  return (
                    <tr
                      key={p.nro}
                      onClick={() => setSelNro(p.nro)}
                      className={`border-t cursor-pointer hover:bg-violet-50 ${
                        active ? 'bg-violet-50 ring-2 ring-violet-300' : ''
                      }`}
                    >
                      <td className="px-2 py-2 font-semibold text-violet-700">{p.nro}</td>
                      <td className="px-2 py-2">{CLP.format(p.total || 0)}</td>
                      <td className="px-2 py-2">{p.fecha}</td>
                      <td className="px-2 py-2">{p.tipo_entrega || ''}</td>
                      <td className="px-2 py-2">
                        <span
                          className={`px-2 py-1 rounded-md text-white ${
                            p.estado_pago === 'PAGADO' ? 'bg-green-600' : 'bg-red-500'
                          }`}
                        >
                          {p.estado_pago || 'PENDIENTE'}
                        </span>
                      </td>
                      <td className="px-2 py-2">{p.telefono}</td>
                      <td className="px-2 py-2 font-semibold">{p.nombre || ''}</td>
                      <td className="px-2 py-2">{p.direccion || ''}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ✅ RESUMEN TOTAL (SIN CANTIDAD) */}
        <div className="mt-6 rounded-lg border border-yellow-300 bg-yellow-100 p-3">
          <div className="text-center font-bold text-slate-800 mb-2">RESUMEN TOTAL</div>

          <div className="overflow-auto rounded-lg border border-yellow-300 bg-white">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-yellow-200 text-slate-800">
                <tr>
                  <th className="px-2 py-2 text-left">Artículo</th>
                  <th className="px-2 py-2 text-right">Neto</th>
                  <th className="px-2 py-2 text-right">IVA</th>
                  <th className="px-2 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {resumen.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                      Sin líneas para resumir.
                    </td>
                  </tr>
                ) : (
                  resumen.map((r) => (
                    <tr key={r.articulo} className="border-t">
                      <td className="px-2 py-2 font-semibold">{r.articulo}</td>
                      <td className="px-2 py-2 text-right">{CLP.format(r.neto)}</td>
                      <td className="px-2 py-2 text-right">{CLP.format(r.iva)}</td>
                      <td className="px-2 py-2 text-right font-bold">{CLP.format(r.total)}</td>
                    </tr>
                  ))
                )}

                {resumen.length > 0 && (
                  <tr className="border-t bg-yellow-50">
                    <td className="px-2 py-2 font-bold text-right">TOTAL</td>
                    <td className="px-2 py-2 text-right font-bold">{CLP.format(totalResumen.neto)}</td>
                    <td className="px-2 py-2 text-right font-bold">{CLP.format(totalResumen.iva)}</td>
                    <td className="px-2 py-2 text-right font-bold">{CLP.format(totalResumen.total)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Nota corta por si la tabla detalle no existe */}
          <div className="mt-2 text-xs text-slate-700">
            * El resumen se calcula desde la tabla <b>pedido_detalle</b>. Si tu tabla tiene otro nombre,
            cambia solo ese nombre en el código.
          </div>
        </div>
      </div>
    </main>
  );
}
