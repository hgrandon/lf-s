// app/pedido/components/HeaderPedido.tsx
'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NuevoClienteModal from './NuevoClienteModal';
import { Phone, Loader2, XCircle } from 'lucide-react';

/** ====== Tipos exportados para ser usados desde page.tsx ====== */
export type Cliente = {
  telefono: string;
  nombre: string | null;
  direccion: string | null;
};

/** Algunas pantallas importan este tipo desde aquí. */
export type NextNumber = { nro: number };

/** Estado del lookup para feedback externo si se requiere */
export type LookupState = 'idle' | 'checking' | 'found' | 'not_found' | 'error';

type Props = {
  /** Número de pedido mostrado en el encabezado */
  pedidoId: number;
  /** Teléfono controlado desde la página (si existe). Si no se pasa, el componente lo maneja internamente. */
  telefono?: string;
  /** Setter opcional si la página controla el teléfono */
  onTelefonoChange?: (t: string) => void;
  /** Callback para notificar que se cargó/creó un cliente (tel/nombre/dirección) */
  onClienteCargado?: (cli: { telefono: string; nombre: string; direccion: string }) => void;
  /** Callback para exponer cambios de estado del lookup (opcional) */
  onLookupStateChange?: (s: LookupState) => void;
  /** Errores de búsqueda/IO (opcional) */
  onError?: (e: unknown) => void;
  /** Fechas visibles en el header */
  fechaIngresoISO?: string;
  fechaEntregaISO?: string;
  /** Abrir modal automáticamente si no existe el cliente (por defecto: true) */
  autoOpenOnMissing?: boolean;
  /** Clase extra para el contenedor principal (opcional) */
  className?: string;

  onCliente?: (c: Cliente | null) => void;
  onNroInfo?: (n: NextNumber | null) => void;
};

/* =========================
   Utilidades de teléfono CL
========================= */

/**
 * Normaliza teléfonos chilenos:
 * - Elimina todo lo que no sea dígito
 * - Remueve prefijo 56/056 y el 9 de móviles si viene con más dígitos
 * - Retorna sólo dígitos
 */
export function normalizeTel(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';

  // Remover 056 o 56 al inicio
  const noCC = digits.replace(/^0?56/, '');

  // El resultado esperado en CL suele ser 9 (móvil) o 8 (fijo) dígitos.
  // Si alguien pegó 12-13 dígitos ( +56 9 xxxxxxxx ), ya removimos 56/056 arriba.
  return noCC;
}

/** Acepta 8 o 9 dígitos (fijo 8, móvil 9) */
export function looksLikeValidCL(digits: string): boolean {
  const len = digits.length;
  return len === 8 || len === 9;
}

