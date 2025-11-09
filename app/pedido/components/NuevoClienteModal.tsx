'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  open: boolean;
  telefono: string;
  onClose: () => void;
  onSaved: (cli: { telefono: string; nombre: string; direccion: string }) => void;
};

export default function NuevoClienteModal({ open, telefono, onClose, onSaved }: Props) {
  const [tel, setTel] = useState(telefono ?? '');
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTel(telefono ?? '');
  }, [telefono]);

  if (!open) return null;

  async function handleSave() {
    const t = (tel || '').trim();
    const n = (nombre || '').trim().toUpperCase();
    const d = (direccion || '').trim().toUpperCase();
    if (!t || !n) return;

    try {
      setSaving(true);

      // Intenta inserción; si ya existe, hace upsert por si acaso.
      const { error } = await supabase
        .from('clientes')
        .upsert({ telefono: t, nombre: n, direccion: d }, { onConflict: 'telefono' });

      if (error) throw error;

      onSaved({ telefono: t, nombre: n, direccion: d });
      onClose();
    } catch (e) {
      console.error('No se pudo guardar el cliente nuevo:', e);
      alert('No se pudo guardar el cliente. Revisa la conexión e inténtalo nuevamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50" onClick={onClose}>
      <div
        className="w-[460px] max-w-[92vw] rounded-2xl bg-white p-5 text-violet-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-4">Nuevo Cliente</h3>

        <div className="grid gap-3">
          <input
            value={tel}
            onChange={(e) => setTel(e.target.value.replace(/\D/g, ''))}
            maxLength={12}
            placeholder="TELÉFONO"
            className="w-full rounded-xl border border-violet-200 px-3 py-3 outline-none focus:ring-2 focus:ring-violet-300"
          />
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="NOMBRE DEL CLIENTE"
            className="w-full rounded-xl border border-violet-200 px-3 py-3 uppercase outline-none focus:ring-2 focus:ring-violet-300"
          />
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="DIRECCIÓN DEL CLIENTE"
            className="w-full rounded-xl border border-violet-200 px-3 py-3 uppercase outline-none focus:ring-2 focus:ring-violet-300"
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !tel || !nombre}
            className="rounded-xl bg-violet-600 text-white px-4 py-3 font-semibold hover:bg-violet-700 disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl bg-violet-100 text-violet-800 px-4 py-3 font-semibold hover:bg-violet-200"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
