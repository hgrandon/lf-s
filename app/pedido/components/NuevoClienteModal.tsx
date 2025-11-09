'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, Save, Loader2 } from 'lucide-react';

type Cliente = {
  telefono: string;
  nombre: string;
  direccion: string;
};

export default function NuevoClienteModal({
  open,
  telefono,
  onClose,
  onSaved,
}: {
  open: boolean;
  telefono: string; // viene normalizado por HeaderPedido
  onClose: () => void;
  onSaved: (c: Cliente) => void;
}) {
  const [form, setForm] = useState<Cliente>({ telefono: '', nombre: '', direccion: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setForm((prev) => ({ ...prev, telefono }));
      setError(null);
      // foco al abrir
      const t = setTimeout(() => firstInputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open, telefono]);

  const canSave = useMemo(() => {
    return (form.telefono?.trim()?.length ?? 0) >= 8 && form.nombre.trim() !== '';
  }, [form.telefono, form.nombre]);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);

      // Validación simple
      const tel = (form.telefono || '').replace(/\D/g, '');
      if (tel.length < 8) {
        setError('El teléfono debe tener al menos 8 dígitos.');
        setSaving(false);
        return;
      }
      if (!form.nombre.trim()) {
        setError('El nombre es obligatorio.');
        setSaving(false);
        return;
      }

      // Inserta/actualiza cliente (upsert por teléfono)
      const payload = {
        telefono: tel,
        nombre: form.nombre.trim().toUpperCase(),
        direccion: (form.direccion || '').trim().toUpperCase(),
      };

      const { data, error } = await supabase
        .from('clientes')
        .upsert(payload, { onConflict: 'telefono' })
        .select('telefono,nombre,direccion')
        .maybeSingle();

      if (error) throw error;

      const saved: Cliente = {
        telefono: data?.telefono ?? payload.telefono,
        nombre: data?.nombre ?? payload.nombre,
        direccion: data?.direccion ?? payload.direccion,
      };

      onSaved(saved); // avisa al Header y éste al padre
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? 'No se pudo guardar el cliente.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
      <div className="w-[520px] max-w-full rounded-2xl bg-white text-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="font-bold">Nuevo cliente</div>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-slate-100 text-slate-500"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 grid gap-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Teléfono</label>
            <input
              ref={firstInputRef}
              value={form.telefono}
              onChange={(e) =>
                setForm((p) => ({ ...p, telefono: e.target.value.replace(/\D/g, '') }))
              }
              inputMode="tel"
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300"
              placeholder="Ej: 958420620"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Nombre</label>
            <input
              value={form.nombre}
              onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300"
              placeholder="NOMBRE Y APELLIDO"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Dirección</label>
            <input
              value={form.direccion}
              onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value }))}
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300"
              placeholder="CALLE Y NÚMERO"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-rose-100 text-rose-700 px-3 py-2 text-sm">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            disabled={!canSave || saving}
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
