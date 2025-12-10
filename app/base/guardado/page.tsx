// app/base/guardado/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { Archive, Home, Truck } from 'lucide-react';

const TITULO = 'Pedidos Guardados';

export default function GuardadoPage() {
  const router = useRouter();

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white">
      {/* Glow de fondo */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* HEADER */}
      <header
        className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between
                   px-4 lg:px-10 py-3 lg:py-4
                   bg-gradient-to-r from-violet-800/95 via-fuchsia-700/95 to-indigo-800/95
                   backdrop-blur-md border-b border-white/10"
      >
        <h1 className="font-bold text-base lg:text-xl flex items-center gap-2">
          <Archive size={18} />
          {TITULO}
        </h1>
        <button
          onClick={() => router.push('/base')}
          className="text-xs lg:text-sm text-white/90 hover:text-white"
        >
          ← Volver a BASE
        </button>
      </header>

      {/* CONTENIDO */}
      <section className="relative z-10 pt-20 lg:pt-24 pb-10 px-4 sm:px-6 lg:px-10">
        <p className="text-sm text-white/80 mb-4">
          Elige qué pedidos guardados quieres ver:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          {/* CARD LOCAL */}
          <button
            onClick={() => router.push('/base/guardado/local')}
            className="group rounded-2xl bg-white/10 border border-white/20 
                       p-4 flex flex-col items-start gap-3
                       hover:bg-white/15 hover:border-white/40 transition shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full bg-emerald-500/90 flex items-center justify-center
                           shadow-[0_0_0_3px_rgba(16,185,129,0.35)]"
              >
                <Home size={20} />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm tracking-wide uppercase">
                  Guardado Local
                </div>
                <div className="text-xs text-white/75">
                  Pedidos listos en tienda para retiro.
                </div>
              </div>
            </div>
            <span className="mt-1 inline-flex text-[11px] text-emerald-100/90">
              Ver pedidos con tipo de entrega LOCAL o sin tipo.
            </span>
          </button>

          {/* CARD DOMICILIO */}
          <button
            onClick={() => router.push('/base/guardado/domicilio')}
            className="group rounded-2xl bg-white/10 border border-white/20 
                       p-4 flex flex-col items-start gap-3
                       hover:bg-white/15 hover:border-white/40 transition shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full bg-sky-500/90 flex items-center justify-center
                           shadow-[0_0_0_3px_rgba(56,189,248,0.35)]"
              >
                <Truck size={20} />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm tracking-wide uppercase">
                  Guardado Domicilio
                </div>
                <div className="text-xs text-white/75">
                  Pedidos listos para despacho a domicilio.
                </div>
              </div>
            </div>
            <span className="mt-1 inline-flex text-[11px] text-sky-100/90">
              Ver pedidos con tipo de entrega DOMICILIO.
            </span>
          </button>
        </div>

        <p className="mt-6 text-[11px] text-white/60 max-w-xl">
          Desde cada vista podrás cambiar el estado del pedido (LAVAR, LAVANDO,
          ENTREGAR, ENTREGADO), marcar como pagado, agregar o cambiar foto y
          enviar comprobante por WhatsApp.
        </p>
      </section>
    </main>
  );
}
