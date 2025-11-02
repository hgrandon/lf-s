// app/menu/page.tsx (SERVER COMPONENT)
import type { Metadata, Viewport } from 'next';
import Logo from '@/app/components/Logo';
import MenuClient from './MenuClient';

export const metadata: Metadata = {
  title: 'Menú principal',
  description: 'Panel de acceso rápido a las funciones de Lavandería Fabiola.',
};

export const viewport: Viewport = {
  themeColor: '#7c3aed',
};

export default function MenuPage() {
  return (
    <main className="relative min-h-dvh bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white antialiased">
      {/* capa de luz sutil */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" />

      {/* link accesible para saltar directo al menú */}
      <a
        href="#menu-grid"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white/90 focus:text-violet-800 focus:px-3 focus:py-2"
      >
        Ir al menú
      </a>

      {/* HEADER */}
      <header className="relative z-10 mx-auto max-w-6xl px-6 pt-8 sm:pt-10">
        <Logo size={56} showName boxed className="mb-6" />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight drop-shadow">
            Menú Principal
          </h1>
          <p className="text-white/85">
            Selecciona una opción para continuar.
          </p>
        </div>
      </header>

      {/* CONTENIDO (tarjeta contenedora para el grid) */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-[88px] sm:pb-10 pt-6">
        <div
          id="menu-grid"
          className="
            rounded-2xl border border-white/15 bg-white/10
            shadow-[0_12px_32px_rgba(0,0,0,0.25)]
            backdrop-blur-md px-4 sm:px-6 py-5 sm:py-6
          "
          aria-label="Opciones del menú"
        >
          <MenuClient />
        </div>
      </section>

      {/* SAFE-AREA bottom para que no choque con barras del sistema en móviles */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </main>
  );
}





