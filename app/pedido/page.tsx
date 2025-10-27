// app/pedido/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Phone, UserRound } from 'lucide-react';

type Cliente = { telefono: string; nombre: string; direccion: string };

const normalizePhone = (v: string) => (v || '').replace(/\D+/g, '').slice(0, 9);

export const dynamic = 'force-dynamic';

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
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
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
  const [telefono, setTelefono] = useState('');
  const [cliente, setCliente] = useState<Cliente | null>(null);

  const [showNewClient, setShowNewClient] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    // evitar SSR: solo client
    const id = setTimeout(() => phoneRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, []);

  // debounce
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPhoneChange = (raw: string) => {
    const digits = normalizePhone(raw);
    setTelefono(digits);
    setCliente(null);
    setMsg('');
    setShowNewClient(false);

    if (timer.current) clearTimeout(timer.current);
    if (digits.length === 9) {
      timer.current = setTimeout(() => lookup(digits), 300);
    }
  };

  async function lookup(tel: string) {
    try {
      setMsg('Buscando cliente...');
      const { data, error } = await supabase.rpc('clientes_get_by_tel', { p_telefono: tel });
      if (error) {
        setMsg('Error: ' + error.message);
        return;
      }
      const cli = (data as Cliente[] | null)?.[0] ?? null;
      if (cli) {
        setCliente(cli);
        setMsg('✅ Cliente encontrado');
      } else {
        setCliente(null);
        setNewName('');
        setNewAddress('');
        setShowNewClient(true);
        setMsg('⚠️ Teléfono no existe. Registra el cliente.');
      }
    } catch (e: any) {
      setMsg('Error: ' + (e?.message ?? e));
    }
  }

  async function saveNewClient() {
    const tel = normalizePhone(telefono);
    if (tel.length !== 9) return setMsg('Teléfono inválido.');
    if (!newName.trim()) return setMsg('Ingresa nombre.');
    setLoading(true);
    setMsg('Guardando cliente...');
    try {
      const { error } = await supabase.rpc('clientes_upsert', {
        p_telefono: tel,
        p_nombre: newName.trim().toUpperCase(),
        p_direccion: (newAddress || '').trim().toUpperCase(),
      });
      if (error) throw error;

      setCliente({
        telefono: tel,
        nombre: newName.trim().toUpperCase(),
        direccion: (newAddress || '').trim().toUpperCase(),
      });
      setShowNewClient(false);
      setMsg('✅ Cliente guardado');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  function goCrearPedido() {
    if (!cliente) return;
    router.push(`/pedido/nuevo?tel=${cliente.telefono}`);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" />
      <div className="relative z-10 mx-auto w-full max-w-md sm:max-w-lg p-4 sm:p-6">
        <header className="mb-4 flex items-center justify-between text-white">
          <h1 className="text-xl sm:text-2xl font-bold">Nuevo Pedido</h1>
          <button
            onClick={() => router.push('/menu')}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow hover:bg-white"
            title="Volver"
          >
            <ArrowLeft className="text-violet-700" size={18} />
          </button>
        </header>

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
              className="w-full rounded-lg border px-9 py-2 text-base outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {cliente && (
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

      <Modal open={showNewClient} onClose={() => setShowNewClient(false)}>
        <h3 className="mb-3 text-lg font-semibold text-gray-800">Nuevo Cliente</h3>
        <div className="grid gap-3">
          <input disabled value={telefono} className="w-full rounded border bg-gray-100 px-3 py-2 text-gray-600" />
          <input
            placeholder="NOMBRE DEL CLIENTE"
            value={newName}
            onChange={(e) => setNewName(e.target.value.toUpperCase())}
            className="w-full rounded border px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            placeholder="DIRECCIÓN DEL CLIENTE"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value.toUpperCase())}
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










