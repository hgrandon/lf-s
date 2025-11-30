// app/servicio/page.tsx
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import Script from 'next/script';

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

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

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

/** Obtiene un solo valor de searchParams, aunque venga como string[] */
function getParam(
  searchParams: PageProps['searchParams'],
  key: string
): string | undefined {
  const raw = searchParams?.[key];
  if (Array.isArray(raw)) return raw[0];
  return raw ?? undefined;
}

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
        if (Array.isArray(arr) && typeof arr[0] === 'string') {
          return arr[0] as string;
        }
        return null;
      } catch {
        return null;
      }
    }

    return s;
  }

  if (Array.isArray(input) && typeof input[0] === 'string') {
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

export const dynamic = 'force-dynamic';

export default async function ServicioPage({ searchParams }: PageProps) {
  const token = getParam(searchParams, 'token');
  const popupFlag = getParam(searchParams, 'popup');

  if (!token) {
    return <ErrorServicio message="El link del servicio no es válido." />;
  }

  // --- Cargar pedido por token_seguro ---
  const { data: ped, error: ePed } = await supabase
    .from('pedido')
    .select(
      'nro, telefono, total, estado, pagado, tipo_entrega, fecha_ingreso, fecha_entrega, foto_url'
    )
    .eq('token_servicio', token)
    .maybeSingle();

  if (ePed || !ped) {
    return (
      <ErrorServicio message="No se encontró el servicio asociado a este link." />
    );
  }

  const pedido = ped as PedidoRow;

  // Cliente
  let nombre = '';
  let direccion = '';
  if (pedido.telefono) {
    const { data: cli } = await supabase
      .from('clientes')
      .select('nombre,direccion')
      .eq('telefono', pedido.telefono)
      .maybeSingle();

    nombre = (cli?.nombre as string) || '';
    direccion = (cli?.direccion as string) || '';
  }

  // Líneas
  const { data: lineas } = await supabase
    .from('pedido_linea')
    .select('articulo,cantidad,valor')
    .eq('pedido_id', pedido.nro);

  const items: Linea[] =
    (lineas as any[] | null)?.map((l) => ({
      articulo: String(l.articulo || ''),
      cantidad: Number(l.cantidad ?? 0),
      valor: Number(l.valor ?? 0),
    })) ?? [];

  const totalCalc =
    items.length > 0
      ? items.reduce(
          (acc, it) =>
            acc + (Number(it.cantidad) || 0) * (Number(it.valor) || 0),
          0
        )
      : Number(pedido.total ?? 0);

  const foto = firstFotoFromMixed(pedido.foto_url);
  const esPagado = !!pedido.pagado;
  const tipoEntrega =
    (pedido.tipo_entrega || '').toUpperCase() === 'DOMICILIO'
      ? 'DOMICILIO'
      : 'LOCAL';

  const saludoNombre = nombre ? nombre.split(' ')[0].toUpperCase() : '';

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white px-3 py-6">
      {/* Script para “enmascarar” la URL después de cargar */}
      <Script id="mask-servicio-url" strategy="afterInteractive">
        {`
          try {
            const url = new URL(window.location.href);
            if (url.searchParams.get('token')) {
              url.searchParams.delete('token');
              url.searchParams.delete('popup');
              window.history.replaceState({}, '', url.toString());
            }
          } catch (e) {
            console.error('No se pudo enmascarar la URL de servicio:', e);
          }
        `}
      </Script>

      <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Cabecera */}
        <div className="px-6 pt-5 pb-3 border-b border-white/10 text-center">
          <div className="text-xs tracking-[0.25em] text-fuchsia-300 mb-1">
            LAVANDERÍA
          </div>
          <div className="text-2xl font-extrabold text-white">Fabiola</div>
          <div className="mt-2 text-[11px] text-white/60">
            Comprobante de servicio
          </div>
        </div>

        {/* Datos principales */}
        <div className="px-6 pt-4 pb-1 text-xs text-white/80 grid gap-1">
          <div className="flex justify-between">
            <span className="font-semibold">SERVICIO N°</span>
            <span className="font-bold text-white text-sm">{pedido.nro}</span>
          </div>
          {saludoNombre && (
            <div className="flex justify-between text-[11px] text-white/75">
              <span>Hola</span>
              <span className="font-semibold">{saludoNombre}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Fecha ingreso</span>
            <span>{formatFecha(pedido.fecha_ingreso)}</span>
          </div>
          <div className="flex justify-between">
            <span>Fecha entrega</span>
            <span>{formatFecha(pedido.fecha_entrega)}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Estado pago</span>
            <span className={esPagado ? 'text-emerald-300' : 'text-amber-300'}>
              {esPagado ? 'PAGADO' : 'PENDIENTE'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Tipo entrega</span>
            <span>{tipoEntrega}</span>
          </div>
        </div>

        {/* Cliente */}
        <div className="px-6 pt-3 pb-2 text-xs text-white/80">
          <div className="font-semibold mb-1">Cliente</div>
          <div className="border border-white/15 rounded-2xl px-3 py-2 bg-slate-900/60">
            <div className="font-bold text-[13px] truncate">
              {nombre || 'SIN NOMBRE'}
            </div>
            <div className="text-[11px] truncate">
              {direccion || 'SIN DIRECCIÓN'}
            </div>
            <div className="text-[11px] text-white/60 mt-1">
              Teléfono: {pedido.telefono || '—'}
            </div>
          </div>
        </div>

        {/* Detalle */}
        <div className="px-6 pt-2 pb-2 text-xs text-white/85">
          <div className="font-semibold mb-1">Detalle del servicio</div>
          <div className="border border-white/15 rounded-2xl overflow-hidden bg-slate-900/60">
            <table className="w-full text-[11px]">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-3 py-1.5 w-[48%]">Artículo</th>
                  <th className="text-right px-2 py-1.5 w-[14%]">Can.</th>
                  <th className="text-right px-2 py-1.5 w-[18%]">Valor</th>
                  <th className="text-right px-3 py-1.5 w-[20%]">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.length ? (
                  items.map((it, i) => (
                    <tr
                      key={i}
                      className="border-t border-white/8 last:border-b border-b-white/8"
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
                      className="px-3 py-3 text-center text-white/60"
                    >
                      Sin artículos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="px-3 py-2 bg-white/5 text-right text-[12px] font-extrabold">
              Total: {CLP.format(totalCalc)}
            </div>
          </div>
        </div>

        {/* Foto (opcional, pequeña) */}
        {foto && (
          <div className="px-6 pt-2 pb-4">
            <div className="text-xs text-white/70 mb-1">
              Referencia visual del pedido
            </div>
            <div className="border border-white/15 rounded-2xl overflow-hidden bg-black/50">
              <Image
                src={foto}
                alt={`Foto pedido ${pedido.nro}`}
                width={600}
                height={400}
                className="w-full h-auto"
              />
            </div>
          </div>
        )}

        {/* Nota final */}
        <div className="px-6 pb-5 pt-2 text-[10px] text-center text-white/50 border-t border-white/10">
          Solo válido como comprobante de servicio de Lavandería Fabiola.
          {popupFlag && <> (Vista enviada por WhatsApp)</>}
        </div>
      </div>
    </main>
  );
}
