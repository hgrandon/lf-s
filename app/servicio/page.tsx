// app/servicio/page.tsx
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

type PedidoEstado =
  | 'LAVAR'
  | 'LAVANDO'
  | 'GUARDAR'
  | 'GUARDADO'
  | 'ENTREGADO'
  | 'ENTREGAR';

type PedidoRow = {
  id: number;
  nro: number | null;
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

// toma primera foto desde string o JSON
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

export default async function ServicioPage({ searchParams }: PageProps) {
  const nroParam = searchParams?.nro;
  const nroStr = Array.isArray(nroParam) ? nroParam[0] : nroParam;
  const nroNumero = Number(nroStr);

  if (!nroNumero || Number.isNaN(nroNumero)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Servicio no válido</h1>
          <p className="text-sm text-white/70">El número de pedido no es correcto.</p>
        </div>
      </main>
    );
  }

  // 1° intento: buscar por nro
  let pedResp = await supabase
    .from('pedido')
    .select(
      'id, nro, telefono, total, estado, pagado, tipo_entrega, fecha_ingreso, fecha_entrega, foto_url'
    )
    .eq('nro', nroNumero)
    .maybeSingle();

  // 2° intento (fallback): buscar por id si no encontró por nro
  if (!pedResp.data && !pedResp.error) {
    pedResp = await supabase
      .from('pedido')
      .select(
        'id, nro, telefono, total, estado, pagado, tipo_entrega, fecha_ingreso, fecha_entrega, foto_url'
      )
      .eq('id', nroNumero)
      .maybeSingle();
  }

  const ped = pedResp.data;

  if (pedResp.error || !ped) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Servicio no válido</h1>
          <p className="text-sm text-white/70">
            No se encontró el pedido #{nroNumero}.
          </p>
        </div>
      </main>
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

  const primerNombre =
    nombre && nombre.trim().length > 0 ? nombre.trim().split(' ')[0] : 'Cliente';

  // Líneas
  const { data: lineas } = await supabase
    .from('pedido_linea')
    .select('articulo,cantidad,valor')
    .eq('pedido_id', pedido.nro ?? pedido.id);

  const items: Linea[] =
    (lineas as any[])?.map((l) => ({
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

  const numeroVisible = pedido.nro ?? pedido.id;

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-200 px-2 py-6">
      <div className="w-full max-w-3xl bg-white shadow-2xl border border-slate-300 rounded-xl overflow-hidden">
        {/* CABECERA CON LOGO Y NÚMERO */}
        <div className="flex flex-col md:flex-row items-center justify-between px-6 pt-4 pb-3 border-b border-violet-300">
          <div className="flex items-center gap-3 mb-3 md:mb-0">
            {/* Logo (opcional) */}
            <div className="h-14 w-14 relative">
              <Image
                src="/logo.png"
                alt="Lavandería Fabiola"
                fill
                className="object-contain"
              />
            </div>
            <div className="leading-tight">
              <div className="text-[11px] tracking-[0.25em] text-violet-700 font-semibold">
                TU N° SERVICIO
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Lavandería Fabiola
              </div>
            </div>
          </div>

          <div className="text-center md:text-right">
            <div className="text-[11px] uppercase tracking-[0.25em] text-violet-600 font-semibold mb-1">
              SERVICIO
            </div>
            <div className="text-5xl font-black text-violet-800 leading-none">
              {numeroVisible}
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-emerald-600 text-xs font-bold">
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-emerald-500 bg-emerald-50">
                LISTO
              </span>
            </div>
          </div>
        </div>

        {/* MENSAJE PRINCIPAL */}
        <div className="px-6 pt-4 text-center">
          <p className="text-xl md:text-2xl font-extrabold text-violet-800 mb-1">
            Hola {primerNombre}, servicio listo, por favor
          </p>
          <p className="text-lg md:text-xl font-bold text-violet-700 mb-2">
            Necesitamos pase a retirar
          </p>
          <p className="text-sm md:text-base text-slate-700 mb-1">
            Atención de Lunes a Viernes de 10:00 a 20:00 hrs.
          </p>
          <p className="text-sm md:text-base text-slate-800 font-semibold mb-4">
            Te esperamos en nuestro local<br />
            Periodista Mario Peña Carreño #5304
          </p>
        </div>

        {/* VALOR SERVICIO + ESTADO PAGO */}
        <div className="px-6 mt-2 mb-4">
          <div className="border border-slate-400 rounded-md overflow-hidden">
            <div className="grid grid-cols-3 md:grid-cols-4">
              <div className="col-span-2 flex items-center justify-center bg-white">
                <span className="text-lg font-bold text-violet-800">
                  Valor Servicio
                </span>
              </div>
              <div className="col-span-1 flex items-center justify-center border-l border-slate-400 bg-white">
                <span className="text-lg font-bold text-violet-800">$</span>
              </div>
              <div className="col-span-1 flex items-center justify-center bg-violet-700 text-white text-xl font-extrabold">
                {CLP.format(totalCalc)}
              </div>
            </div>

            <div className="grid grid-cols-3 border-t border-slate-400">
              <div className="col-span-1 flex items-center justify-center text-xs md:text-sm font-semibold text-slate-600 bg-slate-100">
                PAGO
              </div>
              <div className="col-span-2 flex items-center justify-center text-sm md:text-base font-extrabold text-white"
                   style={{
                     backgroundColor: esPagado ? '#16a34a' : '#dc2626',
                   }}>
                {esPagado ? 'PAGADO' : 'PENDIENTE'}
              </div>
            </div>
          </div>
        </div>

        {/* DETALLE DEL SERVICIO */}
        <div className="px-6 mb-4">
          <div className="text-center font-extrabold text-violet-800 mb-2">
            GRACIAS POR SU PREFERENCIA
          </div>

          <div className="text-xs font-semibold bg-violet-800 text-white text-center py-1">
            DETALLE
          </div>

          <div className="border border-violet-800 border-t-0">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-violet-100 text-violet-900">
                  <th className="px-2 py-1 text-left w-[50%]">DESCRIPCIÓN SERVICIO</th>
                  <th className="px-2 py-1 text-center w-[10%]">CANTIDAD</th>
                  <th className="px-2 py-1 text-right w-[20%]">VALOR</th>
                  <th className="px-2 py-1 text-right w-[20%]">SUB TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {items.length ? (
                  items.map((it, idx) => (
                    <tr
                      key={idx}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-violet-50'}
                    >
                      <td className="px-2 py-1 text-left">
                        {it.articulo || '—'}
                      </td>
                      <td className="px-2 py-1 text-center">
                        {it.cantidad ?? 0}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {CLP.format(it.valor ?? 0)}
                      </td>
                      <td className="px-2 py-1 text-right">
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
                      className="px-2 py-2 text-center text-slate-500"
                    >
                      Sin artículos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SOLO EFECTIVO */}
        <div className="px-6 mb-4">
          <div className="w-full text-center py-2 text-lg md:text-xl font-extrabold bg-yellow-400 text-red-600">
            SOLO PAGO EFECTIVO
          </div>
        </div>

        {/* Datos cliente + tipo entrega */}
        <div className="px-6 mb-4 text-xs md:text-sm">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="border border-slate-300 rounded-md px-3 py-2">
              <div className="font-semibold text-slate-700 mb-1">
                Datos del cliente
              </div>
              <div className="text-slate-800 font-bold">
                {nombre || 'SIN NOMBRE'}
              </div>
              <div className="text-slate-700">
                {direccion || 'SIN DIRECCIÓN'}
              </div>
              <div className="text-slate-600 mt-1">
                Teléfono: {pedido.telefono || '—'}
              </div>
            </div>
            <div className="border border-slate-300 rounded-md px-3 py-2">
              <div className="font-semibold text-slate-700 mb-1">
                Información adicional
              </div>
              <div className="flex justify-between">
                <span>Fecha ingreso:</span>
                <span className="font-semibold">
                  {formatFecha(pedido.fecha_ingreso)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Fecha entrega:</span>
                <span className="font-semibold">
                  {formatFecha(pedido.fecha_entrega)}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Tipo entrega:</span>
                <span className="font-semibold">{tipoEntrega}</span>
              </div>
            </div>
          </div>
        </div>

        {/* FOTO OPCIONAL */}
        {foto && (
          <div className="px-6 mb-4">
            <div className="text-xs text-slate-600 mb-1">
              Referencia visual del pedido
            </div>
            <div className="border border-slate-300 rounded-md overflow-hidden">
              <Image
                src={foto}
                alt={`Foto pedido ${numeroVisible}`}
                width={800}
                height={500}
                className="w-full h-auto"
              />
            </div>
          </div>
        )}

        {/* PIE DE PÁGINA */}
        <div className="px-6 pb-4 pt-2 text-[10px] text-center text-slate-500 border-t border-slate-200">
          Comprobante generado por Lavandería Fabiola. Uso exclusivo informativo
          para el cliente.
        </div>
      </div>
    </main>
  );
}
