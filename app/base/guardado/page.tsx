'use client';

import { useRouter } from 'next/navigation';
import { Home, Truck, ChevronRight } from 'lucide-react';

export default function GuardadoMenuPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white pb-24 pt-16 lg:pt-20">
      {/* brillo fondo */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" />

      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4 lg:px-10 py-3 lg:py-4 bg-gradient-to-r from-violet-800/95 via-fuchsia-700/95 to-indigo-800/95 backdrop-blur-md border-b border-white/10">
        <h1 className="font-bold text-base lg:text-xl">Guardado</h1>
        <button
          onClick={() => router.push('/base')}
          className="text-xs lg:text-sm text-white/90 hover:text-white"
        >
          ← Volver
        </button>
      </header>

      {/* CONTENIDO */}
      <section className="relative z-10 w-full px-4 sm:px-6 lg:px-10 pt-4 lg:pt-6">
        <p className="mb-4 text-sm text-white/85">
          Selecciona el tipo de entrega que quieres revisar:
        </p>

        <div className="grid gap-4 sm:grid-cols-2 max-w-3xl">
          {/* TARJETA LOCAL */}
          <button
            onClick={() => router.push('/base/guardado/local')}
            className="group rounded-2xl bg-white/10 border border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.3)] p-4 lg:p-5 flex flex-col gap-2 hover:bg-white/15 hover:border-white/40 transition"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-emerald-500/90 border border-emerald-300/70 shadow-[0_0_0_3px_rgba(16,185,129,0.35)]">
                  <Home size={22} />
                </span>
                <div className="text-left">
                  <h2 className="font-extrabold text-base lg:text-lg">
                    Guardado Local
                  </h2>
                  <p className="text-[11px] lg:text-xs text-white/80">
                    Pedido guardado para retiro en local (o sin tipo de entrega).
                  </p>
                </div>
              </div>
              <ChevronRight
                size={20}
                className="text-white/70 group-hover:translate-x-1 transition-transform"
              />
            </div>
            <div className="mt-2 text-[11px] lg:text-xs text-white/75">
              Verás todos los pedidos en estado <b>GUARDADO</b> que no son
              domicilio.
            </div>
          </button>

          {/* TARJETA DOMICILIO */}
          <button
            onClick={() => router.push('/base/guardado/domicilio')}
            className="group rounded-2xl bg-white/10 border border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.3)] p-4 lg:p-5 flex flex-col gap-2 hover:bg-white/15 hover:border-white/40 transition"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-sky-500/90 border border-sky-300/70 shadow-[0_0_0_3px_rgba(56,189,248,0.35)]">
                  <Truck size={22} />
                </span>
                <div className="text-left">
                  <h2 className="font-extrabold text-base lg:text-lg">
                    Guardado Domicilio
                  </h2>
                  <p className="text-[11px] lg:text-xs text-white/80">
                    Pedido guardado para despacho a domicilio.
                  </p>
                </div>
              </div>
              <ChevronRight
                size={20}
                className="text-white/70 group-hover:translate-x-1 transition-transform"
              />
            </div>
            <div className="mt-2 text-[11px] lg:text-xs text-white/75">
              Verás todos los pedidos en estado <b>GUARDADO</b> con tipo de entrega{' '}
              <b>DOMICILIO</b>.
            </div>
          </button>
        </div>
      </section>
    </main>
  );
}
