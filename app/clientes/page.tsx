'use client';

import Protected from '@/app/components/Protected';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Cliente = { telefono: string; nombre: string; direccion: string; updated_at?: string };

export default function ClientesPage() {
  const [form, setForm] = useState<Cliente>({ telefono: '', nombre: '', direccion: '' });
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const canSave = useMemo(
    () => form.telefono.trim() && form.nombre.trim() && form.direccion.trim(),
    [form]
  );

  function up<K extends keyof Cliente>(k: K, v: string) {
    setForm((s) => ({ ...s, [k]: v.toUpperCase() }));
  }

  async function load() {
    setLoading(true);
    setMsg('');
    const { data, error } = await supabase.rpc('clientes_list', { q: q.toUpperCase() });
    if (error) setMsg('Error al cargar: ' + error.message);
    setRows((data as Cliente[]) || []);
    setLoading(false);
  }

  async function save() {
    setLoading(true);
    setMsg('Guardando...');
    const { error } = await supabase.rpc('clientes_upsert', {
      p_telefono: form.telefono,
      p_nombre: form.nombre,
      p_direccion: form.direccion,
    });
    if (error) setMsg('❌ ' + error.message);
    else {
      setMsg('✅ Guardado');
      setForm({ telefono: '', nombre: '', direccion: '' });
      await load();
    }
    setLoading(false);
  }

  async function del(tel: string) {
    if (!confirm(`¿Eliminar ${tel}?`)) return;
    setLoading(true);
    const { error } = await supabase.rpc('clientes_delete', { p_telefono: tel });
    if (error) setMsg('❌ ' + error.message);
    else {
      setMsg('🗑️ Eliminado');
      await load();
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [q]);

  return (
    <Protected>
      <main className="min-h-screen bg-gray-100 p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">
          <header className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
            <a href="/menu" className="text-sm text-purple-700 hover:underline">
              ← Volver al menú
            </a>
          </header>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Formulario */}
            <div className="rounded-xl bg-white p-4 shadow">
              <h2 className="mb-3 font-semibold">Nuevo / Editar</h2>
              <div className="grid gap-3">
                <input
                  placeholder="TELÉFONO"
                  value={form.telefono}
                  onChange={(e) => up('telefono', e.target.value)}
                  className="rounded-lg border p-3 outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  placeholder="NOMBRE"
                  value={form.nombre}
                  onChange={(e) => up('nombre', e.target.value)}
                  className="rounded-lg border p-3 outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  placeholder="DIRECCIÓN"
                  value={form.direccion}
                  onChange={(e) => up('direccion', e.target.value)}
                  className="rounded-lg border p-3 outline-none focus:ring-2 focus:ring-purple-500"
                />

                <div className="flex gap-2">
                  <button
                    onClick={save}
                    disabled={!canSave || loading}
                    className={`rounded-lg px-4 py-2 font-semibold text-white ${
                      !canSave || loading
                        ? 'cursor-not-allowed bg-purple-400'
                        : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    {loading ? 'Guardando…' : 'Guardar / Actualizar'}
                  </button>
                  <button
                    onClick={() => setForm({ telefono: '', nombre: '', direccion: '' })}
                    className="rounded-lg border border-gray-300 px-4 py-2"
                  >
                    Limpiar
                  </button>
                </div>
                {msg && <small className="text-gray-600">{msg}</small>}
              </div>
            </div>

            {/* Listado */}
            <div className="rounded-xl bg-white p-4 shadow">
              <h2 className="mb-3 font-semibold">Listado de Clientes, Buscar</h2>
              <input
                placeholder="BUSCAR X TEL / NOMBRE / DIRECCIÓN"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="mb-3 w-full rounded-lg border p-3 outline-none focus:ring-2 focus:ring-purple-500"
              />
              <div className="overflow-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="text-sm text-gray-500">
                      <th className="border-b py-2">Teléfono</th>
                      <th className="border-b py-2">Nombre</th>
                      <th className="border-b py-2">Dirección</th>
                      <th className="border-b py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.telefono} className="text-sm">
                        <td className="border-b py-2">{r.telefono}</td>
                        <td className="border-b py-2">{r.nombre}</td>
                        <td className="border-b py-2">{r.direccion}</td>
                        <td className="border-b py-2">
                          <div className="flex gap-2">
                            <button onClick={() => setForm(r)} className="rounded border px-3 py-1 text-gray-700">
                              Editar
                            </button>
                            <button onClick={() => del(r.telefono)} className="rounded bg-red-600 px-3 py-1 text-white">
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!rows.length && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-gray-500">
                          {loading ? 'Cargando…' : 'Sin resultados'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </Protected>
  );
}



