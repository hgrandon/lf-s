// app/pedido/telefono/Telefono.tsx
import { Loader2, Phone } from 'lucide-react';

export type Cliente = { telefono: string; nombre: string; direccion: string };

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
    <div className="mt-4">
      <label className="sr-only" htmlFor="tel">
        Teléfono del cliente
      </label>
      <div className="relative max-w-md">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/80">
          {checkingCli ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Phone size={16} />
          )}
        </div>
        <input
          id="tel"
          value={telefono}
          onChange={(e) => onTelefonoChange(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="9 dígitos..."
          className="w-full rounded-xl bg-white/10 border border-white/20 pl-9 pr-3 py-3 text-2xl text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-white/30"
        />
      </div>
      {cliente && (
        <div className="mt-2 text-white/90 text-sm">
          <div className="font-semibold uppercase">
            {cliente.nombre || 'SIN NOMBRE'}
          </div>
          <div className="uppercase">
            {cliente.direccion || 'SIN DIRECCIÓN'}
          </div>
        </div>
      )}
    </div>
  );
}
