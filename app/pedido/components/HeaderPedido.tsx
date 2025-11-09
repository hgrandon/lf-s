// app/pedido/components/HeaderPedido.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NuevoClienteModal from './NuevoClienteModal';
import { Phone, Loader2 } from 'lucide-react';

/** ====== Tipos exportados para ser usados desde page.tsx ====== */
export type Cliente = {
  telefono: string;
  nombre: string | null;
  direccion: string | null;
};

/** Algunas pantallas importan este tipo desde aquí. */
export type NextNumber = {
  nro: number;
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
  /** Abrir modal automáticamente si no existe el cliente (por defecto: true) */
  autoOpenOnMissing?: boolean;
};

/* Normaliza teléfonos chilenos:
   - Elimina todo lo que no sea dígito
   - Si viene con 56 al inicio, lo deja como 9 dígitos (móvil CL) cuando corresponde
*/
function normalizeTel(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  // Quitar prefijo 56 si viene como +569XXXXXXXX o 569XXXXXXXX
  if ((digits.startsWith('56') && digits.length >= 11) || (digits.startsWith('056') && digits.length >= 12)) {
    // ejemplo: 56912345678 -> 912345678
    const trimmed = digits.replace(/^0?56/, '');
    return trimmed;
  }
  return digits;
}

function looksLikeValidCL(digits: string): boolean {
  // Acepta 8 o 9 dígitos (hay líneas fijas de 8 y móviles de 9)
  const len = digits.length;
  return len >= 8 && len <= 9;
}

export default function HeaderPedido({
  pedidoId,
  telefono,
  onTelefonoChange,
  onClienteCargado,
  fechaIngresoISO,
  fechaEntregaISO,
  autoOpenOnMissing = true,
}: Props) {
  /** Estado de teléfono local si el padre no lo controla */
  const [telLocal, setTelLocal] = useState(() => normalizeTel(telefono ?? ''));
  const tel = typeof telefono === 'string' ? normalizeTel(telefono) : telLocal;

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [checking, setChecking] = useState(false);
  const [openNuevo, setOpenNuevo] = useState(false);

  /** Para no volver a abrir el modal repetidamente con el mismo teléfono */
  const lastMissingTelRef = useRef<string>('');

  /** Timer para debounce */
  const debTimer = useRef<number | null>(null);
  /** Evitar setState luego de ununmount */
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debTimer.current) window.clearTimeout(debTimer.current);
    };
  }, []);

  /** Si el padre cambia el teléfono, reflejarlo localmente normalizado */
  useEffect(() => {
    if (typeof telefono === 'string') {
      const norm = normalizeTel(telefono);
      setTelLocal(norm);
    }
  }, [telefono]);

  /** Buscar cliente por teléfono (con debounce) */
  useEffect(() => {
    const digits = normalizeTel(tel);

    // Si no hay suficientes dígitos, limpiamos y no consultamos
    if (!looksLikeValidCL(digits)) {
      setCliente(null);
      setOpenNuevo(false); // no mostrar modal si borra
      lastMissingTelRef.current = '';
      return;
    }

    if (debTimer.current) window.clearTimeout(debTimer.current);

    debTimer.current = window.setTimeout(async () => {
      try {
        setChecking(true);
        const { data, error } = await supabase
          .from('clientes')
          .select('telefono,nombre,direccion')
          .eq('telefono', digits)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          const found: Cliente = {
            telefono: String(data.telefono),
            nombre: (data.nombre ?? '') as string,
            direccion: (data.direccion ?? '') as string,
          };
          if (!mountedRef.current) return;
          setCliente(found);
          lastMissingTelRef.current = '';
          onClienteCargado?.({
            telefono: found.telefono,
            nombre: found.nombre || '',
            direccion: found.direccion || '',
          });
          setOpenNuevo(false);
        } else {
          // No existe
          if (!mountedRef.current) return;
          setCliente(null);
          // Evitar abrir el modal en loop si ya preguntamos por este mismo teléfono
          if (autoOpenOnMissing && lastMissingTelRef.current !== digits) {
            lastMissingTelRef.current = digits;
            setOpenNuevo(true);
          }
        }
      } catch (e) {
        console.error('Error consultando cliente:', e);
      } finally {
        if (mountedRef.current) setChecking(false);
      }
    }, 450);

    return () => {
      if (debTimer.current) window.clearTimeout(debTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tel, autoOpenOnMissing]);

  function handleTelChange(v: string) {
    const norm = normalizeTel(v);
    if (onTelefonoChange) onTelefonoChange(norm);
    else setTelLocal(norm);

    // Si cambia el teléfono manualmente, permitimos volver a abrir modal para otro número inexistente
    if (norm !== lastMissingTelRef.current) {
      lastMissingTelRef.current = '';
    }
  }

  const fechaIng = useMemo(() => {
    if (!fechaIngresoISO) return '';
    const d = new Date(fechaIngresoISO);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }, [fechaIngresoISO]);

  const fechaEnt = useMemo(() => {
    if (!fechaEntregaISO) return '';
    const d = new Date(fechaEntregaISO);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
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
          <label className="sr-only" htmlFor="pedido-telefono">
            Teléfono del cliente
          </label>
          <div className="relative max-w-md">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/80">
              {checking ? <Loader2 className="animate-spin" size={16} /> : <Phone size={16} />}
            </div>
            <input
              id="pedido-telefono"
              value={tel}
              onChange={(e) => { handleTelChange(e.target.value); }}
              inputMode="tel"
              autoComplete="tel"
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
          // Al guardar, fijamos el cliente y notificamos al padre
          setCliente(c);
          onClienteCargado?.(c);
          setOpenNuevo(false);
        }}
      />
    </>
  );
}
