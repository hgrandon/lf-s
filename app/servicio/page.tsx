// app/servicio/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

/* =========================
   Tipos
========================= */

type PedidoEstado =
  | 'LAVAR'
  | 'LAVANDO'
  | 'GUARDAR'
  | 'GUARDADO'
  | 'ENTREGADO'
  | 'ENTREGAR';

type PedidoRow = {
  nro: number;
  telefono: string | null;
  total: number | null;
  estado: PedidoEstado | null;
  pagado: boolean | null;
  tipo_entrega: string | null;
  fecha_ingreso: string | null;
  fecha_entrega: string | null;
  foto_url: string | null;
};

type Linea = {
  articulo: string;
  cantidad: number | null;
  valor: number | null;
};

type ClienteRow = {
  nombre: string | null;
  direccion: string | null;
};

/* =========================
   Utilidades
========================= */

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

function formatFecha(iso?: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}-${m}-${y}`;
}

function firstFotoFromMixed(input: unknown): string | null {
  if (!input) return null;
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return null;
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'string') {
          return arr[0] as string;
        }
        return null;
      } catch {
        return null;
      }
    }
    return s;
  }
  if (Array.isArray(input) && input.length > 0 && typeof input[0] === 'string') {
    return input[0] as string;
  }
  return null;
}

function ErrorServicio({ message }: { message: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="text-center max-w-sm px-4">
        <h1 className="text-xl font-semibold mb-2">Servicio no válido</h1>
        <p className="text-sm text-white/70">{message}</p>
      </div>
    </main>
  );
}

/* =========================
   Página /servicio (cliente)
========================= */

export default function ServicioPage() {
  const [token, setToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pedido, setPedido] = useState<PedidoRow | null>(null);
  const [items, setItems] = useState<Linea[]>([]);
  const [cliente, setCliente] = useState<ClienteRow | null>(null);

  // Leer token desde la URL (window.location) y limpiar la URL
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const t = url.searchParams.get('token');
      if (!t) {
        setToken(null);
        setError('El link del servicio no es válido.');
        setLoading(false);
        return;
      }

      setToken(t);

      // enmascarar URL (ocultar token)
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      console.error('No se pudo leer token del servicio:', e);
      setToken(null);
      setError('El link del servicio no es válido.');
      setLoading(false);
    }
  }, []);

  // Cargar datos desde Supabase cuando ya tenemos token
  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function cargar() {
      try {
        setLoading(true);
        setError(null);

        // Pedido por token_seguro
        const { data: ped, error: ePed } = await supabase
          .from('pedido')
          .select(
            'nro, telefono, total, estado, pagado, tipo_entrega, fecha_ingreso, fecha_entrega, foto_url'
          )
          .eq('token_servicio', token)
          .maybeSingle();

        if (ePed) throw ePed;
        if (!ped) throw new Error('No se encontró el servicio asociado a este link.');

        const pedidoRow = ped as PedidoRow;
        if (cancelled) return;
        setPedido(pedidoRow);

        // Cliente
        if (pedidoRow.telefono) {
          const { data: cli } = await supabase
            .from('clientes')
            .select('nombre,direccion')
            .eq('telefono', pedidoRow.telefono)
            .maybeSingle();

          if (!cancelled && cli) {
            setCliente({
              nombre: (cli.nombre as string) ?? null,
              direccion: (cli.direccion as string) ?? null,
            });
          }
        }

        // Líneas
        const { data: lineas } = await supabase
          .from('pedido_linea')
          .select('articulo,cantidad,valor')
          .eq('pedido_id', pedidoRow.nro);

        if (!cancelled) {
          const mapped: Linea[] =
            (lineas || []).map((l: any) => ({
              articulo: String(l.articulo || ''),
              cantidad: l.cantidad == null ? null : Number(l.cantidad),
              valor: l.valor == null ? null : Number(l.valor),
            })) ?? [];
          setItems(mapped);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error(e);
          setError(e?.message ?? 'No se pudo cargar el servicio.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void cargar();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const totalCalc = useMemo(() => {
    if (items.length > 0) {
      return items.reduce(
        (acc, it) =>
          acc + (Number(it.cantidad) || 0) * (Number(it.valor) || 0),
        0
      );
    }
    return Number(pedido?.total ?? 0);
  }, [items, pedido]);

  const foto = firstFotoFromMixed(pedido?.foto_url ?? null);
  const esPagado = !!pedido?.pagado;
  const tipoEntrega =
    (pedido?.tipo_entrega || '').toUpperCase() === 'DOMICILIO'
      ? 'DOMICILIO'
      : 'LOCAL';

  const nombreCli = (cliente?.nombre || '').trim() || 'CLIENTE';
  const direccionCli =
    (cliente?.direccion || '').trim() || 'SIN DIRECCIÓN REGISTRADA';

  /* =========================
     ESTADOS
  ========================== */

  if (!token && !loading) {
    return <ErrorServicio message="El link del servicio no es válido." />;
  }

  if (loading && !pedido && !error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-900 px-3">
        <div className="text-center bg-white rounded-3xl shadow-xl px-6 py-5 border border-violet-100 max-w-md">
          <p className="text-sm text-slate-600">Cargando servicio…</p>
        </div>
      </main>
    );
  }

  if (error && !pedido) {
    return <ErrorServicio message={error} />;
  }

  if (!pedido) return null;

  /* =========================
     COMPROBANTE
  ========================== */

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 px-3 py-6">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-violet-100 overflow-hidden">
        {/* Cabecera */}
        <div className="px-6 pt-5 pb-4 border-b border-violet-100 text-center">
          <div className="flex items-center justify-between text-violet-700 text-xs font-semibold">
            <span>LAVANDERÍA FABIOLA</span>
            <span>COMPROBANTE DE SERVICIO</span>
          </div>

          <div className="mt-3 flex items-center justify-center gap-3">
            <div className="text-[11px] tracking-[0.25em] text-violet-500">
              TU N° SERVICIO
            </div>
          </div>

          <div className="mt-1 text-6xl font-extrabold text-violet-700 leading-tight">
            {pedido.nro}
          </div>

          <div className="mt-3 text-sm font-semibold text-slate-800">
            Hola {nombreCli.split(' ')[0]}, tu servicio está{' '}
            {esPagado ? (
              <span className="text-emerald-600">PAGADO</span>
            ) : (
              <span className="text-amber-600">PENDIENTE</span>
            )}
            .
          </div>
          <div className="mt-1 text-xs text-slate-600">
            Necesitamos que pases a retirar tu ropa. Atención de Lunes a
            Viernes de 10:00 a 20:00 hrs.
          </div>
        </div>

        {/* Datos principales */}
        <div className="px-6 pt-4 pb-2 grid gap-1 text-xs text-slate-800">
          <div className="flex justify-between">
            <span className="font-semibold">Fecha ingreso</span>
            <span>{formatFecha(pedido.fecha_ingreso)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">Fecha entrega</span>
            <span>{formatFecha(pedido.fecha_entrega)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">Estado pago</span>
            <span className={esPagado ? 'text-emerald-600' : 'text-amber-600'}>
              {esPagado ? 'PAGADO' : 'PENDIENTE'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">Tipo entrega</span>
            <span>{tipoEntrega}</span>
          </div>
        </div>

        {/* Cliente */}
        <div className="px-6 pt-3 pb-3 text-xs text-slate-800">
          <div className="font-semibold mb-1">Cliente</div>
          <div className="border border-slate-200 rounded-2xl px-3 py-2 bg-slate-50">
            <div className="font-bold text-[13px] truncate">
              {nombreCli.toUpperCase()}
            </div>
            <div className="text-[11px] truncate">{direccionCli}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Teléfono: {pedido.telefono || '—'}
            </div>
          </div>
        </div>

        {/* Detalle */}
        <div className="px-6 pt-2 pb-1 text-xs text-slate-800">
          <div className="font-semibold mb-1">Detalle del servicio</div>
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
            <table className="w-full text-[11px]">
              <thead className="bg-violet-50">
                <tr className="text-violet-800">
                  <th className="text-left px-3 py-1.5 w-[48%]">Descripción</th>
                  <th className="text-right px-2 py-1.5 w-[14%]">Cant.</th>
                  <th className="text-right px-2 py-1.5 w-[18%]">Valor</th>
                  <th className="text-right px-3 py-1.5 w-[20%]">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.length ? (
                  items.map((it, i) => (
                    <tr
                      key={i}
                      className="border-t border-slate-200 last:border-b"
                    >
                      <td className="px-3 py-1.5 truncate">
                        {it.articulo || '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {it.cantidad ?? 0}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {CLP.format(it.valor ?? 0)}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {CLP.format(
                          (Number(it.cantidad) || 0) *
                            (Number(it.valor) || 0)
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-3 text-center text-slate-500"
                    >
                      Sin artículos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="px-3 py-2 bg-violet-50 text-right text-[12px] font-extrabold text-violet-800">
              VALOR SERVICIO:&nbsp; {CLP.format(totalCalc)}
            </div>
          </div>
        </div>

        {/* Foto */}
        {foto && (
          <div className="px-6 pt-3 pb-3">
            <div className="text-xs text-slate-600 mb-1">
              Referencia visual del pedido
            </div>
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-black/5">
              <Image
                src={foto}
                alt={`Foto pedido ${pedido.nro}`}
                width={800}
                height={600}
                className="w-full h-auto object-cover"
              />
            </div>
          </div>
        )}

        {/* SOLO PAGO EFECTIVO */}
        <div className="px-6 pb-4 pt-1">
          <div className="w-full rounded-2xl bg-yellow-400 text-center font-extrabold text-red-700 text-sm py-2">
            SOLO PAGO EFECTIVO
          </div>
        </div>

        {/* Pie */}
        <div className="px-6 pb-4 pt-1 text-[10px] text-center text-slate-500 border-t border-slate-200">
          Comprobante generado por Lavandería Fabiola. Uso exclusivo informativo
          para el cliente.
        </div>
      </div>
    </main>
  );
}
