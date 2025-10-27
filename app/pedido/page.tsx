'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Phone, UserRound } from 'lucide-react';

type Cliente = { telefono: string; nombre: string; direccion: string };

const normalizePhone = (v: string) => (v || '').replace(/\D+/g, '').slice(0, 9);
const toUC = (s: string) => (s || '').trim().toUpperCase();

// Cambia a false si no quieres redirección automática
const AUTO_REDIRECT = true;

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        {children}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BuscarClientePage() {
  const router = useRouter();

  const phoneRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef<string>('');

  const [telefono, setTelefono] = useState('');
  const [cliente, setCliente] = useState<Cliente | null>(null);

  const [showNewClient, setShowNewClient] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState<string>('');

  // focus inicial
  useEffect(() => {
    const t = setTimeout(() => phoneRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  const redirectToNuevo = useCallback(
    (tel: string) => {
      router.replace(`/pedido/nuevo?tel=${tel}`);
    },
    [router]
  );

  // Lookup de cliente por teléfono
  const lookup = useCallback(
    async (tel: string) => {
      if (tel.length !== 9) return;
      setSearching(true);
      setMsg('Buscando cliente...');
      lastQueryRef.current = tel;

      const { data, error } = await supabase.rpc('clientes_get_by_tel', { p_telefono: tel });

      // Evitar carreras si el usuario escribe otro número durante la espera
      if (lastQueryRef.current !== tel) {
        setSearching(false);
        return;
      }

      if (error) {
        setMsg('Error: ' + error.message);
        setCliente(null);
        setShowNewClient(false);
      } else {
        const cli = (data as Cliente[] | null)?.[0] ?? null;
        if (cli) {
          setCliente(cli);
          setShowNewClient(false);
          setMsg('✅ Cliente encontrado');

          // Redirección automática
          if (AUTO_REDIRECT) {
            // pequeño delay visual opcional
            setTimeout(() => redirectToNuevo(cli.telefono), 150);
          }
        } else {
          setCliente(null);
          setNewName('');
          setNewAddress('');
          setShowNewClient(true);
          setMsg('⚠️ Teléfono no existe. Registra el cliente.');
        }
      }
      setSearching(false);
    },
    [redirectToNuevo]
  );

  // On change con debounce
  const onPhoneChange = (raw: string) => {
    const digits = normalizePhone(raw);
    setTelefono(digits);
    setCliente(null);
    setMsg('');
    setShowNewClient(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (digits.length === 9) {
      debounceRef.current = setTimeout(() => lookup(digits), 300);
    }
  };

  // Enter fuerza búsqueda inmediata
  const onPhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const tel = normalizePhone(telefono);
      if (tel.length === 9) lookup(tel);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Crear cliente rápido (si no existe)
  const saveNewClient = async () => {
    const tel = normalizePhone(telefono);
    if (tel.length !== 9) return setMsg('Teléfono inválido.');
    if (!newName.trim()) return setMsg('Ingresa el nombre del cliente.');

    setLoading(true);
    setMsg('Guardando cliente...');

    try {
      const payload = {
        p_telefono: tel,
        p_nombre: toUC(newName),
        p_direccion: toUC(newAddress),
      };
      const { error } = await supabase.rpc('clientes_upsert', payload);
      if (error) throw error;

      const created: Cliente = {
        telefono: tel,
        nombre: payload.p_nombre,
        direccion: payload.p_direccion,
      };
      setCliente(created);
      setShowNewClient(false);
      setMsg('✅ Cliente guardado');

      if (AUTO_REDIRECT) {
        setTimeout(() => redirectToNuevo(tel), 150);
      }
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  // Botón manual de continuar (por si desactivas AUTO_REDIRECT)
  const goCrearPedido = () => {
    if (!cliente) return;
    redirectToNuevo(cliente.telefono);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" />
      <div className="relative z-10 mx-auto w-full max-w-md sm:max-w-lg p-4 sm:p-6">
        {/* Header */}
        <header className="mb-4 flex items-center justify-between text-white">
          <h1 className="text-xl sm:text-2xl font-bold">Nuevo Pedido</h1>
          <button
            onClick={() => router.push('/menu')}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow hover:bg-white"
            title="Volver"
            aria-label="Volver"
          >
            <ArrowLeft className="text-violet-700" size={18} />
          </button>
        </header>

        {/* Card */}
        <div className="rounded-xl bg-white p-4 shadow">
          <h2 className="mb-3 text-2xl font-semibold text-gray-900">Buscar Cliente</h2>

          <label className="mb-1 block text-sm text-gray-700 font-semibold">
            Teléfono del Cliente
          </label>
          <div className="relative mb-3">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-60">
              <Phone size={16} />
            </span>
            <input
              ref={phoneRef}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="555-123-4567"
              value={telefono}
              onChange={(e) => onPhoneChange(e.target.value)}
              onKeyDown={onPhoneKeyDown}
              className="w-full rounded-lg border px-9 py-2 text-base outline-none focus:ring-2 focus:ring-purple-500"
              aria-label="Teléfono del cliente"
            />
          </div>

          {searching && <div className="mb-2 text-sm text-gray-500">Buscando cliente…</div>}

          {/* Tarjeta preview (si deseas que se vea antes de redirigir) */}
          {cliente && !AUTO_REDIRECT && (
            <>
              <div className="mb-4 rounded-xl border bg-white shadow-sm">
                <div className="flex items-center justify-between p-3">
                  <div>
                    <div className="text-xs text-gray-500">Cliente</div>
                    <div className="text-base font-semibold text-gray-900">{cliente.nombre}</div>
                    <div className="text-sm text-gray-600">{cliente.direccion}</div>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-purple-50 text-purple-700">
                    <UserRound size={18} />
                  </div>
                </div>
              </div>
              <button
                onClick={goCrearPedido}
                className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Crear Pedido
              </button>
            </>
          )}

          {msg && <div className="mt-3 text-sm text-gray-700">{msg}</div>}
        </div>
      </div>

      {/* Modal: nuevo cliente */}
      <Modal open={showNewClient} onClose={() => setShowNewClient(false)}>
        <h3 className="mb-3 text-lg font-semibold text-gray-800">Nuevo Cliente</h3>
        <div className="grid gap-3">
          <input
            disabled
            value={telefono}
            className="w-full rounded border bg-gray-100 px-3 py-2 text-gray-600"
          />
          <input
            placeholder="NOMBRE DEL CLIENTE"
            value={newName}
            onChange={(e) => setNewName(toUC(e.target.value))}
            className="w-full rounded border px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            placeholder="DIRECCIÓN DEL CLIENTE"
            value={newAddress}
            onChange={(e) => setNewAddress(toUC(e.target.value))}
            className="w-full rounded border px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setShowNewClient(false)}
            className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={saveNewClient}
            disabled={loading}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </Modal>
    </main>
  );
}









