// app/servicio/[nro]/page.tsx
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

type Params = { params: { nro: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const nro = params.nro;
  return {
    title: `Servicio #${nro} | Lavandería Fabiola`,
    description: `Comprobante visual del servicio #${nro}`,
    robots: { index: false, follow: false },
  };
}

type PedidoEstado =
  | 'LAVAR'
  | 'LAVANDO'
  | 'GUARDAR'
  | 'GUARDADO'
  | 'ENTREGAR'
  | 'ENTREGADO';

type Linea = {
  articulo: string;
  cantidad: number | null;
  valor: number | null;
};

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export default async function ServicioPage({ params }: Params) {
  const nro = Number(params.nro || 0);

  if (!nro || Number.isNaN(nro)) {
    return (
      <main className="min-h-screen bg-[#050816] text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold">Servicio no válido</h1>
          <p className="text-sm text-slate-300">
            El número de pedido no es correcto.
          </p>
        </div>
      </main>
    );
  }

  // --- Cargar datos del pedido ---
  const { data: pedido, error: ePedido } = await supabase
    .from('pedido')
    .select(
      'nro, telefono, total, estado, detalle, pagado, fecha_ingreso, fecha_entrega',
    )
    .eq('nro', nro)
    .maybeSingle();

  if (ePedido || !pedido) {
    return (
      <main className="min-h-screen bg-[#050816] text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold">Servicio no encontrado</h1>
          <p className="text-sm text-slate-300">
            No existe un pedido asociado al número #{nro}.
          </p>
        </div>
      </main>
    );
  }

  // Cliente
  const telefono = pedido.telefono ? String(pedido.telefono) : null;
  let clienteNombre: string | null = null;

  if (telefono) {
    const { data: cli } = await supabase
      .from('clientes')
      .select('nombre')
      .eq('telefono', telefono)
      .maybeSingle();
    clienteNombre = cli?.nombre ?? null;
  }

  // Líneas
  const { data: lineas } = await supabase
    .from('pedido_linea')
    .select('articulo, cantidad, valor')
    .eq('pedido_id', nro);

  const items: Linea[] =
    lineas?.map((l) => ({
      articulo:
        (l.articulo as string | null)?.trim() || 'ARTÍCULO SIN NOMBRE',
      cantidad: Number(l.cantidad ?? 0),
      valor: Number(l.valor ?? 0),
    })) ?? [];

  const totalCalc =
    items.length > 0
      ? items.reduce(
          (acc, it) => acc + (it.cantidad ?? 0) * (it.valor ?? 0),
          0,
        )
      : Number(pedido.total ?? 0);

  const estadoLabel = (pedido.estado as PedidoEstado) || 'LAVAR';
  const estadoTexto: Record<PedidoEstado, string> = {
    LAVAR: 'Para lavar',
    LAVANDO: 'En proceso de lavado',
    GUARDAR: 'Listo para guardar',
    GUARDADO: 'Guardado',
    ENTREGAR: 'Listo para entregar',
    ENTREGADO: 'Entregado',
  };

  const fechaIng = pedido.fecha_ingreso
    ? new Date(pedido.fecha_ingreso)
    : null;
  const fechaEnt = pedido.fecha_entrega
    ? new Date(pedido.fecha_entrega)
    : null;

  const fmt = (d: Date | null) =>
    d
      ? d.toLocaleDateString('es-CL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '—';

  // --- Vista tipo imagen / comprobante ---
  return (
    <main className="min-h-screen bg-[#050816] flex items-center justify-center px-3 py-6 print:bg-white">
      <div
        className="
          w-full max-w-[480px]
          bg-slate-900 text-slate-50
          rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.6)]
          border border-slate-700
          overflow-hidden
        "
      >
        {/* Encabezado */}
        <div className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-500 px-6 py-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs tracking-[0.2em] uppercase text-violet-100/90">
              Lavandería Fabiola
            </span>
            <h1 className="text-2xl font-extrabold leading-tight">
              Comprobante de Servicio
            </h1>
            <p className="text-xs text-violet-100/90">
              N° <span className="font-semibold">#{pedido.nro}</span>
            </p>
          </div>
        </div>

        {/* Datos principales */}
        <div className="px-6 py-4 text-sm space-y-1.5 bg-slate-900">
          <div className="flex justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[11px] uppercase text-slate-400">
                Cliente
              </p>
              <p className="font-semibold">
                {clienteNombre || 'CLIENTE SIN NOMBRE'}
              </p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-[11px] uppercase text-slate-400">
                Teléfono
              </p>
              <p className="font-semibold">
                {telefono || '—'}
              </p>
            </div>
          </div>

          <div className="flex justify-between gap-4 pt-2">
            <div>
              <p className="text-[11px] uppercase text-slate-400">
                Fecha ingreso
              </p>
              <p className="font-medium">{fmt(fechaIng)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase text-slate-400">
                Fecha entrega
              </p>
              <p className="font-medium">{fmt(fechaEnt)}</p>
            </div>
          </div>

          <div className="pt-2">
            <p className="text-[11px] uppercase text-slate-400">
              Estado del servicio
            </p>
            <p className="font-semibold">
              {estadoTexto[estadoLabel] || estadoLabel}
              {pedido.pagado ? ' • PAGADO' : ' • PENDIENTE'}
            </p>
          </div>

          {pedido.detalle && (
            <div className="pt-2">
              <p className="text-[11px] uppercase text-slate-400">
                Nota
              </p>
              <p className="text-xs text-slate-200 whitespace-pre-wrap">
                {pedido.detalle}
              </p>
            </div>
          )}
        </div>

        {/* Detalle de artículos */}
        <div className="px-6 pt-3 pb-4 bg-slate-950/40">
          <div className="rounded-2xl border border-slate-700/80 overflow-hidden bg-slate-900/60">
            <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-700/80">
              <p className="text-[11px] tracking-[0.18em] uppercase text-slate-300">
                Detalle de artículos
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs text-slate-100">
                <thead className="bg-slate-900/80 text-slate-300">
                  <tr>
                    <th className="text-left px-3 py-2 w-[44%]">
                      Artículo
                    </th>
                    <th className="text-center px-2 py-2 w-[14%]">
                      Cant.
                    </th>
                    <th className="text-right px-2 py-2 w-[20%]">
                      Valor
                    </th>
                    <th className="text-right px-3 py-2 w-[22%]">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/70">
                  {items.length ? (
                    items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-1.5 align-top">
                          {it.articulo.length > 26
                            ? it.articulo.slice(0, 26) + '…'
                            : it.articulo}
                        </td>
                        <td className="px-2 py-1.5 text-center align-top">
                          {it.cantidad ?? 0}
                        </td>
                        <td className="px-2 py-1.5 text-right align-top">
                          {CLP.format(it.valor ?? 0)}
                        </td>
                        <td className="px-3 py-1.5 text-right align-top">
                          {CLP.format(
                            (it.cantidad ?? 0) * (it.valor ?? 0),
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-4 text-center text-slate-400"
                      >
                        Sin artículos registrados en este servicio.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 bg-slate-900/90 border-t border-slate-700/80 flex items-center justify-between">
              <span className="text-xs tracking-[0.28em] uppercase text-slate-400">
                Total
              </span>
              <span className="text-lg font-extrabold text-slate-50">
                {CLP.format(totalCalc)}
              </span>
            </div>
          </div>
        </div>

        {/* Pie tipo boleta */}
        <div className="px-6 pb-5 pt-3 bg-slate-900 text-[11px] text-slate-300 space-y-1.5">
          <p>
            * Este comprobante es solo informativo. El pago se realiza en
            efectivo al momento de la entrega, salvo acuerdo diferente.
          </p>
          <p className="pt-1 text-center text-[10px] text-slate-400 tracking-wide">
            Gracias por confiar en <span className="font-semibold">Lavandería Fabiola</span> 💜
          </p>
        </div>
      </div>
    </main>
  );
}
