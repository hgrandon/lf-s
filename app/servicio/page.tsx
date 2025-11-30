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

  // Leer token desde la URL y limpiar la URL
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

        const { data: ped, error: ePed } = await supabase
          .from('pedido')
          .select(
            'nro, telefono, total, estado, pagado, tipo_entrega, fecha_ingreso, fecha_entrega, foto_url'
          )
          .eq('token_servicio', token)
          .maybeSingle();

        if (ePed) throw ePed;
        if (!ped) throw new Error(
          'No se encontró el servicio asociado a este link.'
        );

        const pedidoRow = ped as PedidoRow;
        if (cancelled) return;
        setPedido(pedidoRow);

        // Cliente solo para saludo (no mostramos datos personales)
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

  const esPagado = !!pedido?.pagado;
  const tipoEntrega =
    (pedido?.tipo_entrega || '').toUpperCase() === 'DOMICILIO'
      ? 'DOMICILIO'
      : 'LOCAL';

  const nombreCli = (cliente?.nombre || '').trim() || 'CLIENTE';

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
     COMPROBANTE limpio
  ========================== */

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 px-3 py-6">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-violet-100 overflow-hidden">
        {/* Cabecera grande */}
        <div className="px-6 pt-5 pb-4 border-b border-violet-100 text-center">
          {/* Logo + título */}
          <div className="flex flex-col items-center gap-2 mb-2">
            <Image
              src="/logo.png"
              alt="Lavandería Fabiola"
              width={80}
              height={80}
              className="rounded-xl object-cover shadow-sm"
              priority
            />
            <h1 className="text-violet-800 font-extrabold text-sm tracking-[0.25em]">
              LAVANDERÍA FABIOLA
            </h1>
            <p className="text-[11px] text-violet-600 font-semibold uppercase tracking-wide">
              Comprobante de servicio
            </p>
          </div>

          {/* Número de servicio */}
          <div className="mt-2 flex items-center justify-center">
            <div className="text-[11px] tracking-[0.25em] text-violet-500">
              TU N° SERVICIO
            </div>
          </div>

          <div className="mt-1 text-6xl font-extrabold text-violet-700 leading-tight">
            {pedido.nro}
          </div>

          {/* Mensaje dinámico según estado / tipo de entrega */}
          <div className="mt-3 text-sm font-semibold text-slate-800">
            Hola {nombreCli.split(' ')[0]},{' '}
            {pedido.estado === 'GUARDADO' || pedido.estado === 'ENTREGAR' ? (
              tipoEntrega === 'DOMICILIO' ? (
                <>
                  tu servicio está{' '}
                  <span className="text-emerald-600">LISTO</span>. <br />
                  Necesitamos que nos confirmes si podemos llevar tu pedido a
                  domicilio 🚚
                </>
              ) : (
                <>
                  tu servicio está{' '}
                  <span className="text-emerald-600">LISTO</span>. <br />
                  Por favor pasa a retirar tu ropa cuando puedas 🕘
                </>
              )
            ) : pedido.estado === 'ENTREGADO' ? (
              <>
                tu servicio ya fue{' '}
                <span className="text-emerald-600">ENTREGADO</span>. <br />
                ¡Gracias por tu preferencia! 💜
              </>
            ) : esPagado ? (
              <>
                tu servicio está{' '}
                <span className="text-emerald-600">PAGADO</span>.
              </>
            ) : (
              <>
                tu servicio está{' '}
                <span className="text-amber-600">PENDIENTE</span>.
              </>
            )}
          </div>

          <div className="mt-1 text-xs text-slate-600">
            Atención de Lunes a Viernes de 10:00 a 20:00 hrs.
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

        {/* Detalle del servicio */}
        <div className="px-6 pt-3 pb-1 text-xs text-slate-800">
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

        {/* SOLO PAGO EFECTIVO */}
        <div className="px-6 pb-4 pt-3">
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
