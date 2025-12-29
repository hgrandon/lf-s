'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Search as SearchIcon, Pencil } from 'lucide-react';

type PedidoDB = {
  nro: number;
  fecha: string;
  telefono: string;
  total?: number | null;
  tipo_entrega?: string | null;
  estado_pago?: string | null;
  empresa_nombre?: string | null;
  es_empresa?: boolean | null;
};

type ClienteDB = {
  telefono: string;
  nombre?: string | null;
  direccion?: string | null;
};

type LineaDB = {
  pedido_nro: number;
  articulo: string;
  qty: number;
  valor: number;
};

type FilaPedido = PedidoDB & {
  nombre?: string | null;
  direccion?: string | null;
  empresa?: string | null;
  neto: number;
  iva: number;
  total_calc: number;
};

type FilaDesglose = {
  fecha: string;
  pedido_nro: number;
  empresa: string;
  articulo: string;
  articulo_resumen: string;
  qty: number;
  neto: number;
  iva: number;
  total: number;
};

const CLP = new Intl.NumberFormat('es-CL');
const IVA_RATE = 0.19;

function splitIVA(totalFinal: number) {
  const neto = Math.round(totalFinal / (1 + IVA_RATE));
  const iva = totalFinal - neto;
  return { neto, iva, total: totalFinal };
}

function addIVA(neto: number) {
  const iva = Math.round(neto * IVA_RATE);
  return { neto, iva, total: neto + iva };
}