export default function HeaderPedido({
  pedidoId,
  telefono,
  onTelefonoChange,
  onClienteCargado,
  onLookupStateChange,
  onError,
  fechaIngresoISO,
  fechaEntregaISO,
  autoOpenOnMissing = true,
  className = '',
}: Props) {
  /** Estado de teléfono local si el padre no lo controla */
  const [telLocal, setTelLocal] = useState(() => normalizeTel(telefono ?? ''));
  // Siempre trabajamos con el valor normalizado
  const tel = typeof telefono === 'string' ? normalizeTel(telefono) : telLocal;

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [state, setState] = useState<LookupState>('idle');
  const [openNuevo, setOpenNuevo] = useState(false);
  const [notFoundOnce, setNotFoundOnce] = useState(false);

  /** Para no volver a abrir el modal repetidamente con el mismo teléfono */
  const lastMissingTelRef = useRef<string>('');
  /** Timer para debounce */
  const debTimer = useRef<number | null>(null);
  /** Evitar setState luego de ununmount */
  const mountedRef = useRef(true);
  /** “Token” simple para invalidar respuestas tardías del lookup */
  const reqTokenRef = useRef(0);

  // sincroniza estado “externo”
  useEffect(() => {
    onLookupStateChange?.(state);
  }, [state, onLookupStateChange]);

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

  const setChecking = useCallback(() => setState('checking'), []);
  const setFound = useCallback(() => setState('found'), []);
  const setNotFound = useCallback(() => setState('not_found'), []);
  const setIdle = useCallback(() => setState('idle'), []);
  const setErr = useCallback(() => setState('error'), []);

  const runLookup = useCallback(
    async (digits: string, token: number) => {
      try {
        setChecking();
        const { data, error } = await supabase
          .from('clientes')
          .select('telefono,nombre,direccion')
          .eq('telefono', digits)
          .maybeSingle();

        // Si llegó una respuesta antigua, la ignoramos
        if (token !== reqTokenRef.current || !mountedRef.current) return;

        if (error) throw error;

        if (data) {
          const found: Cliente = {
            telefono: String(data.telefono),
            nombre: (data.nombre ?? '') as string,
            direccion: (data.direccion ?? '') as string,
          };
          setCliente(found);
          onCliente?.(found);
          setFound();
          lastMissingTelRef.current = '';
          setOpenNuevo(false);
          setNotFoundOnce(false);
          onClienteCargado?.({
            telefono: found.telefono,
            nombre: found.nombre || '',
            direccion: found.direccion || '',
          });
        } else {
          // No existe
          setCliente(null);
          setNotFound();
          setNotFoundOnce(true);
          if (autoOpenOnMissing && lastMissingTelRef.current !== digits) {
            lastMissingTelRef.current = digits;
            setOpenNuevo(true);
          }
        }
      } catch (e) {
        // Error real de IO/RLS/etc.
        setErr();
        onError?.(e);
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error('Error consultando cliente:', e);
        }
      }
    },
    [autoOpenOnMissing, onClienteCargado, onError, setChecking, setErr, setFound, setNotFound]
  );

  /** Buscar cliente por teléfono (con debounce) */
  useEffect(() => {
    const digits = normalizeTel(tel);

    // Si no hay suficientes dígitos, limpiamos y no consultamos
    if (!looksLikeValidCL(digits)) {
      setCliente(null);
      setIdle();
      setOpenNuevo(false); // no mostrar modal si borra
      lastMissingTelRef.current = '';
      setNotFoundOnce(false);
      if (debTimer.current) window.clearTimeout(debTimer.current);
      return;
    }

    if (debTimer.current) window.clearTimeout(debTimer.current);

    const token = ++reqTokenRef.current;
    debTimer.current = window.setTimeout(() => {
      if (mountedRef.current) runLookup(digits, token);
    }, 400);

    return () => {
      if (debTimer.current) window.clearTimeout(debTimer.current);
    };
  }, [tel, runLookup, setIdle]);

  function handleTelChange(v: string) {
    const norm = normalizeTel(v);
    if (onTelefonoChange) onTelefonoChange(norm);
    else setTelLocal(norm);

    // Si cambia el teléfono manualmente, permitimos volver a abrir modal para otro número inexistente
    if (norm !== lastMissingTelRef.current) {
      lastMissingTelRef.current = '';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      // limpiar rápidamente
      handleTelChange('');
      e.currentTarget.blur();
    } else if (e.key === 'Enter') {
      // buscado inmediato (sin esperar debounce)
      const digits = normalizeTel((e.currentTarget as HTMLInputElement).value);
      if (looksLikeValidCL(digits)) {
        if (debTimer.current) window.clearTimeout(debTimer.current);
        const token = ++reqTokenRef.current;
        runLookup(digits, token);
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    const norm = normalizeTel(text);
    e.preventDefault();
    handleTelChange(norm);
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
      <div className={`relative mb-4 ${className}`}>
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
              {state === 'checking' ? <Loader2 className="animate-spin" size={16} /> : <Phone size={16} />}
            </div>
            <input
              id="pedido-telefono"
              value={tel}
              onChange={(e) => handleTelChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              inputMode="tel"
              autoComplete="tel"
              placeholder="Teléfono del cliente"
              className="w-full rounded-xl bg-white/10 border border-white/20 pl-9 pr-10 py-3 text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-white/30"
            />
            {tel && (
              <button
                type="button"
                aria-label="Borrar teléfono"
                onClick={() => handleTelChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-white/70 hover:text-white"
              >
                <XCircle size={18} />
              </button>
            )}
          </div>

          {/* Si hay cliente, lo mostramos en lectura */}
          {cliente && (
            <div className="mt-2 text-white/90 text-sm">
              <div className="font-semibold uppercase">{cliente.nombre || 'SIN NOMBRE'}</div>
              <div className="uppercase">{cliente.direccion || 'SIN DIRECCIÓN'}</div>
            </div>
          )}

          {/* Estado de verificación */}
          {state === 'checking' && <div className="mt-2 text-xs text-white/70">Buscando cliente…</div>}
          {state === 'not_found' && notFoundOnce && (
            <div className="mt-2 text-xs text-white/80">No se encontró cliente con ese teléfono.</div>
          )}
          {state === 'error' && (
            <div className="mt-2 text-xs text-red-200">Ocurrió un error al consultar el cliente.</div>
          )}
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
          onCliente?.(c);
          setFound();
          onClienteCargado?.(c);
          setOpenNuevo(false);
        }}
      />
    </>
  );
}
