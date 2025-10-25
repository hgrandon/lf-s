'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Cliente = { telefono: string; nombre: string; direccion: string; updated_at?: string };

function useAuthGuard() {
  const router = useRouter();
  useEffect(() => {
    const ok = typeof window !== 'undefined' && localStorage.getItem('auth') === 'ok';
    if (!ok) router.replace('/login');
  }, [router]);
}

export default function ClientesPage() {
  useAuthGuard();

  const [form, setForm] = useState<Cliente>({ telefono: '', nombre: '', direccion: '' });
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const canSave = useMemo(() =>
    form.telefono.trim() && form.nombre.trim() && form.direccion.trim()
  , [form]);

  function up<K extends keyof Cliente>(k: K, v: string) {
    // Forzamos MAYÚSCULAS y trim en la UI
    setForm(s => ({ ...s, [k]: v.toUpperCase() }));
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
      p_direccion: form.direccion
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
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q]);

  return (
    <main className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <a href="/menu" className="text-sm text-purple-700 hover:underline">← Volver al menú</a>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Formulario */}
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold mb-3">Nuevo / Editar</h2>
            <div className="grid gap-3">
              <input
                placeholder="TELÉFONO"
                value={form.telefono}
                onChange={(e) => up('telefono', e.target.value)}
                className="border rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                placeholder="NOMBRE"
                value={form.nombre}
                onChange={(e) => up('nombre', e.target.value)}
                className="border rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                placeholder="DIRECCIÓN"
                value={form.direccion}
                onChange={(e) => up('direccion', e.target.value)}
                className="border rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500"
              />

              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={!canSave || loading}
                  className={`px-4 py-2 rounded-lg text-white font-semibold ${
                    !canSave || loading ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {loading ? 'Guardando…' : 'Guardar / Actualizar'}
                </button>
                <button
                  onClick={() => setForm({ telefono: '', nombre: '', direccion: '' })}
                  className="px-4 py-2 rounded-lg border border-gray-300"
                >
                  Limpiar
                </button>
              </div>
              {msg && <small className="text-gray-600">{msg}</small>}
            </div>
          </div>

          {/* Listado */}
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold mb-3">Listado de Clientes, Buscar</h2>
            <input
              placeholder="BUSCAR X TEL / NOMBRE / DIRECCIÓN"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="border rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500 w-full mb-3"
            />
            <div className="overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-sm text-gray-500">
                    <th className="py-2 border-b">Teléfono</th>
                    <th className="py-2 border-b">Nombre</th>
                    <th className="py-2 border-b">Dirección</th>
                    <th className="py-2 border-b"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.telefono} className="text-sm">
                      <td className="py-2 border-b">{r.telefono}</td>
                      <td className="py-2 border-b">{r.nombre}</td>
                      <td className="py-2 border-b">{r.direccion}</td>
                      <td className="py-2 border-b">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setForm(r)}
                            className="px-3 py-1 rounded border text-gray-700"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => del(r.telefono)}
                            className="px-3 py-1 rounded bg-red-600 text-white"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr><td colSpan={4} className="py-6 text-center text-gray-500">
                      {loading ? 'Cargando…' : 'Sin resultados'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
