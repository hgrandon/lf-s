// app/menu/page.tsx
import type { Metadata } from 'next';
import MenuClient from './MenuClient';
import Logo from '@/app/components/Logo';

export const metadata: Metadata = {
  title: 'Menú Principal | Lavandería Fabiola',
};

export default function MenuPage() {
  return (
    <main className="relative min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white overflow-hidden">
      {/* Capa sutil de brillo */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" />

      {/* Encabezado */}
      <header className="relative z-10 mx-auto flex flex-col items-center justify-center pt-10 text-center">
        <Logo
          className="mb-3"
          title="Lavandería Fabiola"
        />
        <h1 className="text-3xl md:text-4xl font-bold tracking-wide">
          Menú Principal
        </h1>
        <p className="text-white/80 mt-2 text-sm md:text-base">
          Selecciona una opción para continuar
        </p>
      </header>

      {/* Sección del menú */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        <MenuClient />
      </section>
    </main>
  );
}



