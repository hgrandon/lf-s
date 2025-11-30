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
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-violet-800 via-violet-900 to-slate-950 text-white">
      <div className="text-center max-w-sm px-4 bg-white/10 backdrop-blur-md rounded-2xl py-6 border border-white/10">
        <h1 className="text-xl font-semibold mb-2">Servicio no válido</h1>
        <p className="text-sm text-white/80">{message}</p>
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

  /* =========================
      Leer token desde URL
  ========================== */
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
    } catch {
      setToken(null);
      setError('El link del servicio no es válido.');
      setLoading(false);
    }
  }, []);

  /* =========================
      Cargar datos del servicio
  ========================== */
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
        if (!ped) throw new Error('No se encontró el servicio asociado a este link.');

        if (!cancelled) setPedido(ped as PedidoRow);

        if (ped.telefono) {
          const { data: cli } = await supabase
            .from('clientes')
            .select('nombre,direccion')
            .eq('telefono', ped.telefono)
            .maybeSingle();
          if (!cancelled && cli) {
            setCliente({
              nombre: cli.nombre ?? null,
              direccion: cli.direccion ?? null,
            });
          }
        }

        const { data: lineas } = await supabase
          .from('pedido_linea')
          .select('articulo,cantidad,valor')
          .eq('pedido_id', ped.nro);

        if (!cancelled && lineas) {
          setItems(
            lineas.map((l: any) => ({
              articulo: l.articulo || '',
              cantidad: l.cantidad ? Number(l.cantidad) : null,
              valor: l.valor ? Number(l.valor) : null,
            }))
          );
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? 'Error al cargar el servicio');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    cargar();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const totalCalc = useMemo(() => {
    if (items.length)
      return items.reduce(
        (acc, it) =>
          acc + (Number(it.cantidad) || 0) * (Number(it.valor) || 0),
        0
      );

    return Number(pedido?.total ?? 0);
  }, [items, pedido]);

  const esPagado = !!pedido?.pagado;
  const tipoEntrega =
    (pedido?.tipo_entrega || '').toUpperCase() === 'DOMICILIO'
      ? 'DOMICILIO'
      : 'LOCAL';

  const nombreCli = (cliente?.nombre || '').trim() || 'CLIENTE';

  /* =========================
      ESTADOS / LOADING
  ========================== */

  if (loading && !error)
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-violet-800 via-violet-900 to-slate-950 px-3">
        <div className="text-center bg-white/10 backdrop-blur-md rounded-2xl px-6 py-5 text-white/90">
          Cargando servicio…
        </div>
      </main>
    );

  if (error && !pedido) return <ErrorServicio message={error} />;
  if (!pedido) return null;

  /* =========================
      COMPROBANTE FINAL
  ========================== */

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-violet-800 via-violet-900 to-slate-950 px-3 py-8">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/10">
        <div className="px-6 pt-6 pb-4 border-b border-slate-200 text-center">
          {/* Logo */}
          <div className="flex flex-col items-center gap-2 mb-3">
            <Image
              src="/logo.png"
              alt="Logo"
              width={85}
              height={85}
              className="rounded-xl shadow-md object-cover"
            />
            <h1 className="text-violet-800 font-extrabold text-sm tracking-[0.25em]">
              LAVANDERÍA FABIOLA
            </h1>
            <p className="text-[11px] text-violet-600 font-semibold tracking-wide uppercase">
              Comprobante de servicio
            </p>
          </div>

          {/* Número */}
          <div className="text-[11px] tracking-[0.25em] text-violet-500 mb-1">
            TU N° SERVICIO
          </div>
          <div
            className="
              text-7xl 
              font-black 
              leading-tight 
              bg-gradient-to-b 
              from-violet-400 
              via-violet-600 
              to-violet-900 
              text-transparent 
              bg-clip-text 
              drop-shadow-[0_3px_3px_rgba(0,0,0,0.35)]
              tracking-widest
            "
          >
            {pedido.nro}
          </div>

          {/* Texto dinámico */}
          <div className="mt-4 text-sm font-semibold text-slate-800">
            Hola {nombreCli.split(' ')[0]},
            <br />
            {pedido.estado === 'GUARDADO' || pedido.estado === 'ENTREGAR' ? (
              tipoEntrega === 'DOMICILIO' ? (
                <>
                  tu servicio está{' '}
                  <span className="text-emerald-600">LISTO</span>.  
                  <br /> ¿Nos confirmas si podemos llevar tu pedido a domicilio? 🚚
                </>
              ) : (
                <>
                  tu servicio está{' '}
                  <span className="text-emerald-600">LISTO</span>.  
                  <br /> Te esperamos para su retiro en nuestro local 🕘
                </>
              )
            ) : pedido.estado === 'ENTREGADO' ? (
              <>
                tu servicio está{' '}
                <span className="text-emerald-600">ENTREGADO</span>.  
                <br /> ¡Gracias por preferirnos! 💜
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

          <div className="mt-2 text-xs text-slate-600">
            Atención Lunes a Viernes de 10:00 a 20:00 hrs.
          </div>
        </div>

        {/* Datos: solo fecha entrega + estados */}
        <div className="px-6 py-3 text-xs text-slate-800 grid gap-2">
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

        {/* Detalle */}
        <div className="px-6 py-3">
          <div className="text-xs font-semibold mb-2 text-slate-700">
            Detalle del servicio
          </div>

          <div className="border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
            <table className="w-full text-[11px]">
              <thead className="bg-violet-50">
                <tr className="text-violet-800">
                  <th className="text-left px-3 py-2">Descripción</th>
                  <th className="text-right px-2 py-2">Cant</th>
                  <th className="text-right px-2 py-2">Valor</th>
                  <th className="text-right px-3 py-2">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.length ? (
                  items.map((it, i) => (
                    <tr key={i} className="border-t border-slate-200">
                      <td className="px-3 py-2">{it.articulo}</td>
                      <td className="px-2 py-2 text-right">
                        {it.cantidad ?? 0}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {CLP.format(it.valor ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {CLP.format((it.cantidad ?? 0) * (it.valor ?? 0))}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-center py-3 text-slate-500"
                    >
                      Sin artículos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="px-3 py-3 bg-violet-50 text-right text-[12px] font-extrabold text-violet-800">
              TOTAL:&nbsp; {CLP.format(totalCalc)}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
