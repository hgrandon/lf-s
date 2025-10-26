// app/menu/page.tsx
import type { Metadata } from 'next';
import MenuClient from './MenuClient';
import Logo from '@/app/components/Logo';

export const metadata: Metadata = {
  title: 'Menú',
};

export default function MenuPage() {
  return (
    <main className="relative min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white">
      {/* brillo sutil */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" />

      {/* Encabezado ÚNICO */}
      <header className="relative z-10 mx-auto max-w-6xl px-6 pt-10">
        <Logo size={64} showName boxed className="mb-6" />
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-bold">Menú Principal</h1>
          <p className="text-white/80">Selecciona una opción para continuar.</p>
        </div>
      </header>

      {/* Contenido (solo la grilla) */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        <MenuClient />
      </section>
    </main>
  );
}




