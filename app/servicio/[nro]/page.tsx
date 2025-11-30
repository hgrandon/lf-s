// app/servicio/[nro]/page.tsx
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

type Params = { params: { nro: string } };

type Item = { articulo: string; qty: number; valor: number };

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const nro = params.nro;
  return {
    title: `Servicio #${nro} | Lavandería Fabiola`,
    description: `Comprobante visual del pedido #${nro}`,
    robots: { index: false, follow: false },
  };
}

export default async function ServicioPage({ params }: Params) {
  const nro = Number(params.nro || 0);
  if (!nro || Number.isNaN(nro)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold">Servicio no válido</h1>
          <p>El número de pedido no es correcto.</p>
        </div>
      </main>
    );
  }

  // --- Cargar pedido ---
  const { data: pedidoRow, error: e1 } = await supabase
    .from('pedido')
    .select('nro, telefono, total, estado, detalle, pagado, created_at, fecha_entrega')
    .eq('nro', nro)
    .maybeSingle();

  if (e1 || !pedidoRow) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold">Servicio no encontrado</h1>
          <p>No se encontró el pedido #{nro}.</p>
        </div>
      </main>
    );
  }

  const tel = pedidoRow.telefono ? String(pedidoRow.telefono) : '';

  // --- Cliente ---
  const { data: cli } = await supabase
    .from('clientes')
    .select('nombre, direccion')
    .eq('telefono', tel)
    .maybeSingle();

  // --- Ítems ---
  const { data: lineas } = await supabase
    .from('pedido_linea')
    .select('articulo, cantidad, valor')
    .eq('pedido_id', nro)
    .order('id', { ascending: true });

  const items: Item[] =
    lineas?.map((l: any) => ({
      articulo:
        String(
          l.articulo ??
            l.nombre ??
            l.descripcion ??
            l.item ??
            l.articulo_nombre ??
            l.articulo_id ??
            '',
        ).trim() || 'SIN NOMBRE',
      qty: Number(l.cantidad ?? l.qty ?? 0),
      valor: Number(l.valor ?? l.precio ?? 0),
    })) ?? [];

  const totalCalc =
    items.length > 0
      ? items.reduce((a, it) => a + it.qty * it.valor, 0)
      : Number(pedidoRow.total ?? 0);

  const fechaIngreso = pedidoRow.created_at
    ? new Date(pedidoRow.created_at)
    : null;
  const fechaEntrega = pedidoRow.fecha_entrega
    ? new Date(pedidoRow.fecha_entrega)
    : null;

  const fmtDate = (d: Date | null) =>
    d
      ? d.toLocaleDateString('es-CL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '';

  const estadoTexto = (() => {
    switch (pedidoRow.estado) {
      case 'LAVAR':
        return 'Por lavar';
      case 'LAVANDO':
        return 'Lavando';
      case 'GUARDAR':
        return 'Para guardar';
      case 'GUARDADO':
        return 'Guardado';
      case 'ENTREGAR':
        return 'Para entregar';
      case 'ENTREGADO':
        return 'Entregado';
      default:
        return String(pedidoRow.estado || '');
    }
  })();

  return (
    <main className="min-h-screen bg-slate-900 py-6 px-2 flex items-center justify-center">
      <div className="w-full max-w-md bg-white shadow-2xl rounded-2xl border border-slate-200 overflow-hidden print:w-[420px]">
        {/* Header */}
        <header className="bg-violet-700 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold tracking-wide uppercase">
              Lavandería Fabiola
            </h1>
            <p className="text-[11px] opacity-90">
              Comprobante de servicio #{nro}
            </p>
          </div>
          <div className="text-right text-[11px] leading-tight">
            <div>Fono: {tel || '—'}</div>
            <div>Estado: {estadoTexto}</div>
            <div>{pedidoRow.pagado ? 'PAGADO' : 'PENDIENTE'}</div>
          </div>
        </header>

        {/* Datos cliente */}
        <section className="px-5 py-3 border-b border-slate-200 text-[12px]">
          <div className="flex justify-between gap-2">
            <div className="space-y-1">
              <div className="font-semibold text-slate-700 uppercase">
                Cliente
              </div>
              <div className="text-slate-900 font-semibold">
                {cli?.nombre || 'SIN NOMBRE'}
              </div>
              <div className="text-slate-700">
                {cli?.direccion || 'Sin dirección registrada'}
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="font-semibold text-slate-700 uppercase">
                Fechas
              </div>
              <div>Ingreso: {fmtDate(fechaIngreso)}</div>
              <div>Entrega: {fmtDate(fechaEntrega)}</div>
            </div>
          </div>
        </section>

        {/* Detalle de artículos */}
        <section className="px-5 pt-3 pb-1 text-[12px]">
          <div className="mb-1 font-semibold text-slate-700 uppercase">
            Detalle del servicio
          </div>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="text-left px-2 py-1.5 w-[50%]">Artículo</th>
                  <th className="text-right px-2 py-1.5 w-[15%]">Cant.</th>
                  <th className="text-right px-2 py-1.5 w-[20%]">Valor</th>
                  <th className="text-right px-2 py-1.5 w-[15%]">Subt.</th>
                </tr>
              </thead>
              <tbody>
                {items.length ? (
                  items.map((it, idx) => (
                    <tr
                      key={idx}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                    >
                      <td className="px-2 py-1.5 align-top">
                        {it.articulo.length > 32
                          ? it.articulo.slice(0, 32) + '…'
                          : it.articulo}
                      </td>
                      <td className="px-2 py-1.5 text-right align-top">
                        {it.qty}
                      </td>
                      <td className="px-2 py-1.5 text-right align-top">
                        {CLP.format(it.valor)}
                      </td>
                      <td className="px-2 py-1.5 text-right align-top">
                        {CLP.format(it.qty * it.valor)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-2 py-3 text-center text-slate-500"
                    >
                      Sin artículos registrados en este pedido.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Total + detalle libre */}
        <section className="px-5 py-3 text-[12px] border-t border-slate-200 space-y-2">
          <div className="flex justify-between items-center">
            <div className="text-[11px] text-slate-600">
              Estado de pago:{' '}
              <span className="font-semibold text-slate-800">
                {pedidoRow.pagado ? 'PAGADO' : 'PENDIENTE'}
              </span>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-600">Total servicio</div>
              <div className="text-base font-extrabold text-slate-900">
                {CLP.format(totalCalc)}
              </div>
            </div>
          </div>

          {pedidoRow.detalle && (
            <div className="mt-1">
              <div className="text-[11px] text-slate-600 font-semibold">
                Observaciones
              </div>
              <div className="text-slate-800 whitespace-pre-wrap">
                {pedidoRow.detalle}
              </div>
            </div>
          )}
        </section>

        {/* Footer tipo boleta */}
        <footer className="px-5 py-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-600">
          <p className="font-semibold text-center mb-1">
            Gracias por preferir Lavandería Fabiola 💜
          </p>
          <p className="text-center">
            Este comprobante es válido solo como registro interno del servicio.
          </p>
          <p className="text-center mt-1">
            Medios de pago aceptados: efectivo / transferencia.
          </p>
        </footer>
      </div>
    </main>
  );
}
