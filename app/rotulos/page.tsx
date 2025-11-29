// app/rotulos/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, Printer } from 'lucide-react';
import Image from 'next/image';

type EstadoKey = 'LAVAR' | 'LAVANDO';

type PedidoDB = {
  nro: number;
  total: number | null;
  estado: string | null;
  telefono: string | null;
};

type ClienteDB = {
  telefono: string;
  nombre: string | null;
};

type RotuloPedido = {
  nro: number;
  total: number;
  estado: EstadoKey;
  telefono: string;
  nombre: string;
};

export default function RotulosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<RotuloPedido[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // 1) Pedidos en LAVAR / LAVANDO
        const { data: pedData, error: pedErr } = await supabase
          .from('pedido')
          .select('nro,total,estado,telefono')
          .in('estado', ['LAVAR', 'LAVANDO'])
          .order('nro', { ascending: true });

        if (pedErr) throw pedErr;

        const pedidosRaw = (pedData as PedidoDB[]) || [];
        if (!pedidosRaw.length) {
          setPedidos([]);
          return;
        }

        // 2) Buscar nombres de clientes por teléfono en un solo query
        const telefonos = Array.from(
          new Set(
            pedidosRaw
              .map((p) => (p.telefono || '').replace(/\D/g, ''))
              .filter((t) => t.length)
          )
        );

        let mapaClientes: Record<string, string> = {};
        if (telefonos.length) {
          const { data: cliData, error: cliErr } = await supabase
            .from('clientes')
            .select('telefono,nombre')
            .in('telefono', telefonos);

          if (cliErr) throw cliErr;

          mapaClientes = (cliData as ClienteDB[]).reduce(
            (acc, c) => {
              const tel = (c.telefono || '').replace(/\D/g, '');
              if (tel) acc[tel] = (c.nombre || '').toString().toUpperCase();
              return acc;
            },
            {} as Record<string, string>
          );
        }

        const normalizados: RotuloPedido[] = pedidosRaw
          .map((p) => {
            const estado = (p.estado || '').trim().toUpperCase() as EstadoKey;
            if (estado !== 'LAVAR' && estado !== 'LAVANDO') return null;

            const tel = (p.telefono || '').replace(/\D/g, '');
            const nombre = mapaClientes[tel] || 'SIN NOMBRE';

            return {
              nro: Number(p.nro),
              total: Number(p.total || 0),
              estado,
              telefono: tel,
              nombre,
            };
          })
          .filter(Boolean) as RotuloPedido[];

        setPedidos(normalizados);
      } catch (e: any) {
        console.error(e);
        setErr(e?.message ?? 'No se pudieron cargar los rótulos');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalPedidos = useMemo(() => pedidos.length, [pedidos]);

  const handlePrint = () => {
    if (!pedidos.length) {
      alert('No hay pedidos en LAVAR o LAVANDO para imprimir.');
      return;
    }
    window.print();
  };

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white pb-24">
      {/* Estilos especiales para impresión: sólo rótulos blancos, tamaño similar a ejemplo */}
      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
          .rotulos-wrapper {
            padding: 0 !important;
            margin: 0 !important;
          }
          .rotulo-item {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* HEADER (no se imprime) */}
      <header className="no-print relative z-10 flex items-center justify-between px-4 py-4 max-w-6xl mx-auto">
        <div>
          <h1 className="font-bold text-xl sm:text-2xl">Rótulos de Lavandería</h1>
          <p className="text-sm text-white/80">
            Pedidos en estado <span className="font-semibold">LAVAR</span> o{' '}
            <span className="font-semibold">LAVANDO</span>
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handlePrint}
            disabled={loading || !pedidos.length}
            className="inline-flex items-center gap-2 rounded-xl bg-white text-violet-800 px-3 py-2 text-sm font-semibold shadow hover:bg-violet-50 disabled:opacity-60"
          >
            <Printer size={16} />
            Imp. Rótulos
          </button>
          <button
            onClick={() => router.push('/base')}
            className="text-sm text-white/90 hover:text-white"
          >
            ← Volver
          </button>
        </div>
      </header>

      {/* ERRORES (no se imprime) */}
      {err && (
        <div className="no-print relative z-10 mx-auto max-w-6xl px-4">
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-red-100">
            <AlertTriangle size={16} />
            <span>{err}</span>
          </div>
        </div>
      )}

      {/* CONTENIDO: LISTA DE RÓTULOS */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 rotulos-wrapper">
        {loading && (
          <div className="no-print mt-10 flex items-center justify-center gap-2 text-sm">
            <Loader2 className="animate-spin" size={18} />
            Cargando pedidos…
          </div>
        )}

        {!loading && !pedidos.length && (
          <div className="no-print mt-10 text-center text-sm">
            No hay pedidos en LAVAR o LAVANDO.
          </div>
        )}

        {/* Cada rótulo: diseño lo más parecido a la imagen de ejemplo */}
        <div className="mt-6 flex flex-col items-center gap-4">
          {pedidos.map((p, idx) => {
            // Por ahora siempre 1/1 (más adelante lo cambiaremos con el modal de bolsas)
            const numeroFraccion = `1/1`;

            return (
              <div
                key={p.nro + '-' + idx}
                className="
                  rotulo-item
                  relative
                  bg-white
                  text-violet-800
                  border-[2px]
                  border-black
                  rounded-sm
                  px-4
                  py-2
                  w-full
                  max-w-3xl
                  shadow-sm
                  print:shadow-none
                "
              >
                {/* Contenido principal: logo + nombre + nro + fracción */}
                <div className="flex items-center gap-3">
                  {/* LOGO IZQUIERDO */}
                  <div className="flex-shrink-0 flex flex-col items-center justify-center">
                    <div className="w-14 h-10 relative">
                      <Image
                        src="/logo.png" // ajusta al nombre real de tu logo
                        alt="Lavandería Fabiola"
                        fill
                        style={{ objectFit: 'contain' }}
                      />
                    </div>
                    <span className="mt-1 text-[0.55rem] tracking-[0.12em] font-semibold uppercase">
                      LAVANDERÍA
                    </span>
                  </div>

                  {/* CENTRO: NOMBRE + NRO */}
                  <div className="flex-1 text-center">
                    <div className="text-sm font-extrabold tracking-[0.18em] uppercase">
                      {p.nombre || 'SIN NOMBRE'}
                    </div>
                    <div className="leading-none mt-1">
                      <span className="text-4xl sm:text-5xl font-extrabold tracking-tight">
                        {p.nro}
                      </span>
                    </div>
                  </div>

                  {/* DERECHA: fracción (por ahora 1/1) */}
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xl sm:text-2xl font-extrabold tracking-tight">
                      {numeroFraccion}
                    </div>
                  </div>
                </div>

                {/* LÍNEA INFERIOR: monto + texto lavandería */}
                <div className="mt-2 border-t border-black pt-1 flex items-center justify-between">
                  <div className="text-xs flex items-center gap-1">
                    <span className="font-semibold">$</span>
                    <span className="font-semibold">
                      {p.total.toLocaleString('es-CL')}
                    </span>
                  </div>
                  <div className="text-[0.65rem] tracking-[0.18em] font-extrabold uppercase">
                    LAVANDERÍA FABIOLA
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* pequeño resumen (no-print) */}
        {totalPedidos > 0 && (
          <p className="no-print mt-4 text-center text-xs text-white/80">
            Se muestran {totalPedidos} rótulo(s) listos para imprimir.
          </p>
        )}
      </section>
    </main>
  );
}
