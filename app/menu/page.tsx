// app/menu/page.tsx (SERVER COMPONENT)
import type { Metadata } from 'next';
import Logo from '@/app/components/Logo';
import MenuClient from './MenuClient';

export const metadata: Metadata = {
  title: 'Menú principal',
};

export default function MenuPage() {
  return (
    <main className="relative min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" />

      {/* ÚNICO encabezado */}
      <header className="relative z-10 mx-auto max-w-6xl px-6 pt-10">
        <Logo size={56} showName boxed className="mb-6" />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-3xl font-bold">Menú Principal</h1>
          <p className="text-white/80">Selecciona una opción para continuar.</p>
        </div>
      </header>

      {/* Solo grilla, sin títulos ni logo adicional */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        <MenuClient />
      </section>
    </main>
  );
}




