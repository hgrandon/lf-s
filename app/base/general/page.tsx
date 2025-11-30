'use client';

import { useRouter } from 'next/navigation';
import {
  Droplet,
  WashingMachine,
  Archive,
  Truck,
  PackageCheck,
  PlusCircle,
  Search,
} from 'lucide-react';

export default function BasePage() {
  const router = useRouter();

  function goEstado(estado: string) {
    router.push(`/base/general?estado=${encodeURIComponent(estado)}`);
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-violet-900 via-fuchsia-800 to-indigo-900 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" />

      <header className="relative z-10 px-6 pt-6 pb-4 flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-wide">Base de Pedidos</h1>
        <button
          onClick={() => router.push('/menu')}
          className="text-xs sm:text-sm text-white/80 hover:text-white"
        >
          ← Menú principal
        </button>
      </header>

      <section className="relative z-10 px-4 sm:px-6 pb-24">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <CardEstado
            label="Nuevo pedido"
            subtitulo="Crear pedido"
            Icon={PlusCircle}
            onClick={() => router.push('/pedido')}
          />

          <CardEstado
            label="Lavar"
            subtitulo="En cola"
            Icon={Droplet}
            onClick={() => goEstado('LAVAR')}
          />

          <CardEstado
            label="Lavando"
            subtitulo="En proceso"
            Icon={WashingMachine}
            onClick={() => goEstado('LAVANDO')}
          />

          <CardEstado
            label="Guardado"
            subtitulo="Listo en bodega"
            Icon={Archive}
            onClick={() => goEstado('GUARDADO')}
          />

          <CardEstado
            label="Entregar"
            subtitulo="Pendiente entrega"
            Icon={Truck}
            onClick={() => goEstado('ENTREGAR')}
          />

          <CardEstado
            label="Entregado"
            subtitulo="Histórico reciente"
            Icon={PackageCheck}
            onClick={() => goEstado('ENTREGADO')}
          />

          <CardEstado
            label="Buscar / Editar"
            subtitulo="Por número"
            Icon={Search}
            onClick={() => router.push('/editar')}
          />
        </div>
      </section>
    </main>
  );
}

function CardEstado({
  label,
  subtitulo,
  Icon,
  onClick,
}: {
  label: string;
  subtitulo?: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md px-4 py-4 sm:py-5 flex flex-col items-start gap-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:bg-white/15 hover:border-white/40 hover:-translate-y-0.5 transition-all"
    >
      <div className="inline-flex items-center justify-center rounded-2xl bg-white/15 p-2 shadow-inner">
        <Icon size={26} className="text-fuchsia-200 group-hover:text-white" />
      </div>
      <div className="text-left">
        <div className="text-sm sm:text-base font-semibold leading-tight">
          {label}
        </div>
        {subtitulo && (
          <div className="text-[0.7rem] sm:text-xs text-white/80 mt-0.5">
            {subtitulo}
          </div>
        )}
      </div>
    </button>
  );
}
