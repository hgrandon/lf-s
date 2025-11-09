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

export type NextNumber = { nro: number };
export type LookupState = 'idle' | 'checking' | 'found' | 'not_found' | 'error';

type Props = {
  /** Número de pedido mostrado en el encabezado (ahora opcional) */
  pedidoId?: number;
  telefono?: string;
  onTelefonoChange?: (t: string) => void;
  onClienteCargado?: (cli: { telefono: string; nombre: string; direccion: string }) => void;
  onLookupStateChange?: (s: LookupState) => void;
  onError?: (e: unknown) => void;
  fechaIngresoISO?: string;
  fechaEntregaISO?: string;
  autoOpenOnMissing?: boolean;
  className?: string;

  /** Compatibilidad legacy con page.tsx */
  onCliente?: (c: Cliente | null) => void;
  onNroInfo?: (n: NextNumber | null) => void;
};

/* =========================
   Utilidades de teléfono CL
========================= */
export function normalizeTel(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/^0?56/, '');
}

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
  onCliente,
  onNroInfo, // (no usado por ahora, queda para compatibilidad)
}: Props) {
  const [telLocal, setTelLocal] = useState(() => normalizeTel(telefono ?? ''));
  const tel = typeof telefono === 'string' ? normalizeTel(telefono) : telLocal;

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [state, setState] = useState<LookupState>('idle');
  const [openNuevo, setOpenNuevo] = useState(false);
  const [notFoundOnce, setNotFoundOnce] = useState(false);

  const lastMissingTelRef = useRef<string>('');
  const debTimer = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const reqTokenRef = useRef(0);

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

  useEffect(() => {
    if (typeof telefono === 'string') {
      setTelLocal(normalizeTel(telefono));
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

        if (token !== reqTokenRef.current || !mountedRef.current) return;
        if (error) throw error;

        if (data) {
          const found: Cliente = {
            telefono: String(data.telefono),
            nombre: (data.nombre ?? '') as string,
            direccion: (data.direccion ?? '') as string,
          };
          setCliente(found);
          onCliente?.(found); // compat con page.tsx
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
          setCliente(null);
          setNotFound();
          setNotFoundOnce(true);
          if (autoOpenOnMissing && lastMissingTelRef.current !== digits) {
            lastMissingTelRef.current = digits;
            setOpenNuevo(true);
          }
        }
      } catch (e) {
        setErr();
        onError?.(e);
        if (process.env.NODE_ENV !== 'production') console.error('Error consultando cliente:', e);
      }
    },
    [autoOpenOnMissing, onCliente, onClienteCargado, onError, setChecking, setErr, setFound, setNotFound]
  );

  useEffect(() => {
    const digits = normalizeTel(tel);

    if (!looksLikeValidCL(digits)) {
      setCliente(null);
      setIdle();
      setOpenNuevo(false);
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
    if (norm !== lastMissingTelRef.current) lastMissingTelRef.current = '';
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      handleTelChange('');
      e.currentTarget.blur();
    } else if (e.key === 'Enter') {
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
    e.preventDefault();
    handleTelChange(normalizeTel(text));
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
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
            N° {typeof pedidoId === 'number' ? pedidoId : '—'}
          </h1>
          <div className="text-right text-white/90">
            {fechaIngresoISO && <div className="text-xl sm:text-2xl">{fechaIng}</div>}
            {fechaEntregaISO && <div className="text-xl sm:text-2xl">{fechaEnt}</div>}
          </div>
        </div>

        {/* Teléfono */}
        <div className="mt-4">
          <label className="sr-only" htmlFor="pedido-telefono">Teléfono del cliente</label>
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
            {!!tel && (
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

          {cliente && (
            <div className="mt-2 text-white/90 text-sm">
              <div className="font-semibold uppercase">{cliente.nombre || 'SIN NOMBRE'}</div>
              <div className="uppercase">{cliente.direccion || 'SIN DIRECCIÓN'}</div>
            </div>
          )}

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
          setCliente(c);
          onCliente?.(c); // compat con page.tsx
          setFound();
          onClienteCargado?.(c);
          setOpenNuevo(false);
        }}
      />
    </>
  );
}
