// app/servicio/[nro]/page.tsx
import type { Metadata } from 'next';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: { nro?: string };
};

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

function fmtDate(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const raw = params?.nro ?? '';
  return {
    title: raw ? `Servicio #${raw} | Lavandería Fabiola` : 'Servicio | Lavandería Fabiola',
    description: 'Comprobante visual del servicio de Lavandería Fabiola.',
    robots: { index: false, follow: false },
  };
}

export default async function ServicioPage({ params }: PageProps) {
  // Tomamos el nro como VIENE en la URL y luego lo convertimos
  const raw = params?.nro ?? '';
  const nro = Number(raw);

  // Si no vino nada en la URL, es realmente inválido
  if (!raw) {
    return (
      <main className="min-h-screen bg-[#050816] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Servicio no válido</h1>
          <p className="text-sm text-white/80">El número de pedido no es correcto.</p>
        </div>
      </main>
    );
  }

  // --- Cargar pedido principal (aunque el número sea raro, intentamos igual) ---
  const { data: pedido, error: e1 } = await supabase
    .from('pedido')
    .select('nro, telefono, total, estado, detalle, pagado, fecha_ingreso, fecha_entrega, foto_url')
    .eq('nro', nro)         // tu tabla ya usa nro numérico (igual que en EDITAR)
    .maybeSingle();

  if (e1) {
    console.error('Error cargando pedido en /servicio:', e1);
  }

  if (!pedido) {
    return (
      <main className="min-h-screen bg-[#050816] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Servicio no válido</h1>
          <p className="text-sm text-white/80">El número de pedido no existe.</p>
        </div>
      </main>
    );
  }

  // --- Cliente ---
  const { data: cli } = await supabase
    .from('clientes')
    .select('telefono, nombre, direccion')
    .eq('telefono', pedido.telefono)
    .maybeSingle();

  const nombreCliente = cli?.nombre || String(pedido.telefono ?? 'SIN NOMBRE');
  const direccionCliente = cli?.direccion ?? '';

  // --- Líneas del pedido ---
  const { data: lineas } = await supabase
    .from('pedido_linea')
    .select('articulo, cantidad, valor')
    .eq('pedido_id', pedido.nro);

  const items =
    lineas?.map((l) => ({
      articulo:
        (l.articulo || '').toString().trim() === ''
          ? 'SIN NOMBRE'
          : (l.articulo as string),
      qty: Number(l.cantidad ?? 0),
      valor: Number(l.valor ?? 0),
    })) ?? [];

  const totalCalc =
    items.length > 0
      ? items.reduce((acc, it) => acc + it.qty * it.valor, 0)
      : Number(pedido.total ?? 0);

  // --- Foto principal ---
  let fotoUrl: string | null = null;

  if (typeof pedido.foto_url === 'string' && pedido.foto_url.trim() !== '') {
    fotoUrl = pedido.foto_url;
  } else {
    const { data: fotos } = await supabase
      .from('pedido_foto')
      .select('url')
      .eq('pedido_id', pedido.nro)
      .limit(1)
      .maybeSingle();
    if (fotos?.url) fotoUrl = fotos.url;
  }

  const fechaIngreso = fmtDate(pedido.fecha_ingreso);
  const fechaEntrega = fmtDate(pedido.fecha_entrega);

  return (
    <main className="min-h-screen bg-[#050816] text-white flex items-center justify-center px-2 py-6">
      <div className="w-full max-w-xl rounded-3xl bg-[#0b1020] border border-white/10 shadow-2xl px-5 py-6 sm:px-8 sm:py-7">
        {/* Encabezado tipo boleta */}
        <header className="text-center mb-5">
          <div className="text-xs tracking-[0.3em] text-violet-300 uppercase mb-1">
            Lavandería
          </div>
          <h1 className="text-2xl font-extrabold tracking-wide text-white">
            FABIOLA
          </h1>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px] text-white/70">
            <span className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 font-semibold">
              Servicio N° {pedido.nro}
            </span>
            <span className="px-2 py-1 rounded-full bg-violet-500/10 border border-violet-400/40 text-violet-200">
              Estado: {pedido.estado || 'N/D'}
            </span>
            <span className="px-2 py-1 rounded-full bg-slate-500/10 border border-slate-400/40 text-slate-200">
              {pedido.pagado ? 'PAGADO' : 'PENDIENTE DE PAGO'}
            </span>
          </div>
        </header>

        {/* Datos del cliente */}
        <section className="mb-4 text-xs sm:text-sm">
          <div className="flex justify-between gap-4 border-b border-white/10 pb-3 mb-3">
            <div className="space-y-1">
              <div className="text-[11px] text-white/60 uppercase">Cliente</div>
              <div className="font-semibold text-white">{nombreCliente}</div>
              {pedido.telefono && (
                <div className="text-white/80 text-[11px]">
                  Teléfono: <span className="font-mono">{pedido.telefono}</span>
                </div>
              )}
              {direccionCliente && (
                <div className="text-white/80 text-[11px]">
                  Dirección:{' '}
                  <span className="font-normal">{direccionCliente}</span>
                </div>
              )}
            </div>
            <div className="text-right space-y-1">
              {fechaIngreso && (
                <div>
                  <div className="text-[11px] text-white/60 uppercase">
                    Fecha ingreso
                  </div>
                  <div className="font-semibold">{fechaIngreso}</div>
                </div>
              )}
              {fechaEntrega && (
                <div>
                  <div className="text-[11px] text-white/60 uppercase">
                    Fecha entrega
                  </div>
                  <div className="font-semibold">{fechaEntrega}</div>
                </div>
              )}
            </div>
          </div>

          {pedido.detalle && (
            <div className="mb-4 text-[11px] text-white/80">
              <div className="text-[10px] text-white/60 uppercase mb-1">
                Observaciones
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                {pedido.detalle}
              </div>
            </div>
          )}
        </section>

        {/* Tabla de artículos */}
        <section className="mb-4">
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/30">
            <table className="w-full text-[11px] sm:text-xs text-white/90">
              <thead className="bg-white/10 text-[10px] uppercase tracking-wide text-white/80">
                <tr>
                  <th className="text-left px-3 py-2 w-[45%]">Artículo</th>
                  <th className="text-right px-2 py-2 w-[15%]">Can.</th>
                  <th className="text-right px-2 py-2 w-[20%]">Valor</th>
                  <th className="text-right px-3 py-2 w-[20%]">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {items.length ? (
                  items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-1.5">
                        {it.articulo.length > 28
                          ? it.articulo.slice(0, 28) + '…'
                          : it.articulo}
                      </td>
                      <td className="px-2 py-1.5 text-right">{it.qty}</td>
                      <td className="px-2 py-1.5 text-right">
                        {CLP.format(it.valor)}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {CLP.format(it.qty * it.valor)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-3 text-center text-white/70"
                    >
                      Sin artículos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="px-4 py-3 bg-white/5 flex items-center justify-between text-xs sm:text-sm">
              <div className="text-[10px] text-white/70 uppercase tracking-wide">
                Total servicio
              </div>
              <div className="text-lg font-extrabold text-white">
                {CLP.format(totalCalc)}
              </div>
            </div>
          </div>
        </section>

        {/* Imagen opcional del pedido */}
        {fotoUrl && (
          <section className="mb-4">
            <div className="text-[10px] text-white/60 uppercase mb-1">
              Imagen del pedido
            </div>
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40">
              <Image
                src={fotoUrl}
                alt={`Foto pedido ${pedido.nro}`}
                width={800}
                height={600}
                className="w-full h-auto max-h-[320px] object-contain"
              />
            </div>
          </section>
        )}

        {/* Pie de página tipo boleta */}
        <footer className="mt-3 border-t border-white/10 pt-2 text-center text-[9px] text-white/55">
          <p>Este comprobante es solo informativo.</p>
          <p>Gracias por confiar en Lavandería Fabiola 💜</p>
        </footer>
      </div>
    </main>
  );
}
