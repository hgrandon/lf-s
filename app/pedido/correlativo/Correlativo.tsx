// app/pedido/telefono/Telefono.tsx
'use client';

import { Phone } from 'lucide-react';

export type Cliente = {
  telefono: string;
  nombre: string | null;
  direccion: string | null;
};

type Props = {
  telefono: string;
  onTelefonoChange: (v: string) => void;
  checkingCli: boolean;
  cliente: Cliente | null;
};

export default function Telefono({
  telefono,
  onTelefonoChange,
  checkingCli,
  cliente,
}: Props) {
  return (
    <section className="mt-4 max-w-md">
      <div className="relative">
        {/* Ícono teléfono */}
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
          <Phone size={22} className="text-white" />
        </span>

        {/* Input grande */}
        <input
          value={telefono}
          onChange={(e) =>
            onTelefonoChange(e.target.value.replace(/\D/g, ''))
          }
          inputMode="tel"
          maxLength={9}
          placeholder="9 dígitos..."
          className="w-full rounded-[999px] border-4 border-white bg-transparent px-11 py-2.5 text-center text-2xl font-extrabold tracking-[0.25em] text-white placeholder:text-white/60 outline-none"
        />
      </div>

      {/* Info del cliente debajo */}
      <div className="mt-2 text-xs text-white/90 min-h-[1.4rem]">
        {checkingCli && <span>Buscando cliente...</span>}
        {!checkingCli && cliente && (
          <div className="space-y-0.5">
            <div className="font-semibold">{cliente.nombre}</div>
            <div className="text-[11px]">{cliente.direccion}</div>
          </div>
        )}
      </div>
    </section>
  );
}
