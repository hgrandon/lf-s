'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Search as SearchIcon, Pencil } from 'lucide-react';

/* =========================
   Tipos
========================= */
type TipoEntrega = 'LOCAL' | 'DOMICILIO' | string | null;
type EstadoPago = 'PAGADO' | 'PENDIENTE' | string | null;

type PedidoDB = {
  nro: number;
  fecha: string;
  tipo_entrega?: TipoEntrega;
  estado_pago?: EstadoPago;
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

/* =========================
   Utilidades
========================= */
const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

function normalize(str: string | null | undefined) {
  return (str ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function truncate(str: string | null | undefined, max = 30) {
  const s = (str ?? '').trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function formatFecha(value: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

/* =========================
   Componente
========================= */
export default function ReportePage() {
  const router = useRouter();

  const [buscar, setBuscar] = useState('');
  const [filas, setFilas] = useState<Fila[]>([]);
  const [selNro, setSelNro] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  /* -------- Carga inicial -------- */
  useEffect(() => {
    let cancelled = false;

    async function cargar() {
      try {
        setCargando(true);
        setError(null);

        const { data: pedidos, error: e1 } = await supabase
          .from('pedido')
          .select('nro, fecha, tipo_entrega, estado_pago, telefono, total')
          .order('nro', { ascending: false })
          .limit(200);

        if (e1) throw e1;

        const pedidosSafe: PedidoDB[] = (pedidos ?? []) as PedidoDB[];

        const tels = Array.from(
          new Set(pedidosSafe.map((p) => p.telefono)),
        ).filter(Boolean);

        const clientesMap = new Map<string, ClienteDB>();

        if (tels.length) {
          const { data: clientes, error: e2 } = await supabase
            .from('clientes')
            .select('telefono, nombre, direccion')
            .in('telefono', tels);

          if (e2) throw e2;

          (clientes ?? []).forEach((c) => {
            clientesMap.set(c.telefono, c as ClienteDB);
          });
        }

        if (cancelled) return;

        const out: Fila[] = pedidosSafe.map((p) => {
          const cliente = clientesMap.get(p.telefono);
          return {
            ...p,
            nombre: cliente?.nombre ?? null,
            direccion: cliente?.direccion ?? null,
          };
        });

        setFilas(out);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setError(e?.message || 'Error cargando reporte');
        }
      } finally {
        if (!cancelled) setCargando(false);
      }
    }

    cargar();

    return () => {
      cancelled = true;
    };
  }, []);

  /* -------- Filtrado -------- */
  const filtrados = useMemo(() => {
    const q = normalize(buscar);
    if (!q) return filas;

    return filas.filter((p) => {
      const nroMatch = String(p.nro).includes(q);
      const telMatch = (p.telefono ?? '').includes(q);
      const nomMatch = normalize(p.nombre).includes(q);
      const dirMatch = normalize(p.direccion).includes(q);
      return nroMatch || telMatch || nomMatch || dirMatch;
    });
  }, [filas, buscar]);

  /* -------- Navegación -------- */
  const abrirDetalle = () => {
    if (!selNro) return;
    router.push(`/pedido/detalle?nro=${selNro}`);
  };

  const abrirEditar = () => {
    if (!selNro) return;
    router.push(`/pedido/nuevo?edit=1&nro=${selNro}`);
  };

  /* =========================
     Render
  ========================== */
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
            <h1 className="text-lg font-semibold text-slate-800">
              REPORTE BASE
            </h1>
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
          placeholder="BUSCAR N° / NOMBRE / TELÉFONO / DIRECCIÓN"
          className="w-full mb-3 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />

        {cargando && (
          <div className="mb-3 text-sm text-slate-500">Cargando…</div>
        )}
        {error && (
          <div className="mb-3 text-sm text-red-600">Error: {error}</div>
        )}

        {/* Tabla */}
        <div className="overflow-auto rounded-lg border border-violet-200">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-violet-100 text-violet-800">
              <tr>
                <th className="px-2 py-2 text-left">N°</th>
                <th className="px-2 py-2 text-left">Total</th>
                <th className="px-2 py-2 text-left">Fecha</th>
                <th className="px-2 py-2 text-left">Entrega</th>
                <th className="px-2 py-2 text-left">Pago</th>
                <th className="px-2 py-2 text-left">Teléfono</th>
                <th className="px-2 py-2 text-left">Nombre</th>
                <th className="px-2 py-2 text-left">Dirección</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-6 text-center text-slate-500"
                  >
                    Sin resultados.
                  </td>
                </tr>
              ) : (
                filtrados.map((p) => {
                  const active = selNro === p.nro;
                  const pago = (p.estado_pago ?? 'PENDIENTE').toUpperCase();
                  const isPagado = pago === 'PAGADO';
                  const entrega = (p.tipo_entrega ?? '').toUpperCase();

                  return (
                    <tr
                      key={p.nro}
                      onClick={() => setSelNro(p.nro)}
                      className={[
                        'border-t cursor-pointer hover:bg-violet-50',
                        active ? 'bg-violet-50 ring-2 ring-violet-300' : '',
                      ].join(' ')}
                    >
                      <td className="px-2 py-2 font-semibold text-violet-700">
                        {p.nro}
                      </td>
                      <td className="px-2 py-2">
                        {CLP.format(p.total ?? 0)}
                      </td>
                      <td className="px-2 py-2">{formatFecha(p.fecha)}</td>
                      <td className="px-2 py-2">
                        {entrega && (
                          <span className="inline-flex px-2 py-1 rounded-md bg-violet-50 text-violet-700 text-xs font-semibold">
                            {entrega}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={[
                            'inline-flex px-2 py-1 rounded-md text-xs font-semibold text-white',
                            isPagado ? 'bg-emerald-600' : 'bg-red-500',
                          ].join(' ')}
                        >
                          {pago}
                        </span>
                      </td>
                      <td className="px-2 py-2">{p.telefono}</td>
                      <td className="px-2 py-2 font-semibold">
                        {p.nombre || ''}
                      </td>
                      <td className="px-2 py-2">
                        {truncate(p.direccion, 30)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
