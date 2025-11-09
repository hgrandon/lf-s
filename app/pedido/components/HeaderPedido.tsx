'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NuevoClienteModal from './NuevoClienteModal';
import { Phone } from 'lucide-react';

type Cliente = {
  telefono: string;
  nombre: string | null;
  direccion: string | null;
};

type Props = {
  /** Número de pedido mostrado en el encabezado */
  pedidoId: number;
  /** Teléfono controlado desde la página (si existe). Si no se pasa, el componente lo maneja internamente. */
  telefono?: string;
  /** Setter opcional si la página controla el teléfono */
  onTelefonoChange?: (t: string) => void;
  /** Callback para notificar que se cargó/creó un cliente (tel/nombre/dirección) */
  onClienteCargado?: (cli: { telefono: string; nombre: string; direccion: string }) => void;
  /** Fechas visibles en el header */
  fechaIngresoISO?: string;
  fechaEntregaISO?: string;
};

export default function HeaderPedido({
  pedidoId,
  telefono,
  onTelefonoChange,
  onClienteCargado,
  fechaIngresoISO,
  fechaEntregaISO,
}: Props) {
  // Si el padre no controla, usamos estado interno
  const [telLocal, setTelLocal] = useState(telefono ?? '');
  const tel = typeof telefono === 'string' ? telefono : telLocal;

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [checking, setChecking] = useState(false);
  const [openNuevo, setOpenNuevo] = useState(false);

  const debTimer = useRef<number | null>(null);

  // Mantener sincronía si el padre cambia el teléfono
  useEffect(() => {
    if (typeof telefono === 'string') setTelLocal(telefono);
  }, [telefono]);

  // Busca cliente por teléfono (debounced)
  useEffect(() => {
    if (!tel || tel.replace(/\D/g, '').length < 8) {
      setCliente(null);
      return;
    }

    if (debTimer.current) window.clearTimeout(debTimer.current);
    debTimer.current = window.setTimeout(async () => {
      try {
        setChecking(true);
        const { data, error } = await supabase
          .from('clientes')
          .select('telefono,nombre,direccion')
          .eq('telefono', tel)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          const found = {
            telefono: String(data.telefono),
            nombre: (data.nombre ?? '') as string,
            direccion: (data.direccion ?? '') as string,
          };
          setCliente(found);
          onClienteCargado?.({
            telefono: found.telefono,
            nombre: found.nombre || '',
            direccion: found.direccion || '',
          });
        } else {
          // No existe → mostrar modal para crear
          setCliente(null);
          setOpenNuevo(true);
        }
      } catch (e) {
        console.error('Error consultando cliente:', e);
      } finally {
        setChecking(false);
      }
    }, 450);

    // cleanup
    return () => {
      if (debTimer.current) window.clearTimeout(debTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tel]);

  function handleTelChange(v: string) {
    const onlyDigits = v.replace(/\D/g, '');
    if (onTelefonoChange) onTelefonoChange(onlyDigits);
    else setTelLocal(onlyDigits);
  }

  const fechaIng = useMemo(() => {
    if (!fechaIngresoISO) return '';
    try {
      const d = new Date(fechaIngresoISO);
      return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }, [fechaIngresoISO]);

  const fechaEnt = useMemo(() => {
    if (!fechaEntregaISO) return '';
    try {
      const d = new Date(fechaEntregaISO);
      return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }, [fechaEntregaISO]);

  return (
    <>
      {/* Header visual */}
      <div className="relative mb-4">
        <div className="flex items-start justify-between">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">N° {pedidoId}</h1>
          <div className="text-right text-white/90">
            {fechaIngresoISO && <div className="text-xl sm:text-2xl">{fechaIng}</div>}
            {fechaEntregaISO && <div className="text-xl sm:text-2xl">{fechaEnt}</div>}
          </div>
        </div>

        {/* Teléfono */}
        <div className="mt-4">
          <div className="relative max-w-md">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/80">
              <Phone size={16} />
            </div>
            <input
              value={tel}
              onChange={(e) => handleTelChange(e.target.value)}
              inputMode="tel"
              placeholder="Teléfono del cliente"
              className="w-full rounded-xl bg-white/10 border border-white/20 pl-9 pr-3 py-3 text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>

          {/* Si hay cliente, lo mostramos en lectura */}
          {cliente && (
            <div className="mt-2 text-white/90 text-sm">
              <div className="font-semibold uppercase">{cliente.nombre || 'SIN NOMBRE'}</div>
              <div className="uppercase">{cliente.direccion || 'SIN DIRECCIÓN'}</div>
            </div>
          )}

          {/* Estado de verificación */}
          {checking && <div className="mt-2 text-xs text-white/70">Buscando cliente…</div>}
        </div>
      </div>

      {/* Modal creación de cliente */}
      <NuevoClienteModal
        open={openNuevo}
        telefono={tel}
        onClose={() => setOpenNuevo(false)}
        onSaved={(c) => {
          setCliente(c);
          onClienteCargado?.(c);
        }}
      />
    </>
  );
}
