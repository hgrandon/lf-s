import { Loader2, Phone, Pencil } from 'lucide-react';

export type Cliente = { telefono: string; nombre: string; direccion: string };

type Props = {
  telefono: string;
  onTelefonoChange: (v: string) => void;
  checkingCli: boolean;
  cliente: Cliente | null;
  /** Se llama cuando se quiere editar nombre/dirección del cliente */
  onEditarCliente?: () => void;
};

export default function Telefono({
  telefono,
  onTelefonoChange,
  checkingCli,
  cliente,
  onEditarCliente,
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
        <div className="mt-2 flex items-start justify-between gap-2 text-white/90 text-sm">
          <div>
            <div className="font-semibold uppercase">
              {cliente.nombre || 'SIN NOMBRE'}
            </div>
            <div className="uppercase">
              {cliente.direccion || 'SIN DIRECCIÓN'}
            </div>
          </div>

          {onEditarCliente && (
            <button
              type="button"
              onClick={onEditarCliente}
              className="shrink-0 mt-1 rounded-full bg-white/15 hover:bg-white/25 p-2"
              title="Editar cliente"
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
