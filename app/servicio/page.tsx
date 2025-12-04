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

type Step = {
  id: number;
  label: string;
  subtitle: string;
  done: boolean;
  current: boolean;
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

/** Normaliza el estado para la ruta (ENTREGAR se considera como GUARDADO) */
function normalizarEstadoRuta(estado: PedidoEstado | null): 'LAVAR' | 'LAVANDO' | 'GUARDADO' | 'ENTREGADO' {
  if (!estado) return 'LAVAR';
  if (estado === 'ENTREGAR') return 'GUARDADO';
  if (estado === 'GUARDAR') return 'LAVANDO'; // por si acaso
  if (estado === 'GUARDADO') return 'GUARDADO';
  if (estado === 'ENTREGADO') return 'ENTREGADO';
  if (estado === 'LAVANDO') return 'LAVANDO';
  return 'LAVAR';
}

/** Construye los pasos de tracking tipo "PedidosYa" */
function getSteps(
  estado: PedidoEstado | null,
  tipoEntrega: 'LOCAL' | 'DOMICILIO'
): Step[] {
  const est = normalizarEstadoRuta(estado);
  const orden: ('LAVAR' | 'LAVANDO' | 'GUARDADO' | 'ENTREGADO')[] = [
    'LAVAR',
    'LAVANDO',
    'GUARDADO',
    'ENTREGADO',
  ];
  const idxActual = orden.indexOf(est);

  return [
    {
      id: 1,
      label: 'Recepcionado',
      subtitle: 'Hemos recibido tu pedido',
      done: idxActual >= 0,
      current: est === 'LAVAR',
    },
    {
      id: 2,
      label: 'Lavando',
      subtitle: 'Tu ropa está en proceso',
      done: idxActual >= 1,
      current: est === 'LAVANDO',
    },
    {
      id: 3,
      label:
        tipoEntrega === 'DOMICILIO'
          ? 'Listo para entregar'
          : 'Listo para retirar',
      subtitle:
        tipoEntrega === 'DOMICILIO'
          ? 'Coordinando tu despacho'
          : 'Disponible en el local',
      done: idxActual >= 2,
      current: est === 'GUARDADO',
    },
    {
      id: 4,
      label: 'Pedido entregado',
      subtitle: 'Servicio finalizado',
      done: idxActual >= 3,
      current: est === 'ENTREGADO',
    },
  ];
}

/** Mensaje principal dinámico, profesional */
function buildMensajePrincipal(
  estado: PedidoEstado | null,
  tipoEntrega: 'LOCAL' | 'DOMICILIO',
  pagado: boolean
) {
  const est = estado ?? 'LAVAR';

  const pagoTexto = pagado ? 'ya se encuentra pagado' : 'está pendiente de pago';
  const pagoClase = pagado ? 'text-emerald-600' : 'text-amber-500';

  if (est === 'GUARDADO' || est === 'ENTREGAR') {
    if (tipoEntrega === 'DOMICILIO') {
      return (
        <>
          tu servicio está{' '}
          <span className="text-emerald-600">LISTO PARA QUE TE LO LLEVEMOS</span>{' '}
          a domicilio.
          <br />
          El pago{' '}
          <span className={pagoClase}>
            {pagoTexto}.
          </span>
        </>
      );
    }
    // LOCAL
    return (
      <>
        tu servicio está{' '}
        <span className="text-emerald-600">LISTO PARA RETIRAR</span> en nuestro
        local.
        <br />
        El pago{' '}
        <span className={pagoClase}>
          {pagoTexto}.
        </span>
      </>
    );
  }

  if (est === 'ENTREGADO') {
    return (
      <>
        tu servicio está{' '}
        <span className="text-emerald-600">ENTREGADO</span>.
        <br />
        ¡Muchas gracias por confiar en Lavandería Fabiola! 💜
      </>
    );
  }

  if (est === 'LAVANDO' || est === 'GUARDAR') {
    return (
      <>
        estamos{' '}
        <span className="text-violet-700">PROCESANDO TU SERVICIO</span>.
        <br />
        El pago{' '}
        <span className={pagoClase}>
          {pagoTexto}.
        </span>
      </>
    );
  }

  // LAVAR u otros
  return (
    <>
      hemos{' '}
      <span className="text-violet-700">RECEPCIONADO TU SERVICIO</span> y pronto
      comenzaremos el lavado.
      <br />
      El pago{' '}
      <span className={pagoClase}>
        {pagoTexto}.
      </span>
    </>
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
  const tipoEntrega: 'LOCAL' | 'DOMICILIO' =
    (pedido?.tipo_entrega || '').toUpperCase() === 'DOMICILIO'
      ? 'DOMICILIO'
      : 'LOCAL';

  const nombreCli = (cliente?.nombre || '').trim() || 'CLIENTE';
  const estadoActual = pedido?.estado ?? 'LAVAR';
  const steps = getSteps(estadoActual, tipoEntrega);

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
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-violet-100">
        {/* HEADER */}
        <div className="px-6 pt-6 pb-5 border-b border-slate-200 text-center">
          {/* Logo + título */}
          <div className="flex flex-col items-center gap-2 mb-3">
            <Image
              src="/logo.png"
              alt="Logo"
              width={85}
              height={85}
              className="rounded-2xl shadow-md object-cover"
            />
            <h1 className="text-[13px] sm:text-sm text-violet-800 font-extrabold tracking-[0.25em]">
              LAVANDERÍA FABIOLA
            </h1>
          </div>

          {/* Número */}
          <div className="inline-flex items-center justify-center px-4 py-1 rounded-full bg-fuchsia-100 text-fuchsia-700 text-[11px] font-semibold tracking-[0.25em] mb-2">
            TU N° SERVICIO
          </div>
          <div
            className="
              text-7xl 
              font-black 
              leading-tight 
              text-violet-800
              drop-shadow-[0_3px_3px_rgba(0,0,0,0.35)]
              tracking-widest
              mb-2
            "
          >
            {pedido.nro}
          </div>

          {/* Mensaje principal */}
          <div className="mt-2 text-sm font-semibold text-slate-800">
            Hola {nombreCli.split(' ')[0]},
            <br />
            {buildMensajePrincipal(estadoActual, tipoEntrega, esPagado)}
          </div>

          {/* Horario */}
          <div className="mt-2 text-xs text-slate-600">
            Atención Lunes a Viernes de 10:00 a 20:00 hrs.
          </div>
        </div>

        {/* RUTA DE ESTADO tipo PedidosYa */}
        <div className="px-6 pt-4 pb-3 bg-violet-50 border-b border-slate-200">
          <div className="text-xs font-semibold text-violet-800 mb-3 text-left">
            Seguimiento de tu servicio
          </div>
          <div className="flex flex-col sm:flex-row sm:items-stretch sm:justify-between gap-3">
            {steps.map((s, idx) => (
              <div
                key={s.id}
                className="flex-1 flex items-start gap-2 sm:flex-col sm:items-center sm:text-center"
              >
                {/* Circulo / número */}
                <div
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2
                    ${
                      s.done
                        ? 'bg-violet-700 border-violet-700 text-white'
                        : 'bg-white border-slate-300 text-slate-500'
                    }`}
                >
                  {s.id}
                </div>

                {/* Línea horizontal en desktop */}
                {idx < steps.length - 1 && (
                  <div className="hidden sm:block flex-1 h-[2px] bg-gradient-to-r from-violet-400 to-fuchsia-400 mt-3 mx-1" />
                )}

                {/* Texto */}
                <div className="sm:mt-2">
                  <div
                    className={`text-[11px] font-bold uppercase tracking-wide ${
                      s.done ? 'text-violet-800' : 'text-slate-500'
                    }`}
                  >
                    {s.label}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {s.subtitle}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DATOS RESUMEN */}
        <div className="px-6 py-4 text-xs text-slate-800 grid gap-2">
          <div className="flex justify-between">
            <span className="font-semibold text-violet-800">Fecha entrega</span>
            <span>{formatFecha(pedido.fecha_entrega)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-violet-800">Estado pago</span>
            <span className={esPagado ? 'text-emerald-600' : 'text-amber-600'}>
              {esPagado ? 'PAGADO' : 'PENDIENTE'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-violet-800">Tipo entrega</span>
            <span>{tipoEntrega}</span>
          </div>
          {cliente?.direccion && (
            <div className="flex justify-between">
              <span className="font-semibold text-violet-800">Dirección</span>
              <span className="text-right max-w-[60%]">
                {cliente.direccion}
              </span>
            </div>
          )}
        </div>

        {/* DETALLE */}
        <div className="px-6 pb-5">
          <div className="text-xs font-semibold mb-2 text-slate-700">
            Detalle del servicio
          </div>

          <div className="border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
            <table className="w-full text-[11px]">
              <thead className="bg-violet-700">
                <tr className="text-white">
                  <th className="text-left px-3 py-2 font-semibold">
                    Descripción
                  </th>
                  <th className="text-right px-2 py-2 font-semibold">Cant</th>
                  <th className="text-right px-2 py-2 font-semibold">Valor</th>
                  <th className="text-right px-3 py-2 font-semibold">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length ? (
                  items.map((it, i) => (
                    <tr
                      key={i}
                      className={
                        i % 2 === 0
                          ? 'bg-slate-50 border-t border-slate-200'
                          : 'bg-white border-t border-slate-200'
                      }
                    >
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

            {/* TOTAL GRANDE, COLORES DEL LOGO */}
            <div className="px-4 py-4 bg-gradient-to-r from-violet-700 to-fuchsia-600 text-right text-xl sm:text-2xl font-black text-white tracking-wide">
              TOTAL:&nbsp; {CLP.format(totalCalc)}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