function norm(s: string) {
  return (s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// ✅ aquí “resumimos” artículos como tu ejemplo
function resumirArticulo(art: string) {
  const a = norm(art);

  if (a.includes('RETIRO') || a.includes('ENTREGA')) return 'RETIRO Y ENTREGA';
  if (a.includes('SABAN')) return 'SÁBANAS';
  if (a.includes('TOALL')) return 'TOALLAS';
  if (a.includes('COBERTOR')) return 'COBERTOR';
  if (a.includes('FRAZAD')) return 'FRAZADAS';
  if (a.includes('INDIVIDUAL')) return 'INDIVIDUALES';
  if (a.includes('FUNDA') && a.includes('COJ')) return 'FUNDAS COJIN';
  if (a.includes('PAÑO') || a.includes('PANO') || a.includes('COCINA')) return 'PAÑOS DE COCINA';

  // si no calza, lo dejamos tal cual pero bonito
  return (art || '').toUpperCase().trim();
}

export default function ReporteEmpresasPage() {
  const router = useRouter();
  const [buscar, setBuscar] = useState('');
  const [pedidos, setPedidos] = useState<FilaPedido[]>([]);
  const [desglose, setDesglose] = useState<FilaDesglose[]>([]);
  const [selNro, setSelNro] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    (async () => {
      setCargando(true);
      setError(null);
      try {
        const { data: pedidosRaw, error: e1 } = await supabase
          .from('pedido')
          .select('nro, fecha, tipo_entrega, estado_pago, telefono, total, empresa_nombre, es_empresa')
          .order('nro', { ascending: false })
          .limit(500);

        if (e1) throw e1;

        const pedidosList = (pedidosRaw ?? []) as PedidoDB[];

        const tels = Array.from(new Set(pedidosList.map(p => p.telefono))).filter(Boolean);
        const clientesMap = new Map<string, ClienteDB>();

        if (tels.length) {
          const { data: clientes, error: e2 } = await supabase
            .from('clientes')
            .select('telefono, nombre, direccion')
            .in('telefono', tels);

          if (e2) throw e2;
          (clientes ?? []).forEach(c => clientesMap.set(c.telefono, c as ClienteDB));
        }

        const outPedidos: FilaPedido[] = pedidosList.map(p => {
          const totalFinal = Number(p.total || 0);
          const { neto, iva, total } = splitIVA(totalFinal);
          const cli = clientesMap.get(p.telefono);

          const empresa =
            (p.empresa_nombre && p.empresa_nombre.trim()) ||
            (p.es_empresa ? 'EMPRESA' : null);

          return {
            ...p,
            nombre: cli?.nombre ?? null,
            direccion: cli?.direccion ?? null,
            empresa: empresa ?? null,
            neto,
            iva,
            total_calc: total,
          };
        });

        setPedidos(outPedidos);

        const nros = outPedidos.map(p => p.nro);
        if (nros.length) {
          const { data: lineasRaw, error: e3 } = await supabase
            .from('pedido_linea')
            .select('pedido_nro, articulo, qty, valor')
            .in('pedido_nro', nros);

          if (!e3) {
            const lineas = (lineasRaw ?? []) as LineaDB[];
            const pedidoMap = new Map<number, FilaPedido>();
            outPedidos.forEach(p => pedidoMap.set(p.nro, p));

            const outDesglose: FilaDesglose[] = lineas.map(l => {
              const p = pedidoMap.get(l.pedido_nro);
              const netoLinea = Math.round(Number(l.qty || 0) * Number(l.valor || 0));
              const { neto, iva, total } = addIVA(netoLinea);

              return {
                fecha: p?.fecha || '',
                pedido_nro: l.pedido_nro,
                empresa: (p?.empresa || 'SIN EMPRESA') as string,
                articulo: (l.articulo || '').toString(),
                articulo_resumen: resumirArticulo((l.articulo || '').toString()),
                qty: Number(l.qty || 0),
                neto,
                iva,
                total,
              };
            });

            setDesglose(outDesglose);
          } else {
            setDesglose([]);
          }
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Error cargando reporte');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const pedidosFiltrados = useMemo(() => {
    const q = (buscar || '').trim().toLowerCase();
    if (!q) return pedidos;
    return pedidos.filter(p =>
      String(p.nro).includes(q) ||
      (p.telefono || '').includes(q) ||
      (p.nombre || '').toLowerCase().includes(q) ||
      (p.empresa || '').toLowerCase().includes(q)
    );
  }, [pedidos, buscar]);

  const desgloseFiltrado = useMemo(() => {
    const q = (buscar || '').trim().toLowerCase();
    if (!q) return desglose;
    return desglose.filter(d =>
      String(d.pedido_nro).includes(q) ||
      (d.articulo || '').toLowerCase().includes(q) ||
      (d.articulo_resumen || '').toLowerCase().includes(q) ||
      (d.empresa || '').toLowerCase().includes(q)
    );
  }, [desglose, buscar]);

  const resumenEmpresa = useMemo(() => {
    const map = new Map<string, { empresa: string; neto: number; iva: number; total: number }>();
    for (const p of pedidosFiltrados) {
      const key = (p.empresa || 'SIN EMPRESA').toString();
      const cur = map.get(key) || { empresa: key, neto: 0, iva: 0, total: 0 };
      cur.neto += p.neto || 0;
      cur.iva += p.iva || 0;
      cur.total += p.total_calc || 0;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [pedidosFiltrados]);

  const totalEmpresa = useMemo(() => {
    return resumenEmpresa.reduce(
      (acc, r) => {
        acc.neto += r.neto;
        acc.iva += r.iva;
        acc.total += r.total;
        return acc;
      },
      { neto: 0, iva: 0, total: 0 }
    );
  }, [resumenEmpresa]);

  // ✅ NUEVO: resumen de artículos (como tu ejemplo)
  const resumenArticulos = useMemo(() => {
    const map = new Map<string, { articulo: string; qty: number; neto: number; iva: number; total: number }>();

    for (const d of desgloseFiltrado) {
      const key = d.articulo_resumen || 'OTROS';
      const cur = map.get(key) || { articulo: key, qty: 0, neto: 0, iva: 0, total: 0 };
      cur.qty += d.qty || 0;
      cur.neto += d.neto || 0;
      cur.iva += d.iva || 0;
      cur.total += d.total || 0;
      map.set(key, cur);
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [desgloseFiltrado]);

  const abrirDetalle = () => {
    if (!selNro) return;
    router.push(`/pedido/detalle?nro=${selNro}`);
  };

  const abrirEditar = () => {
    if (!selNro) return;
    router.push(`/pedido/nuevo?edit=1&nro=${selNro}`);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-700 via-fuchsia-700 to-indigo-800 p-4">
      <div className="bg-white rounded-xl shadow-xl p-4 max-w-7xl mx-auto">
        {/* Header */}
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
            <div>
              <div className="text-lg font-semibold text-slate-800">REPORTE EMPRESAS</div>
              <div className="text-xs text-slate-500">Resumen por Pedido / Empresa / Desglose / Artículos</div>
            </div>
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
          placeholder="BUSCAR N° / TELÉFONO / NOMBRE / EMPRESA / ARTÍCULO"
          className="w-full mb-3 px-3 py-2 border rounded-lg text-sm"
        />

        {cargando && <div className="mb-3 text-sm text-slate-500">Cargando…</div>}
        {error && <div className="mb-3 text-sm text-red-600">Error: {error}</div>}

        {/* ===== 1) Resumen por Pedido ===== */}
        <div className="mb-4">
          <div className="font-semibold text-slate-800 mb-2">1) Resumen por Pedido</div>
          <div className="overflow-auto rounded-lg border border-violet-200">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-violet-100 text-violet-800">
                <tr>
                  <th className="px-2 py-2 text-left">Fecha</th>
                  <th className="px-2 py-2 text-left">Pedido</th>
                  <th className="px-2 py-2 text-left">Empresa</th>
                  <th className="px-2 py-2 text-right">Neto</th>
                  <th className="px-2 py-2 text-right">IVA</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="px-2 py-2 text-left">Pago</th>
                </tr>
              </thead>
              <tbody>
                {pedidosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-slate-500">Sin resultados.</td>
                  </tr>
                ) : (
                  pedidosFiltrados.map((p) => {
                    const active = selNro === p.nro;
                    const pagado = (p.estado_pago || 'PENDIENTE').toUpperCase() === 'PAGADO';
                    return (
                      <tr
                        key={p.nro}
                        onClick={() => setSelNro(p.nro)}
                        className={`border-t cursor-pointer hover:bg-violet-50 ${
                          active ? 'bg-violet-50 ring-2 ring-violet-300' : ''
                        }`}
                      >
                        <td className="px-2 py-2">{p.fecha}</td>
                        <td className="px-2 py-2 font-semibold text-violet-700">{p.nro}</td>
                        <td className="px-2 py-2">{p.empresa || 'SIN EMPRESA'}</td>
                        <td className="px-2 py-2 text-right">{CLP.format(p.neto || 0)}</td>
                        <td className="px-2 py-2 text-right">{CLP.format(p.iva || 0)}</td>
                        <td className="px-2 py-2 text-right font-semibold">{CLP.format(p.total_calc || 0)}</td>
                        <td className="px-2 py-2">
                          <span className={`px-2 py-1 rounded-md text-white ${pagado ? 'bg-green-600' : 'bg-red-500'}`}>
                            {pagado ? 'PAGADO' : 'PENDIENTE'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== 2) Resumen por Empresa ===== */}
        <div className="mb-4">
          <div className="font-semibold text-slate-800 mb-2">2) Resumen por Empresa</div>
          <div className="overflow-auto rounded-lg border border-violet-200">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-violet-100 text-violet-800">
                <tr>
                  <th className="px-2 py-2 text-left">Empresa</th>
                  <th className="px-2 py-2 text-right">Neto</th>
                  <th className="px-2 py-2 text-right">IVA</th>
                  <th className="px-2 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {resumenEmpresa.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500">Sin resultados.</td>
                  </tr>
                ) : (
                  <>
                    {resumenEmpresa.map((r) => (
                      <tr key={r.empresa} className="border-t">
                        <td className="px-2 py-2 font-semibold">{r.empresa}</td>
                        <td className="px-2 py-2 text-right">{CLP.format(r.neto)}</td>
                        <td className="px-2 py-2 text-right">{CLP.format(r.iva)}</td>
                        <td className="px-2 py-2 text-right font-semibold">{CLP.format(r.total)}</td>
                      </tr>
                    ))}
                    <tr className="border-t bg-violet-50">
                      <td className="px-2 py-2 font-black text-violet-800">TOTAL</td>
                      <td className="px-2 py-2 text-right font-black">{CLP.format(totalEmpresa.neto)}</td>
                      <td className="px-2 py-2 text-right font-black">{CLP.format(totalEmpresa.iva)}</td>
                      <td className="px-2 py-2 text-right font-black">{CLP.format(totalEmpresa.total)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== 3) Desglose por Pedido ===== */}
        <div className="mb-4">
          <div className="font-semibold text-slate-800 mb-2">3) Desglose por Pedido</div>

          {desgloseFiltrado.length === 0 ? (
            <div className="text-sm text-slate-500">
              No hay desglose (si tu tabla <b>pedido_linea</b> está vacía o no existe, aquí no se mostrará nada).
            </div>
          ) : (
            <div className="overflow-auto rounded-lg border border-violet-200">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-violet-100 text-violet-800">
                  <tr>
                    <th className="px-2 py-2 text-left">Fecha</th>
                    <th className="px-2 py-2 text-left">Pedido</th>
                    <th className="px-2 py-2 text-left">Empresa</th>
                    <th className="px-2 py-2 text-left">Artículo</th>
                    <th className="px-2 py-2 text-right">Cant.</th>
                    <th className="px-2 py-2 text-right">Neto</th>
                    <th className="px-2 py-2 text-right">IVA</th>
                    <th className="px-2 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {desgloseFiltrado.map((d, idx) => (
                    <tr key={`${d.pedido_nro}-${idx}`} className="border-t">
                      <td className="px-2 py-2">{d.fecha}</td>
                      <td className="px-2 py-2 font-semibold text-violet-700">{d.pedido_nro}</td>
                      <td className="px-2 py-2">{d.empresa}</td>
                      <td className="px-2 py-2">{d.articulo}</td>
                      <td className="px-2 py-2 text-right">{d.qty}</td>
                      <td className="px-2 py-2 text-right">{CLP.format(d.neto)}</td>
                      <td className="px-2 py-2 text-right">{CLP.format(d.iva)}</td>
                      <td className="px-2 py-2 text-right font-semibold">{CLP.format(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ===== 4) Resumen de Artículos ===== */}
        <div>
          <div className="font-semibold text-slate-800 mb-2">4) Resumen de Artículos</div>

          {resumenArticulos.length === 0 ? (
            <div className="text-sm text-slate-500">Sin datos (depende del desglose).</div>
          ) : (
            <div className="overflow-auto rounded-lg border border-violet-200">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-violet-100 text-violet-800">
                  <tr>
                    <th className="px-2 py-2 text-left">Artículo (Resumen)</th>
                    <th className="px-2 py-2 text-right">Cant.</th>
                    <th className="px-2 py-2 text-right">Neto</th>
                    <th className="px-2 py-2 text-right">IVA</th>
                    <th className="px-2 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenArticulos.map((r) => (
                    <tr key={r.articulo} className="border-t">
                      <td className="px-2 py-2 font-semibold">{r.articulo}</td>
                      <td className="px-2 py-2 text-right">{r.qty}</td>
                      <td className="px-2 py-2 text-right">{CLP.format(r.neto)}</td>
                      <td className="px-2 py-2 text-right">{CLP.format(r.iva)}</td>
                      <td className="px-2 py-2 text-right font-semibold">{CLP.format(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
